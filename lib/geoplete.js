var Awesomplete = require('@melitele/awesomplete');
var furkotGeocode = require('furkot-geocode');
var debounce = require('debounce');

module.exports = geoplete;

var defaultGeocoder = {
  order: ['algolia'],
  algolia_parameters: { interval : 1000 },
  algolia_enable: function() { return true; }
};

var Suggestions = {
  'address': {
    toString: function() { return this.address || this.place; }
  },
  'place': {
    toString: function() { return this.place || this.address; }
  }
};

var keepOpen = {
  esc: true
};

function displayAll() {
  return true;
}

function geoQuery(query) {
  return query;
}

function regExpEscape(s) {
  return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
}

function geoplete(el, options) {
  options = options || {};
  options.type = Suggestions[options.type] ? options.type : 'address';
  options.minChars = options.minChars || 4;
  options.geoQuery = options.geoQuery || geoQuery;
  options.minMatching = options.minMatching || 2;
  options.filterMatches = options.filterMatches || filterMatches;
  var acOptions = {
    minChars: 0,
    filter: displayAll,
    sort: options.sort
  };
  if (options.item) {
    acOptions.item = options.item;
  }
  if (options.container) {
    acOptions.container = options.container;
  }


  var geoOptions = options.geocoder || defaultGeocoder;

  var lastValue;
  var outstandingRequest;
  var geocode = furkotGeocode(geoOptions);
  var ac = new Awesomplete(el, acOptions);

  if (options.keepOpen) {
    ac.close = function (close, o) {
      if (o && o.reason && keepOpen[o.reason]) {
        return;
      }
      close.apply(this, Array.prototype.slice.call(arguments, 1));
    }.bind(ac, ac.close);
    el.removeEventListener('blur', ac._events.input.blur);
  }

  var oninput = debounce(function() {
    var value = el.value.trim();
    if (value.length < options.minChars) {
      populate([]);
      return;
    }
    query(value);
  }, 300);

  function onchange(event) {
    var value = event.text.value;
    var changeEvent = new CustomEvent('geoplete-change', { detail: value });
    el.dispatchEvent(changeEvent);
  }

  function fromPlace(place) {
    return Object.assign(Object.create(Suggestions[options.type]), place);
  }

  function filterMatches(result, value) {
    value = new RegExp(regExpEscape(value), 'i');
    return result.filter(function (entry) {
      return value.test(entry);
    });
  }

  function matching(lastValue, value) {
    if (!lastValue) {
      return;
    }
    if (lastValue.value === value) {
      return lastValue;
    }
    if (lastValue.value.length > value.length) {
      return;
    }
    if (!(lastValue.result && lastValue.result.length)) {
      return;
    }
    var result = options.filterMatches(lastValue.result, value);
    if (result.length >= Math.min(options.minMatching, lastValue.result.length)) {
      lastValue.value = value;
      lastValue.result = result;
      return lastValue;
    }
  }

  function query(value) {
    if (matching(lastValue, value)) {
      // do not requery for the same value or when there are enough matching entries
      if (lastValue.result) {
        populate(lastValue.result);
      }
      return;
    }
    if (outstandingRequest) {
      outstandingRequest.abort();
    }
    var params = {
      partial: true,
      bounds: options.bounds,
      preference: options.preference,
      lang: options.lang || document.lang || 'en'
    };
    params[options.type] = value;
    lastValue = {
      value: value
    };
    el.classList.add('geoplete-in-progress');
    outstandingRequest = geocode(options.geoQuery(params), function(result) {
      el.classList.remove('geoplete-in-progress');
      if (!result || !result.places) {
        // no results
        return;
      }
      lastValue.result = result.places.map(fromPlace);
      result.places.stats = result.stats;
      result.places.provider = result.provider;
      populate(lastValue.result);
    });
  }

  function populate(places) {
    ac.list = places;
    ac.evaluate();
    var listEvent = new CustomEvent('geoplete-list', { detail: places });
    el.dispatchEvent(listEvent);
  }

  function destroy() {
    el.removeEventListener('input', oninput);
    el.removeEventListener('awesomplete-selectcomplete', onchange);
    ac.destroy();
  }

  function set(property, value) {
    options[property] = value;
  }

  el.addEventListener('input', oninput);
  el.addEventListener('awesomplete-selectcomplete', onchange);

  return {
    populate: populate,
    set: set,
    destroy: destroy
  };
}
