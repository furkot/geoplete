var assert = require('assert');

var geoplete = require('../');

describe('geoplete', function () {
  before(function () {
    this.jsdom = require('jsdom-global')();
  });

  after(function () {
    this.jsdom();
  });

  it('attach', function () {
    var input = document.createElement(input);
    var ac = geoplete(input);

    assert.ok(ac, 'should create autocomplete object');
  });
});
