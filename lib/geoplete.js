const Awesomplete = require('@melitele/awesomplete');
const furkotGeocode = require('furkot-geocode');
const debounce = require('debounce');

module.exports = geoplete;

const Suggestions = {
  'address': {
    toString() { return this.address || this.place; }
  },
  'place': {
    toString() { return this.place || this.address; }
  }
};

const keepOpen = {
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
  const acOptions = {
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


  const geoOptions = options.geocoder;

  let lastValue;
  let outstandingRequest;
  const geocode = furkotGeocode(geoOptions);
  const ac = new Awesomplete(el, acOptions);

  if (options.keepOpen) {
    ac.close = function (close, o) {
      if (o && o.reason && keepOpen[o.reason]) {
        return;
      }
      close.apply(this, Array.prototype.slice.call(arguments, 1));
    }.bind(ac, ac.close);
    el.removeEventListener('blur', ac._events.input.blur);
  }

  const oninput = debounce(function() {
    const value = el.value.trim();
    if (value.length < options.minChars) {
      populate([]);
      return;
    }
    query(value);
  }, 300);

  function onchange(event) {
    const value = event.text.value;
    const changeEvent = new CustomEvent('geoplete-change', { detail: value });
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

  function matching(lastValue, value, bounds) {
    if (!lastValue || lastValue.bounds !== bounds) {
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
    const result = options.filterMatches(lastValue.result, value);
    if (result.length >= Math.min(options.minMatching, lastValue.result.length)) {
      lastValue.value = value;
      lastValue.result = result;
      return lastValue;
    }
  }

  function query(value) {
    if (matching(lastValue, value, options.bounds)) {
      // do not requery for the same value or when there are enough matching entries
      if (lastValue.result) {
        populate(lastValue.result);
      }
      return;
    }
    if (outstandingRequest) {
      outstandingRequest.abort();
    }
    const params = {
      partial: true,
      bounds: options.bounds,
      lang: options.lang || document.lang || 'en'
    };
    params[options.type] = value;
    lastValue = {
      value,
      bounds: options.bounds
    };
    el.classList.add('geoplete-in-progress');
    outstandingRequest = geocode(options.geoQuery(params), function(result) {
      el.classList.remove('geoplete-in-progress');
      if (!result || !result.places) {
        // no results
        return;
      }
      lastValue.result = result.places.map(fromPlace);
      populate(lastValue.result, result);
    });
  }

  function populate(places, result) {
    ac.list = places;
    ac.evaluate();
    if (result && places) {
      places = places.slice();
      places.provider = result.provider;
      places.stats = result.stats;
    }
    const listEvent = new CustomEvent('geoplete-list', { detail: places });
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
    populate,
    set,
    destroy
  };
}
