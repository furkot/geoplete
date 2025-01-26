const geoplete = require('..');

const keys = {
  geocodio: process.env.GEOCODIO_KEY,
  graphhopper: process.env.GRAPHHOPPER_KEY,
  locationiq: process.env.LOCATIONIQ_KEY,
  maptiler: process.env.MAPTILER_KEY,
  opencage: process.env.OPENCAGE_KEY,
  pelias: process.env.PELIAS_KEY,
  positionstack: process.env.POSITIONSTACK_KEY
};

function geocoder(name) {
  const g = {
    order: [name]
  };
  g[name + '_key'] = keys[name];
  g[name + '_parameters'] = { interval : 1000 };
  g[name + '_enable'] = () => true;
  return g;
}

const geocoderAddress = [
  'geocodio',
  'graphhopper',
  'locationiq',
  'opencage',
  'pelias',
  'positionstack'
].find(name => keys[name]);

const geocoderPlace = [
  'maptiler',
  'graphhopper',
  'locationiq',
  'opencage',
  'pelias',
  'positionstack'
].find(name => keys[name]);

const result = document.getElementById('result');
function onchange(event) {
  result.value = JSON.stringify(event.detail, null, 2);
}

const place = document.getElementById('place');
place.addEventListener('geoplete-change', onchange);
geoplete(place, { type: 'place', item, geocoder: geocoder(geocoderPlace) });

const address = document.getElementById('address');
address.addEventListener('geoplete-change', onchange);
geoplete(address, { type: 'address', geocoder: geocoder(geocoderAddress) });

// example of how to customize output
function item(text) {
  const v = text.value;
  const li = document.createElement('li');
  li.innerHTML = '<mark>' + (v.place || '') + '</mark> <em>' + v.address + '</em>';
  return li;
}
