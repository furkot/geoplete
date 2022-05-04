const geoplete = require('..');

const result = document.getElementById('result');
function onchange(event) {
  result.value = JSON.stringify(event.detail, null, 2);
}

const place = document.getElementById('place');
place.addEventListener('geoplete-change', onchange);
geoplete(place, { type: 'place', item });

const address = document.getElementById('address');
address.addEventListener('geoplete-change', onchange);
geoplete(address, { type: 'address' });

// example of how to customize output
function item(text) {
  const v = text.value;
  const li = document.createElement('li');
  li.innerHTML = '<mark>' + (v.place || '') + '</mark> <em>' + v.address + '</em>';
  return li;
}
