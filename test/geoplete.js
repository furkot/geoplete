var assert = require('assert');

var geoplete = require('../');

describe('geoplete', function () {
  before(function () {
    this.jsdom = require('jsdom-global')();
  });

  after(function () {
    this.jsdom();
  });

  beforeEach(function () {
    document.body.innerHTML = '<input id="test" type="text">';
  });

  afterEach(function () {
    this.ac.destroy();
  });

  it('attach', function () {
    var input = document.getElementById('test');
    var ac = this.ac = geoplete(input);

    assert.ok(ac, 'should create autocomplete object');
  });
});
