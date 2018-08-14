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

  it('matching', function (done) {
    var input = document.getElementById('test'), count = 0;
    this.ac = geoplete(input, {
      type: 'place',
      geocoder: {
        order: ['synchronous'],
        synchronous_parameters: {
          response: function (query) {
            count += 1;
            if (query.place === 'san franc') {
              return [
                { place: 'San Francisco, Ciudad Santa Catarina, Nuevo León, Mexico' },
                { place: 'San Francisco, Agua Prieta, Sonora, Mexico' },
                { place: 'San Francisco, Soledad de Graciano Sánchez, San Luis Potosí, Mexico' },
                { place: 'San Francisco, Ciudad Melchor Múzquiz, Coahuila de Zaragoza, Mexico' },
                { place: 'San Francisco, Mexico City, Ciudad de México, Mexico' },
                { place: 'San Francisco, Tonalá, Chiapas, Mexico' },
                { place: 'San Francisco, Sombrerete, Zacatecas, Mexico' },
                { place: 'San Francisco, Antofagasta, De Antofagasta, Chile' },
                { place: 'Fazenda Santa Francisca, QUERÃNCIA DO NORTE, Paraná, Brazil' },
                { place: 'Sitio Santo Francisco, Catarina, Ceara, Brazil' }
              ];
            }
            assert.fail();
          }
        },
        synchronous_enable: function () { return true; }
      }
    });
    input.value = 'san franc';
    input.dispatchEvent(new Event('input', {
      'bubbles': true,
      'cancelable': true
    }));
    setTimeout(function () {
      input.value = 'san franci';
      input.dispatchEvent(new Event('input', {
        'bubbles': true,
        'cancelable': true
      }));
      setTimeout(function () {
        assert.equal(count, 1);
        done();
      }, 500);
    }, 500);
  });
});

