import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import jsdomGlobal from 'jsdom-global';
import geoplete from '../lib/geoplete.js';

describe('geoplete', () => {
  before(function () {
    this.jsdom = jsdomGlobal();
  });

  after(function () {
    this.jsdom();
  });

  beforeEach(() => {
    document.body.innerHTML = '<input id="test" type="text">';
  });

  afterEach(function () {
    this.ac.destroy();
  });

  it('attach', function () {
    const input = document.getElementById('test');
    const ac = (this.ac = geoplete(input));

    assert.ok(ac, 'should create autocomplete object');
  });

  it('matching', function (_, done) {
    const input = document.getElementById('test');
    let count = 0;
    this.ac = geoplete(input, {
      type: 'place',
      geocoder: {
        order: ['synchronous'],
        synchronous_parameters: {
          response(query) {
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
        synchronous_enable() {
          return true;
        }
      }
    });
    input.value = 'san franc';
    input.dispatchEvent(
      new Event('input', {
        bubbles: true,
        cancelable: true
      })
    );
    setTimeout(() => {
      input.value = 'san franci';
      input.dispatchEvent(
        new Event('input', {
          bubbles: true,
          cancelable: true
        })
      );
      setTimeout(() => {
        assert.equal(count, 1);
        done();
      }, 500);
    }, 500);
  });
});
