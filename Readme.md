[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Dependency Status][deps-image]][deps-url]
[![Dev Dependency Status][deps-dev-image]][deps-dev-url]

# geoplete

Autocompletion for places and addresses. Checkout the [demo].
Uses [awesomplete] for UI, and [furkot-geocode] as a geocoder backend.

## Install

```sh
$ npm install --save geoplete
```

## Usage

```js
var geoplete = require('geoplete');
var input = document.querySelection('.input-field');

geoplete(input, {         // input element to which geoplete attaches
  type: 'address',        // 'address' or 'place'
  minChars: 4,            // min number of characters before we query for matches
  lang: 'en',             // language - if not specified document.lang is used
  bounds: [[W,S],[E,N]],  // location hint - array of 2 [longitude, latitude] points
  item: function () {},   // generate list item (see [awesomplete][awesomplete-extend])
  geocoder: {
                          // see [furkot-geocode] for details
  }
});
```

When one of the values is selected `input` will event.
The `detail` field of the event contain place information:

- `place` - place name (may be absent if address doesn't correspond to a named place)
- `type` - place type
- `address` - formated address
- `house` - building number
- `street` - street name
- `community` - neighborhood or village
- `town` - town or city
- `county` - administrative area more general than town
- `province` - state or province (usually abbreviated)
- `country` - country (short form but not abbreviated)

## License

ISC © [Damian Krzeminski](https://pirxpilot.com)

[npm-image]: https://img.shields.io/npm/v/geoplete.svg
[npm-url]: https://npmjs.org/package/geoplete

[travis-url]: https://travis-ci.com/furkot/geoplete
[travis-image]: https://img.shields.io/travis/furkot/geoplete.svg

[deps-image]: https://img.shields.io/david/furkot/geoplete.svg
[deps-url]: https://david-dm.org/furkot/geoplete

[deps-dev-image]: https://img.shields.io/david/dev/furkot/geoplete.svg
[deps-dev-url]: https://david-dm.org/furkot/geoplete?type=dev

[awesomplete]: https://npmjs.org/package/awesomplete
[awesomplete-extend]: https://leaverou.github.io/awesomplete/#extensibility
[furkot-geocode]: https://npmjs.org/package/furkot-geocode
[demo]: https://furkot.github.io/geoplete/

