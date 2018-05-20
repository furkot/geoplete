var assert = require('assert');

var geoplete = require('../');

describe('geoplete', function () {
  before(function () {
    this.jsdom = require('jsdom-global')();
    document.body.innerHTML = '<input id="test" type="text">';
  });

  after(function () {
    this.jsdom();
  });

  it('attach', function () {
    var input = document.getElementById('test');
    var ac = geoplete(input);

    assert.ok(ac, 'should create autocomplete object');

    ac.destroy();
  });
});
