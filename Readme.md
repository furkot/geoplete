[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Dependency Status][deps-image]][deps-url]
[![Dev Dependency Status][deps-dev-image]][deps-dev-url]

# geoplete

Autocompletion for places and addresses.

## Install

```sh
$ npm install --save geoplete
```

## Usage

```js
var geoplete = require('geoplete');

geoplete(input, {         // input element to which geoplete attaches
  bounds: [s, w, n e]     // geographical bounds to bias results
});
```

## License

ISC © [Damian Krzeminski](https://pirxpilot.com)

[npm-image]: https://img.shields.io/npm/v/geoplete.svg
[npm-url]: https://npmjs.org/package/geoplete

[travis-url]: https://travis-ci.org/furkot/geoplete
[travis-image]: https://img.shields.io/travis/furkot/geoplete.svg

[deps-image]: https://img.shields.io/david/furkot/geoplete.svg
[deps-url]: https://david-dm.org/furkot/geoplete

[deps-dev-image]: https://img.shields.io/david/dev/furkot/geoplete.svg
[deps-dev-url]: https://david-dm.org/furkot/geoplete?type=dev
