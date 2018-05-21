var Awesomplete = require('awesomplete');
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

function displayAll() {
  return true;
}

function geoplete(el, options) {
  options = options || {};
  options.type = Suggestions[options.type] ? options.type : 'address';
  var acOptions = {
    minChars: options.minChars || 4,
    filter: displayAll
  };


  var geoOptions = options.geocoder || defaultGeocoder;

  var lastValue;
  var geocode = furkotGeocode(geoOptions);
  var ac = new Awesomplete(el, acOptions);

  var oninput = debounce(function() {
    if (el.value.length < acOptions.minChars) {
      return;
    }
    query(el.value);
  }, 300);

  function onchange(event) {
    var value = event.text.value;
    lastValue = value.toString();
    var changeEvent = new CustomEvent('geoplete-change', { detail: value });
    el.dispatchEvent(changeEvent);
  }

  function fromPlace(place) {
    return Object.assign(Object.create(Suggestions[options.type]), place);
  }

  function query(value) {
    if (lastValue === value) {
      // do not requery for the same value
      return;
    }
    var params = {
      partial: true,
      bounds: options.bounds,
      lang: options.lang || document.lang || 'en'
    };
    params[options.type] = value;
    lastValue = value;
    el.classList.add('geoplete-in-progress');
    geocode(params, function(result) {
      el.classList.remove('geoplete-in-progress');
      if (!result || !result.places) {
        // no results
        return;
      }
      ac.list = result.places.map(fromPlace);
      ac.evaluate();
    });
  }

  function destroy() {
    el.removeEventListener('input', oninput);
    el.removeEventListener('awesomplete-selectcomplete', onchange);
    ac.destroy();
  }

  el.addEventListener('input', oninput);
  el.addEventListener('awesomplete-selectcomplete', onchange);

  return {
    destroy: destroy
  };
}
