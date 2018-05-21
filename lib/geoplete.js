var Awesomplete = require('awesomplete');
var furkotGeocode = require('furkot-geocode');
var debounce = require('debounce');

module.exports = geoplete;

var defaultGeoOptions = {
  order: ['algolia'],
  algolia_parameters: { interval : 1000 },
  algolia_enable: function() { return true; }
};

var Suggestion = {
  toString: function() { return this.address || this.place; }
};

function fromPlace(place) {
  return Object.assign(Object.create(Suggestion), place);
}

function displayAll() {
  return true;
}

function geoplete(el, acOptions, geoOptions) {
  var options = acOptions || {};
  options.minChars = options.minChars || 4;
  options.filter = displayAll;

  geoOptions = geoOptions || defaultGeoOptions;

  var lastValue;
  var geocode = furkotGeocode(geoOptions);
  var ac = new Awesomplete(el, options);

  var oninput = debounce(function() {
    if (el.value.length < options.minChars) {
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

  function query(value) {
    if (lastValue === value) {
      // do not requery for the same value
      return;
    }
    var params = {
      address: value,
      partial: true,
      lang: document.lang || 'en'
    };
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
