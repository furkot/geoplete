var Awesomplete = require('awesomplete');
var furkotGeocode = require('furkot-geocode');

module.exports = geoplete;

var defaultGeoOptions = {
  order: ['opencage'],
  opencage_key: process.env.OPENCAGE_KEY,
  opencage_parameters: { interval : 1000 },
  opencage_enable: function() { return true; }
};

var Suggestion = {
  toString: function() { return this.place || this.address; }
};

function fromPlace(place) {
  return Object.assign(Object.create(Suggestion), place);
}

function geoplete(el, acOptions, geoOptions) {
  var options = acOptions || {};
  options.minChars = options.minChars || 4;

  geoOptions = geoOptions || defaultGeoOptions;

  var geocode = furkotGeocode(geoOptions);
  var ac = new Awesomplete(el, options);
  el.addEventListener('keyup', onkey);
  el.addEventListener('awesomplete-selectcomplete', onchange);

  return ac;

  function onkey() {
    if (el.value.length < options.minChars) {
      return;
    }
    query(el.value);
  }

  function onchange(event) {
    var changeEvent = new CustomEvent('geoplete-change', { detail: event.text.value });
    el.dispatchEvent(changeEvent);
  }

  function query(value) {
    var params = {
      address: value,
      partial: true
    };
    geocode(params, function(result) {
      if (!result) {
        // no results
        return;
      }
      ac.list = result.places.map(fromPlace);
      ac.evaluate();
    });
  }

  function destroy() {
    el.removeEvenListener('keyup', onkey);
    el.removeEventListener('awesomplete-selectcomplete', onchange);
    ac.destroy();
  }

  return {
    destroy: destroy
  };
}
