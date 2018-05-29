require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
module.exports = require('./lib/geoplete');

},{"./lib/geoplete":3}],3:[function(require,module,exports){
const Awesomplete = require('@melitele/awesomplete');
const furkotGeocode = require('@furkot/geocode');
const debounce = require('debounce');

module.exports = geoplete;

/* global AbortController */

const Suggestions = {
  'address': {
    toString() { return this.address || this.place; }
  },
  'place': {
    toString() { return this.place || this.address; }
  }
};

const keepOpen = {
  esc: true
};

function displayAll() {
  return true;
}

function geoQuery(query) {
  return query;
}

function regExpEscape(s) {
  return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
}

function geoplete(el, options) {
  options = options || {};
  options.type = Suggestions[options.type] ? options.type : 'address';
  options.minChars = options.minChars || 4;
  options.trigger = options.trigger || trigger;

  options.geoQuery = options.geoQuery || geoQuery;
  options.minMatching = options.minMatching || 2;
  options.filterMatches = options.filterMatches || filterMatches;
  const acOptions = {
    minChars: 0,
    filter: displayAll,
    sort: options.sort
  };
  if (options.item) {
    acOptions.item = options.item;
  }
  if (options.container) {
    acOptions.container = options.container;
  }


  const geoOptions = options.geocoder;

  let lastValue;
  let abortController;
  const geocode = furkotGeocode(geoOptions);
  const ac = new Awesomplete(el, acOptions);

  if (options.keepOpen) {
    ac.close = function (close, o) {
      if (o && o.reason && keepOpen[o.reason]) {
        return;
      }
      close.apply(this, Array.prototype.slice.call(arguments, 1));
    }.bind(ac, ac.close);
    el.removeEventListener('blur', ac._events.input.blur);
  }

  const oninput = debounce(function() {
    const value = el.value.trim();
    if (!options.trigger(value)) {
      populate([]);
      return;
    }
    query(value);
  }, 300);

  function trigger(value) {
    return value.length >= options.minChars;
  }

  function onchange(event) {
    const value = event.text.value;
    const changeEvent = new CustomEvent('geoplete-change', { detail: value });
    el.dispatchEvent(changeEvent);
  }

  function fromPlace(place) {
    return Object.assign(Object.create(Suggestions[options.type]), place);
  }

  function filterMatches(result, value) {
    value = new RegExp(regExpEscape(value), 'i');
    return result.filter(function (entry) {
      return value.test(entry);
    });
  }

  function matching(lastValue, value, bounds) {
    if (!lastValue || lastValue.bounds !== bounds) {
      return;
    }
    if (lastValue.value === value) {
      return lastValue;
    }
    if (lastValue.value.length > value.length) {
      return;
    }
    if (!(lastValue.result && lastValue.result.length)) {
      return;
    }
    const result = options.filterMatches(lastValue.result, value);
    if (result.length >= Math.min(options.minMatching, lastValue.result.length)) {
      lastValue.value = value;
      lastValue.result = result;
      return lastValue;
    }
  }

  async function query(value) {
    if (matching(lastValue, value, options.bounds)) {
      // do not requery for the same value or when there are enough matching entries
      if (lastValue.result) {
        populate(lastValue.result);
      }
      return;
    }
    if (abortController) {
      abortController.abort();
    }
    const params = {
      partial: true,
      bounds: options.bounds,
      lang: options.lang || document.lang || 'en'
    };
    params[options.type] = value;
    lastValue = {
      value,
      bounds: options.bounds
    };
    try {
      el.classList.add('geoplete-in-progress');
      abortController = new AbortController();
      const result = await geocode(options.geoQuery(params), { signal: abortController.signal });
      if (result && result.places) {
        lastValue.result = result.places.map(fromPlace);
        populate(lastValue.result, result);
      }
    } catch (error) {
      // ignore abort and timeout errors
      if (error.name !== "AbortError" && error.cause !== Symbol.for('timeout')) {
        throw error;
      }
    } finally {
      abortController = undefined;
      el.classList.remove('geoplete-in-progress');
    }
  }

  function populate(places, result) {
    ac.list = places;
    ac.evaluate();
    if (result && places) {
      places = places.slice();
      places.provider = result.provider;
      places.stats = result.stats;
    }
    const listEvent = new CustomEvent('geoplete-list', { detail: places });
    el.dispatchEvent(listEvent);
  }

  function destroy() {
    el.removeEventListener('input', oninput);
    el.removeEventListener('awesomplete-selectcomplete', onchange);
    ac.destroy();
  }

  function set(property, value) {
    options[property] = value;
  }

  el.addEventListener('input', oninput);
  el.addEventListener('awesomplete-selectcomplete', onchange);

  return {
    populate,
    set,
    destroy
  };
}

},{"@furkot/geocode":17,"@melitele/awesomplete":32,"debounce":33}],4:[function(require,module,exports){
module.exports = require('./lib');

},{"./lib":12}],5:[function(require,module,exports){
const normalize = require('./normalize');
const parse = require('./parse');
const prettify = require('./prettify');
const stringify = require('./stringify');

module.exports = {
  normalize,
  parse,
  prettify,
  stringify
};

},{"./normalize":6,"./parse":7,"./prettify":8,"./stringify":9}],6:[function(require,module,exports){
const { country2abbr } = require('../country');
const { abbr2state, state2abbr, state2country } = require('../state');

module.exports = normalize;

/**
 * Normalizes an address
 * @param {*} address
 * @returns {string}
 *
 * @example
 * normalize('123 Main St, Los Angeles, California'); // => '123 Main St,Los Angeles,CA,US'
 */
function normalize(address) {

  if (!address) {
    return address;
  }

  let [country, state, town, street] = address.split(',').map(part => part.trim()).reverse();

  if (country2abbr[country]) {
    country = country2abbr[country];
  }
  else {
    const _state = getState(country);
    const _country = state2country[_state];
    if (_state && _country) {
      street = town;
      town = state;
      state = _state;
      country = _country;
    }
  }
  state = getState(state);
  if (state && !(street || abbr2state[state])) {
    street = town;
    town = state;
    state = '';
  }

  return [street, town, state, country].map(part => part || '').join(',').replace(/^,+/, '');
}

function getState(state) {
  let usState = /^([a-zA-Z]{2})(\s+\d{5}(?:-\d{4})?)?$/.exec(state);
  if (usState) {
    usState = usState[1].toUpperCase();
  }
  if (usState) {
    state = usState;
  }
  else {
    state = state2abbr[state] || state;
  }
  return state;
}

},{"../country":11,"../state":14}],7:[function(require,module,exports){
const { abbr2country } = require('../country');
const { state2country } = require('../state');

module.exports = parse;

/**
 * Parses an address string
 * @param {string} address the address string
 * @returns {Object} the parsed address
 *
 * @example
 * parse('1 street,town,province,country');
 * // => { house: '1', street: 'street', town: 'town', province: 'province', country: 'country' }
 */
function parse(address) {
  if (!address) {
    return;
  }
  const parts = address.split(',');
  if (parts.length > 4) {
    return; // don't even try to parse
  }
  while (parts.length < 4) {
    parts.unshift('');
  }
  let [street, town, province, country] = parts;
  if (!country && province) {
    country = state2country[province];
  }
  if (country === 'US') {
    country = 'USA';
  }
  else {
    country = abbr2country[country] || country;
  }
  // extract number from street
  let house = street.match(/^\d+[^\s]\s/);
  if (house) {
    street = street.replace(house, '');
    house = house[0].trim();
  }
  return Object.entries({
    house,
    street,
    town,
    province,
    country
  }).reduce((obj, [key, value]) => {
    if (value) {
      obj[key] = value;
    }
    return obj;
  }, {});
}

},{"../country":11,"../state":14}],8:[function(require,module,exports){
module.exports = prettify;

const {
  abbr2country
} = require('../country');
const { abbr2state } = require('../state');

/**
 * Makes and address more readeable
 * @param {string} address
 * @returns {string}
 *
 * @example
 * prettify('1 street,city,state,country'); // => '1 street, city, state, country'
 * prettify('1 street,,state,country'); // => '1 street, state, country'
 * prettify(',city,,country'); // => 'city, country'
 * prettify('city,,country'); // => 'city, country'
 */
function prettify(address) {
  if (!address) {
    return '';
  }
  const parts = address.split(',').map(part => part.trim());
  if (parts.length > 4) {
    return pretty(parts);
  }
  while (parts.length < 4) {
    parts.unshift('');
  }
  parts[3] = abbr2country[parts[3]] || parts[3];
  if (!(parts[0] || parts[1])) {
    if (!parts[2]) {
      return parts[3];
    }
    parts[2] = abbr2state[parts[2]] || parts[2];
    if (parts[3] === 'United States') {
      parts[3] = 'USA';
    }
  }
  if (parts[3] === 'United States') {
    parts.length = 3;
  }
  else {
    if (parts[1] === parts[2]) {
      parts.splice(2, 1);
    }
  }
  return pretty(parts);
}

function pretty(parts) {
  return parts.filter(Boolean).join(', ');
}

},{"../country":11,"../state":14}],9:[function(require,module,exports){
module.exports = stringify;

const {
  country2abbr
} = require('../country');

const {
  state2abbr,
  state2country
} = require('../state');

/**
 * Stringifies an address specification.
 * @param {Object} spec - The address specification.
 * @returns {string} - The stringified address.
 *
 * @example
 * stringify({ house: 1, street: 'street', town: 'town', province: 'province', country: 'country' });
 * // => '1 street,town,province,country'
 *
 * stringify({ house: 1, street: 'street', province: 'province'});
 * // => '1 street,,province,country'
 *
 * stringify({ house: 1, street: 'street', province: 'province'});
 * // => '1 street,,province,'
 *
 * stringify({ house: 1, town: 'town', country: 'country' });
 * // => '1,town,,country'
 *
 * stringify({ street: 'street', town: 'town' });
 * // => 'street,town,,'
 *
 *  * stringify({});
 * // => ''
 *
 * stringify();
 * // => undefined
 */
function stringify(spec) {
  if (!spec) {
    return;
  }

  let { house, street, town, province, country } = spec;

  country = country2abbr[country] || country;
  province = state2abbr[province] || province;
  if (!country) {
    country = state2country[province];
  }

  if (house) {
    if (street) {
      street = [house, street].join(' ');
    }
    else {
      street = house;
    }
  }

  return [street, town, province, country].map(p => p ?? '').join(',').replace(/^,+/, '');
}

},{"../country":11,"../state":14}],10:[function(require,module,exports){
module.exports={
  "AD": "Andorra",
  "AE": "United Arab Emirates",
  "AF": "Afghanistan",
  "AG": "Antigua and Barbuda",
  "AI": "Anguilla",
  "AL": "Albania",
  "AM": "Armenia",
  "AO": "Angola",
  "AQ": "Antarctica",
  "AR": "Argentina",
  "AS": "American Samoa",
  "AT": "Austria",
  "AU": "Australia",
  "AW": "Aruba",
  "AX": "Aland Islands",
  "AZ": "Azerbaijan",
  "BA": "Bosnia and Herzegovina",
  "BB": "Barbados",
  "BD": "Bangladesh",
  "BE": "Belgium",
  "BF": "Burkina Faso",
  "BG": "Bulgaria",
  "BH": "Bahrain",
  "BI": "Burundi",
  "BJ": "Benin",
  "BL": "Saint Barthelemy",
  "BM": "Bermuda",
  "BN": "Brunei",
  "BO": "Bolivia",
  "BQ": "Caribbean Netherlands",
  "BR": "Brazil",
  "BS": "Bahamas",
  "BT": "Bhutan",
  "BV": "Bouvet Island",
  "BW": "Botswana",
  "BY": "Belarus",
  "BZ": "Belize",
  "CA": "Canada",
  "CC": "Cocos (Keeling) Islands",
  "CD": "Democratic Republic of Congo",
  "CF": "Central African Republic",
  "CG": "Congo",
  "CH": "Switzerland",
  "CI": "Ivory Coast",
  "CK": "Cook Islands",
  "CL": "Chile",
  "CM": "Cameroon",
  "CN": "China",
  "CO": "Colombia",
  "CR": "Costa Rica",
  "CU": "Cuba",
  "CV": "Cape Verde",
  "CW": "Curacao",
  "CX": "Christmas Island",
  "CY": "Cyprus",
  "CZ": "Czech Republic",
  "DE": "Germany",
  "DJ": "Djibouti",
  "DK": "Denmark",
  "DM": "Dominica",
  "DO": "Dominican Republic",
  "DZ": "Algeria",
  "EC": "Ecuador",
  "EE": "Estonia",
  "EG": "Egypt",
  "EH": "Western Sahara",
  "ER": "Eritrea",
  "ES": "Spain",
  "ET": "Ethiopia",
  "FI": "Finland",
  "FJ": "Fiji",
  "FK": "Falkland Islands",
  "FM": "Federated States of Micronesia",
  "FO": "Faroe Islands",
  "FR": "France",
  "GA": "Gabon",
  "GB": "United Kingdom",
  "GD": "Grenada",
  "GE": "Georgia",
  "GF": "French Guiana",
  "GG": "Guernsey",
  "GH": "Ghana",
  "GI": "Gibraltar",
  "GL": "Greenland",
  "GM": "Gambia",
  "GN": "Guinea",
  "GP": "Guadeloupe",
  "GQ": "Equatorial Guinea",
  "GR": "Greece",
  "GS": "South Georgia and the South Sandwich Islands",
  "GT": "Guatemala",
  "GU": "Guam",
  "GW": "Guinea-Bissau",
  "GY": "Guyana",
  "HK": "Hong Kong",
  "HM": "Heard and McDonald Islands",
  "HN": "Honduras",
  "HR": "Croatia",
  "HT": "Haiti",
  "HU": "Hungary",
  "ID": "Indonesia",
  "IE": "Ireland",
  "IL": "Israel",
  "IM": "Isle of Man",
  "IN": "India",
  "IO": "British Indian Ocean Territory",
  "IQ": "Iraq",
  "IR": "Iran",
  "IS": "Iceland",
  "IT": "Italy",
  "JE": "Jersey",
  "JM": "Jamaica",
  "JO": "Jordan",
  "JP": "Japan",
  "KE": "Kenya",
  "KG": "Kyrgyzstan",
  "KH": "Cambodia",
  "KI": "Kiribati",
  "KM": "Comoros",
  "KN": "Saint Kitts and Nevis",
  "KP": "North Korea",
  "KR": "South Korea",
  "KW": "Kuwait",
  "KY": "Cayman Islands",
  "KZ": "Kazakhstan",
  "LA": "Lao People's Democratic Republic",
  "LB": "Lebanon",
  "LC": "Saint Lucia",
  "LI": "Liechtenstein",
  "LK": "Sri Lanka",
  "LR": "Liberia",
  "LS": "Lesotho",
  "LT": "Lithuania",
  "LU": "Luxembourg",
  "LV": "Latvia",
  "LY": "Libya",
  "MA": "Morocco",
  "MC": "Monaco",
  "MD": "Moldova",
  "ME": "Montenegro",
  "MF": "Saint-Martin",
  "MG": "Madagascar",
  "MH": "Marshall Islands",
  "MK": "North Macedonia",
  "ML": "Mali",
  "MM": "Myanmar",
  "MN": "Mongolia",
  "MO": "Macau",
  "MP": "Northern Mariana Islands",
  "MQ": "Martinique",
  "MR": "Mauritania",
  "MS": "Montserrat",
  "MT": "Malta",
  "MU": "Mauritius",
  "MV": "Maldives",
  "MW": "Malawi",
  "MX": "Mexico",
  "MY": "Malaysia",
  "MZ": "Mozambique",
  "NA": "Namibia",
  "NC": "New Caledonia",
  "NE": "Niger",
  "NF": "Norfolk Island",
  "NG": "Nigeria",
  "NI": "Nicaragua",
  "NL": "The Netherlands",
  "NO": "Norway",
  "NP": "Nepal",
  "NR": "Nauru",
  "NU": "Niue",
  "NZ": "New Zealand",
  "OM": "Oman",
  "PA": "Panama",
  "PE": "Peru",
  "PF": "French Polynesia",
  "PG": "Papua New Guinea",
  "PH": "Philippines",
  "PK": "Pakistan",
  "PL": "Poland",
  "PM": "St. Pierre and Miquelon",
  "PN": "Pitcairn",
  "PR": "Puerto Rico",
  "PS": "Palestine",
  "PT": "Portugal",
  "PW": "Palau",
  "PY": "Paraguay",
  "QA": "Qatar",
  "RE": "Reunion",
  "RO": "Romania",
  "RS": "Serbia",
  "RU": "Russia",
  "RW": "Rwanda",
  "SA": "Saudi Arabia",
  "SB": "Solomon Islands",
  "SC": "Seychelles",
  "SD": "Sudan",
  "SE": "Sweden",
  "SG": "Singapore",
  "SH": "Saint Helena, Ascension and Tristan da Cunha",
  "SI": "Slovenia",
  "SJ": "Svalbard and Jan Mayen Islands",
  "SK": "Slovakia",
  "SL": "Sierra Leone",
  "SM": "San Marino",
  "SN": "Senegal",
  "SO": "Somalia",
  "SR": "Suriname",
  "SS": "South Sudan",
  "ST": "Sao Tome and Principe",
  "SV": "El Salvador",
  "SX": "Sint Maarten",
  "SY": "Syria",
  "SZ": "Eswatini",
  "TC": "Turks and Caicos Islands",
  "TD": "Chad",
  "TF": "French Southern Territories",
  "TG": "Togo",
  "TH": "Thailand",
  "TJ": "Tajikistan",
  "TK": "Tokelau",
  "TL": "Timor-Leste",
  "TM": "Turkmenistan",
  "TN": "Tunisia",
  "TO": "Tonga",
  "TR": "Turkey",
  "TT": "Trinidad and Tobago",
  "TV": "Tuvalu",
  "TW": "Taiwan",
  "TZ": "Tanzania",
  "UA": "Ukraine",
  "UG": "Uganda",
  "UM": "United States Minor Outlying Islands",
  "US": "United States",
  "UY": "Uruguay",
  "UZ": "Uzbekistan",
  "VA": "Vatican",
  "VC": "Saint Vincent and the Grenadines",
  "VE": "Venezuela",
  "VG": "British Virgin Islands",
  "VI": "US Virgin Islands",
  "VN": "Vietnam",
  "VU": "Vanuatu",
  "WF": "Wallis and Futuna Islands",
  "WS": "Samoa",
  "XK": "Kosovo",
  "YE": "Yemen",
  "YT": "Mayotte",
  "ZA": "South Africa",
  "ZM": "Zambia",
  "ZW": "Zimbabwe"
}

},{}],11:[function(require,module,exports){
const { keys2values } = require('../util');

const abbr2country = require('./countries.json');
const country2abbr = keys2values(abbr2country);

// add some aliases
country2abbr['Brasil'] = 'BR';
country2abbr['Polska'] = 'PL';
country2abbr['United States'] = 'US';
country2abbr['United States of America'] = 'US';
country2abbr.USA = 'US';

module.exports = {
  country2abbr,
  abbr2country
};

},{"../util":16,"./countries.json":10}],12:[function(require,module,exports){
const address = require('./address');
const country = require('./country');
const state = require('./state');

module.exports = {
  ...address,
  ...country,
  ...state
};

},{"./address":5,"./country":11,"./state":14}],13:[function(require,module,exports){
module.exports={
  "Alberta": "AB",
  "British Columbia": "BC",
  "Manitoba": "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  "Northwest Territories": "NT",
  "Nova Scotia": "NS",
  "Nunavut": "NU",
  "Ontario": "ON",
  "Prince Edward Island": "PE",
  "Quebec": "QC",
  "Saskatchewan": "SK",
  "Yukon": "YT"
}

},{}],14:[function(require,module,exports){
const { keys2values } = require('../util');

const country2states = {
  CA: keys2values(require('./ca.json')),
  US: keys2values(require('./us.json'))
};

const abbr2state = Object.assign(Object.create(null), country2states.US, country2states.CA);
const state2abbr = keys2values(abbr2state);
const state2country = Object.entries(country2states).reduce(
  (obj, [country, states]) => Object.assign(obj, Object.keys(states).reduce(
    (obj, state) => {
      obj[state] = country;
      return obj;
    }, obj)),
  Object.create(null));

module.exports = {
  abbr2state,
  country2states,
  state2abbr,
  state2country
};

},{"../util":16,"./ca.json":13,"./us.json":15}],15:[function(require,module,exports){
module.exports={
  "Alabama": "AL",
  "Alaska": "AK",
  "Arizona": "AZ",
  "Arkansas": "AR",
  "California": "CA",
  "Colorado": "CO",
  "Connecticut": "CT",
  "Delaware": "DE",
  "District of Columbia": "DC",
  "Florida": "FL",
  "Georgia": "GA",
  "Hawaii": "HI",
  "Idaho": "ID",
  "Illinois": "IL",
  "Indiana": "IN",
  "Iowa": "IA",
  "Kansas": "KS",
  "Kentucky": "KY",
  "Louisiana": "LA",
  "Maine": "ME",
  "Montana": "MT",
  "Nebraska": "NE",
  "Nevada": "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  "Ohio": "OH",
  "Oklahoma": "OK",
  "Oregon": "OR",
  "Maryland": "MD",
  "Massachusetts": "MA",
  "Michigan": "MI",
  "Minnesota": "MN",
  "Mississippi": "MS",
  "Missouri": "MO",
  "Pennsylvania": "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  "Tennessee": "TN",
  "Texas": "TX",
  "Utah": "UT",
  "Vermont": "VT",
  "Virginia": "VA",
  "Washington": "WA",
  "West Virginia": "WV",
  "Wisconsin": "WI",
  "Wyoming": "WY"
}

},{}],16:[function(require,module,exports){
module.exports = {
  keys2values,
  str2obj
};

/**
 * Swaps keys of an object with their values.
 * @param {Object} obj - The object to swap.
 * @returns {Object} - The swapped object.
 * @example
 * const obj = { a: 1, b: 2, c: 3 };
 * const swapped = keys2values(obj);
 * console.log(swapped);
 * // => { 1: 'a', 2: 'b', 3: 'c' }
 */
function keys2values(obj) {
  return Object.entries(obj).reduce((obj, [k, v]) => {
    obj[v] = k;
    return obj;
  }, Object.create(null));
}

/**
 * Turns a comma-separated string into an object.
 * @param {string} str - The string to parse.
 * @returns {Object} - The parsed object.
 * @example
 * const str = 'a,b,"c d"';
 * const obj = str2obj(str);
 * console.log(obj);
 * // => { a: true, b: true, 'c d': true }
 */
function str2obj(str) {
  return str.split(',').reduce((obj, key) => {
    obj[key] = true;
    return obj;
  }, Object.create(null));
}

},{}],17:[function(require,module,exports){
module.exports = require('./lib/geocode');

},{"./lib/geocode":18}],18:[function(require,module,exports){
const util = require('./service/util');

module.exports = furkotGeocode;

//default timeout to complete operation
const defaultTimeout = 20 * 1000;
let id = 0;

function furkotGeocode(options) {
  const services = {
    geocodio: {
      init: require('./service/geocodio')
    },
    graphhopper: {
      init: require('./service/graphhopper')
    },
    hogfish: {
      init: require('./service/hogfish')
    },
    locationiq: {
      init: require('./service/locationiq')
    },
    opencage: {
      init: require('./service/opencage')
    },
    pelias: {
      init: require('./service/pelias')
    },
    positionstack: {
      init: require('./service/positionstack')
    },
    synchronous: {
      init: require('./service/synchronous')
    },
    maptiler: {
      init: require('./service/maptiler')
    }
  };

  options = util.defaults(options, {
    timeout: defaultTimeout,
    order: ['opencage']
  });
  const operations = { ...options };
  ['forward', 'reverse'].forEach(op => {
    if (operations[op]) {
      return;
    }
    operations[op] = options.order.flatMap(name => {
      const service = services[options[name] || name];
      if (service && options[name + '_enable'] &&
        (!options[name + '_parameters'] || options[name + '_parameters'][op] !== false)) {
        if (!service.service) {
          const defaults = {
            name,
            limiter: options[(name + '_limiter')],
            enable: options[(name + '_enable')]
          };
          if (options[name]) {
            Object.keys(options).reduce(mapOptions, {
              options,
              name,
              optName: options[name],
              defaults
            });
          }
          service.service = service.init(util.defaults(defaults, options));
        }
        if (service.service[op] && service.service.geocode) {
          const operation = service.service.geocode.bind(undefined, op);
          operation.abort = service.service.abort;
          operation.provider = name;
          return [operation];
        }
      }
      return [];
    });
  });
  geocode.options = operations;
  return geocode;

  async function geocode(query, { signal } = {}) {
    if (!query) {
      return;
    }
    const op = query.ll ? 'reverse' : 'forward';
    if (!operations[op]?.length) {
      return;
    }
    if (signal) {
      signal.onabort = abort;
    }

    let aborted;
    let currentOperation;
    const queryId = ++id;
    query.max = query.max || options.max;

    return util.withTimeout(request(), options.timeout);

    async function request() {
      const stats = [];
      for (const operation of operations[op]) {
        stats.push(operation.provider);
        currentOperation = operation;
        const result = await operation(queryId, query);
        currentOperation = undefined;
        signal?.throwIfAborted();
        if (!result) {
          continue;
        }
        result.stats = stats;
        result.provider = operation.provider;
        if (result.places && (query.address || query.place)) {
          const places = result.places.filter(query.place ? isPlace : isAddress);
          if (places.length) {
            result.places = places;
          }
        }
        if (query.max > 0 && result.places?.length > query.max) {
          result.places.length = query.max;
        }
        return result;
      }
    }

    function abort() {
      if (!aborted) {
        aborted = true;
        // cancel outstanding request
        currentOperation?.abort?.(queryId);
      }
    }
  }
}

function isPlace(place) {
  return place.place || !place.street;
}

function isAddress(place) {
  return !place.place;
}

function mapOptions(result, opt) {
  if (opt.startsWith(result.name)) {
    result.defaults[opt.replace(result.name, result.optName)] = result.options[opt];
  }
  return result;
}

},{"./service/geocodio":19,"./service/graphhopper":20,"./service/hogfish":21,"./service/locationiq":23,"./service/maptiler":24,"./service/opencage":26,"./service/pelias":27,"./service/positionstack":28,"./service/synchronous":30,"./service/util":31}],19:[function(require,module,exports){
const normalize = require('../normalize');
const status = require('../status');
const util = require('../util');

module.exports = init;

function getStatus(err, response) {
  if (err) {
    switch (err.status) {
      case 403:
        return status.failure;
      case 422:
        return status.empty;
      case 500:
        return status.error;
    }
  }
  if (!response || response.error || !response.results || response.results.length === 0) {
    return status.empty;
  }
  return status.success;
}

function getUrl(url, key, op, query) {
  const q = [];
  let verb;
  switch (op) {
    case 'forward':
      verb = 'geocode';
      q.push('q=' + encodeURIComponent(query.address || query.place));
      break;
    case 'reverse':
      verb = 'reverse';
      q.push('q=' + query.ll[1] + ',' + query.ll[0]); // latitude, longitude
      break;
    default:
      // invalid operation
      return;
  }
  q.push('api_key=' + key);
  return url + verb + '?' + q.join('&');
}

function prepareRequest() {
  return true;
}

function map(f) {
  const address = f.address_components;
  const location = f.location;
  const place = {
    ll: [location.lng, location.lat],
    place: f.name,
    house: address.number,
    street: address.formatted_street,
    town: address.city,
    county: address.county,
    province: address.state,
    country: normalize.country(address.country)
  };

  // remove empties
  return util.removeEmpties(place);
}

function processResponse(response, query, result) {
  result.places = response.results.map(map);
  return result;
}

function init(options) {
  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
      options.geocodio_url || 'https://api.geocod.io/v1.7/',
      options.geocodio_key),
    status: getStatus,
    prepareRequest,
    processResponse
  });
  if (options.geocodio_parameters) {
    options = util.defaults(options, options.geocodio_parameters);
  }
  return require('..')(options);
}

},{"..":22,"../normalize":25,"../status":29,"../util":31}],20:[function(require,module,exports){
const normalize = require('../normalize');
const status = require('../status');
const util = require('../util');

module.exports = init;

/*
 * https://graphhopper.com/api/1/docs/geocoding/
 */

function getStatus(err, response) {
  if (!response || !response.hits || response.hits.length === 0) {
    return status.empty;
  }
  return status.success;
}

function getUrl(url, key, op, query) {
  const q = [];
  if (query.max) {
    q.push('limit=' + query.max);
  }
  switch (op) {
    case 'forward':
      q.push('q=' + encodeURIComponent(query.address || query.place));
      if (query.bounds) {
        const ll = [
          (query.bounds[0][0] + query.bounds[1][0]) / 2,
          (query.bounds[0][1] + query.bounds[1][1]) / 2
        ];
        q.push('point=' + ll[1] + ',' + ll[0]); // latitude, longitude
      }
      if (query.partial) {
        q.push('autocomplete=true');
      }
      break;
    case 'reverse':
      q.push('reverse=true');
      q.push('point=' + query.ll[1] + ',' + query.ll[0]); // latitude, longitude
      break;
    default:
      // invalid operation
      return;
  }
  if (query.lang) {
    q.push('locale=' + query.lang);
  }
  q.push('key=' + key);
  return url + '?' + q.join('&');
}

function prepareRequest() {
  return true;
}

function map(f) {
  const place = {
    ll: [f.point.lng, f.point.lat],
    type: f.osm_value,
    house: f.housenumber,
    street: f.street,
    town: f.city,
    province: normalize.state(f.state),
    country: normalize.country(f.country)
  };
  if (!place.street && f.osm_key === 'highway') {
    place.street = f.name;
  }
  if (f.name !== place.street &&
    f.name !== place.town) {
    place.place = f.name;
  }

  // remove empties
  return util.removeEmpties(place);
}

function processResponse(response, query, result) {
  const hits = response.hits;
  result.places = hits.map(map);
  return result;
}

function init(options) {
  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
      options.graphhopper_url || 'https://graphhopper.com/api/1/geocode',
      options.graphhopper_key),
    status: getStatus,
    prepareRequest,
    processResponse
  });
  if (options.graphhopper_parameters) {
    options = util.defaults(options, options.graphhopper_parameters);
  }
  return require('..')(options);
}

},{"..":22,"../normalize":25,"../status":29,"../util":31}],21:[function(require,module,exports){
const status = require('../status');
const util = require('../util');

module.exports = init;

function getStatus(err, response) {
  if (err) {
    return status.failure;
  }
  if (!response) {
    return status.error;
  }
  if (response.length === 0) {
    return status.empty;
  }
  return status.success;
}

function getUrl(url, types, op, query) {
  const q = [];
  switch (op) {
    case 'reverse':
      q.push('ll=' + query.ll.join(','));
      q.push('radius=100');
      break;
      case 'forward':
        q.push('q=' + encodeURIComponent(query.place || query.address));
        if (query.bounds) {
          q.push('sw=' + query.bounds[0].join(','));
          q.push('ne=' + query.bounds[1].join(','));
        }
        break;
      default:
      // invalid operation
      return;
  }
  q.push(...types[query.type]);
  if (query.max) {
    q.push('limit=' + query.max);
  }
  return url + '?' + q.join('&');
}

function prepareRequest(types, op, query) {
  if (op === 'forward') {
    query.type = query.type ?? ['place', 'address'].find(type => query.hasOwnProperty(type));
  }
  return Boolean(types[query.type]);
}

function matchNames(n1, n2) {
  if (n1.length > n2.length) {
    const n = n1;
    n1 = n2;
    n2 = n;
  }
  n1 = n1.split(' ');
  return n1.some(function (n) {
    const result = this;
    if (result.name.indexOf(n) > -1) {
      result.words -= 1;
      if (!result.words) {
        return true;
      }
    }
  }, {
    name: n2,
    words: Math.min(n1.length, 2)
  });
}

function isCloser(result, place) {
  const dist = Math.pow(result.ll[0] - place.ll[0], 2) + Math.pow(result.ll[1] - place.ll[1], 2);
  if (result.distance === undefined || dist < result.distance) {
    result.distance = dist;
    return true;
  }
}

function findPlace(result, place) {
  if ((!result.place || (place.name && matchNames(place.name, result.place))) &&
    isCloser(result, place)) {
    place.type = result.type;
    result[0] = place;
  }
  return result;
}

function map(f) {
  const place = {
    ll: f.ll,
    place: f.name,
    url: f.url,
    street: f.address,
    town: f.city,
    province: f.state,
    country: f.country,
    type: f.type,
    service: f.service
  };

  // remove empties
  return util.removeEmpties(place);
}

function filterResponse(query, response) {
  if (!(query.ll && query.type)) {
    return response;
  }
  const places = [];
  places.type = query.type;
  places.place = query.place;
  places.ll = query.ll;
  return response.reduce(findPlace, places);
}

function processResponse(response, query, result) {
  result.places = filterResponse(query, response).map(map);
  return result;
}

function init(options) {
  if (options.hogfish_parameters) {
    options = util.defaults(options, options.hogfish_parameters);
  }
  options = util.defaults(options, {
    reverse: true,
    forward: true,
    url: getUrl.bind(undefined, options.hogfish_url, options.types),
    status: getStatus,
    prepareRequest: prepareRequest.bind(undefined, options.types),
    processResponse
  });
  return require('..')(options);
}

},{"..":22,"../status":29,"../util":31}],22:[function(require,module,exports){
const fetchagent = require('fetchagent');
const makeLimiter = require('limiter-component');
const debug = require('debug')('furkot:geocode:service');

const status = require('./status');
const util = require('./util');

module.exports = init;

const limiters = {};

const ABORT_TO_FAILURE = 3; // max number of aborted requests before shutting down service

function request(url, req, fn) {
  const options = this;
  let fa = fetchagent;
  if (options.post) {
    fa = fa.post(url).send(req);
  } else {
    fa = fa.get(url).query(req);
  }
  return fa
    .set('accept', 'application/json')
    .end(fn);
}

function initUrl(url) {
  return typeof url === 'function' ? url : () => url;
}

function init(options) {
  let holdRequests;
  let abortCounter = 0;
  const outstanding = {};

  options = util.defaults(options, {
    interval: 340,
    penaltyInterval: 2000,
    limiter: limiters[options.name],
    request,
    abort
  });
  options.url = initUrl(options.url);
  limiters[options.name] = options.limiter || makeLimiter(options.interval, options.penaltyInterval);
  const limiter = limiters[options.name];

  return {
    forward: options.forward,
    reverse: options.reverse,
    geocode,
    abort: options.abort
  };

  function abort(queryId) {
    debug('abort', queryId);
    if (!outstanding[queryId]) {
      return;
    }
    const { laterTimeoutId, reqInProgress} = outstanding[queryId];
    // cancel later request if scheduled
    if (laterTimeoutId) {
      clearTimeout(laterTimeoutId);
    }
    // cancel request in progress
    reqInProgress?.abort?.();
    abortCounter += 1;
    if (abortCounter >= ABORT_TO_FAILURE) {
      // don't ever ask again
      holdRequests = true;
    }
    outstanding[queryId].resolveOnAbort();
  }

  function geocode(op, queryId, query) {
    const fns = {};
    const promise = new Promise(resolve => fns.resolve = resolve);

    outstanding[queryId] = { resolve, resolveOnAbort };
    executeQuery();
    return promise;

    function resolve(result) {
      abortCounter = 0;
      delete outstanding[queryId];
      fns.resolve(result);
    }

    function resolveOnAbort() {
      delete outstanding[queryId];
      fns.resolve();
    }

    function requestLater() {
      outstanding[queryId].laterTimeoutId = setTimeout(function () {
        if (outstanding[queryId]) {
          delete outstanding[queryId].laterTimeoutId;
        }
        executeQuery();
      }, options.penaltyTimeout);
    }

    function executeQuery() {
      if (!outstanding[queryId]) {
        // query has been aborted
        return;
      }

      const { resolve } = outstanding[queryId];
      if (holdRequests) {
        return resolve();
      }
      if (options.enable && !options.enable(query)) {
        return resolve();
      }
      let req = options.prepareRequest(op, query);
      if (!req) {
        return resolve();
      }
      if (req === true) {
        req = undefined;
      }

      limiter.trigger(executeQueryTriggered);

      function executeQueryTriggered() {
        if (!outstanding[queryId]) {
          // query has been aborted
          limiter.skip(); // immediately process the next request in the queue
          return;
        }
        outstanding[queryId].reqInProgress = options.request(options.url(op, query), req, function (err, response) {
          if (!outstanding[queryId]) {
            // query has been aborted
            return;
          }
          delete outstanding[queryId].reqInProgress;
          switch (options.status(err, response)) {
            case status.success:
              const res = options.processResponse(response, query, {});
              res.places?.forEach(p => { p.normal = util.stringify(p) || ''; p.address = util.prettify(p.normal); });
              resolve(res);
              break;
            case status.failure:
              // don't ever ask again
              holdRequests = true;
              resolve();
              break;
            case status.error:
              // try again later
              limiter.penalty();
              requestLater();
              break;
            default:
              resolve();
              break;
          }
        });
      }
    }
  }
}

},{"./status":29,"./util":31,"debug":34,"fetchagent":36,"limiter-component":38}],23:[function(require,module,exports){
const normalize = require('../normalize');
const status = require('../status');
const util = require('../util');

module.exports = init;

/*
 * https://locationiq.org/docs
 */

const DEFAULT_URL = 'api.locationiq.com';

function getStatus(err, response) {
  if (err) {
    if (err.status === 401 ||
      (err.status === 429 && response.error === 'Rate Limited Day')) {
      return status.failure;
    }
    if (err.status === 429 || err.status === 500) {
      return status.error;
    }
    return status.empty;
  }
  if (!response) {
    return status.empty;
  }
  return status.success;
}

function getUrl(url, key, op, query) {
  const q = [];
  let verb;
  switch (op) {
    case 'forward':
      verb = 'search';
      q.push('q=' + encodeURIComponent(query.address || query.place));
      if (query.max) {
        q.push('limit=' + query.max);
      }
      if (query.bounds) {
        const box = [
          query.bounds[0][0], // left
          query.bounds[0][1], // bottom
          query.bounds[1][0], // right
          query.bounds[1][1] // top
        ].join(',');
        q.push('viewbox=' + box);
        q.push('bounded=1');
      }
      break;
    case 'reverse':
      verb = 'reverse';
      q.push('lon=' + query.ll[0]);
      q.push('lat=' + query.ll[1]);
      break;
    default:
      // invalid operation
      return;
  }
  if (query.lang) {
    q.push('accept-language=' + query.lang);
  }
  q.push('addressdetails=1');
  q.push('normalizecity=1');
  q.push('format=json');
  q.push('key=' + key);
  if (query.partial) {
    url = url
      .replace('us1.locationiq.com', DEFAULT_URL)
      .replace('eu1.locationiq.com', DEFAULT_URL);
  }
  return url + verb + '.php?' + q.join('&');
}

function prepareRequest() {
  return true;
}

function getType(key) {
  const a = this.a;
  const place = this.place;
  if (a[key] === place.place) {
    place.type = key;
    return true;
  }
}

function map(f) {
  const a = f.address;

  const place = {
    ll: [parseFloat(f.lon), parseFloat(f.lat)],
    house: a.house_number,
    street: a.road || a.pedestrian,
    town: a.city,
    province: normalize.state(a.state),
    country: normalize.country(a.country)
  };

  if (f.display_name) {
    place.place = f.display_name.split(',')[0];
    if (!(place.place && Object.keys(a).some(getType, {
        a,
        place
      }))) {
      place.type = f.type || f.class;
    }
    if (place.place === a.house_number ||
      place.place === place.street ||
      place.place === (a.road || a.pedestrian)) {
      delete place.place;
    }
  }

  // remove empties
  return util.removeEmpties(place);
}

function processResponse(places, query, result) {
  if (!Array.isArray(places)) {
    places = [places];
  }
  result.places = places.map(map);
  return result;
}

function init(options) {
  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
      options.locationiq_url || 'https://' + DEFAULT_URL + '/v1/',
      options.locationiq_key),
    status: getStatus,
    prepareRequest,
    processResponse
  });
  if (options.locationiq_parameters) {
    options = util.defaults(options, options.locationiq_parameters);
  }
  return require('..')(options);
}

},{"..":22,"../normalize":25,"../status":29,"../util":31}],24:[function(require,module,exports){
const normalize = require('../normalize');
const status = require('../status');
const util = require('../util');

module.exports = init;

/*
 * https://docs.maptiler.com/cloud/api/geocoding/
 */
function getStatus(err, response) {
  if (!response) {
    return;
  }
  if (err) {
    return err.status ? status.error : status.failure;
  }
  if (!(response.type === 'FeatureCollection' && response.features?.length)) {
    return status.empty;
  }
  return status.success;
}

function getUrl(url, key, op, query) {
  let q;
  if (op === 'forward') {
    q = encodeURIComponent(query.address || query.place);
  } else {
    q = query.ll.join(',');
  }
  q += '.json?key=' + key;
  if (query.max) {
    q += '&limit=' + query.max;
  }
  if (query.bounds) {
    q += '&bbox=' + [
      query.bounds[0][0], // west
      query.bounds[0][1], // south
      query.bounds[1][0], // east
      query.bounds[1][1] // north
    ].join(',');
  }
  return url + q;
}

function prepareRequest() {
  return true;
}

function map(result) {
  const res = {
    ll: result.center
  };

  res.place = result.text;
  res.house = result.address;
  if (result.properties) {
    res.type = result.properties.kind;
    res.country = normalize.country(result.properties.country_code?.toUpperCase());
  }
  res.address = result.place_name;
  if (res.street !== res.place) {
    const addr = res.address.split(', ');
    if (addr.length > 1 && addr[0] === res.place) {
      addr.shift();
      res.address = addr.join(', ');
    }
  }
  // remove empties
  return util.removeEmpties(res);
}

function processResponse(response, query, result) {
  if (!(response?.type === 'FeatureCollection' && response?.features?.length)) {
    return;
  }
  result.places = response.features.map(map);
  return result;
}

function init(options) {

  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
      options.maptiler_url || 'https://api.maptiler.com/geocoding/',
      options.maptiler_key),
    status: getStatus,
    prepareRequest,
    processResponse
  });
  return require('..')(options);
}

},{"..":22,"../normalize":25,"../status":29,"../util":31}],25:[function(require,module,exports){
const {
  abbr2country,
  country2abbr,
  state2abbr
} = require('@furkot/address');

module.exports = {
  country: normalizeCountry,
  state: normalizeState
};

const countries = {
  'United States': 'USA'
};

function normalizeCountry(country) {
  country = country2abbr[country] || country;
  country = abbr2country[country] || country;
  return countries[country] || country;
}

function normalizeState(state) {
  return state2abbr[state] || state;
}

},{"@furkot/address":4}],26:[function(require,module,exports){
const normalize = require('../normalize');
const status = require('../status');
const util = require('../util');

const code2status = {
  200: status.success, // OK (zero or more results will be returned)
  400: status.empty, // Invalid request (bad request; a required parameter is missing; invalid coordinates)
  402: status.failure, // Valid request but quota exceeded (payment required)
  403: status.failure, // Invalid or missing api key (forbidden)
  404: status.failure, // Invalid API endpoint
  408: status.error, // Timeout; you can try again
  410: status.empty, // Request too long
  429: status.error, // Too many requests (too quickly, rate limiting)
  503: status.empty // Internal server error
};

module.exports = init;

/*
 * https://geocoder.opencagedata.com/api
 */

function getStatus(err, response) {
  let code = response && response.status && response.status.code;
  if (!response) {
    return;
  }
  code = code2status[code];
  if (code === status.success && !(response.results && response.results.length)) {
    code = status.empty;
  }
  return code || status.error;
}

function getUrl(url, key, op, query) {
  let q;
  if (op === 'forward') {
    q = (query.address || query.place).replace(/ /g, '+').replace(/,/g, '%2C');
  } else {
    q = query.ll[1] + '+' + query.ll[0];
  }
  url += '?q=' + q;
  if (query.max) {
    url += '&limit=' + query.max;
  }
  if (query.bounds) {
    url += '&bounds=' + query.bounds.map(join).join(',');
  }
  if (query.lang) {
    url += '&language=' + query.lang;
  }
  url += '&no_annotations=1';
  return url + '&key=' + key;
}

function prepareRequest() {
  return true;
}

function init(options) {

  function processResponse(response, query, result) {
    if (!(response && response.results && response.results.length)) {
      return;
    }
    result.places = response.results.map(function (result) {
      const components = result.components;
      const geom = result.geometry;

      const res = {
        ll: [geom.lng, geom.lat]
      };

      if (components._type) {
        res.type = components._type;
      }
      if (components[components._type]) {
        res.place = components[components._type];
      }
      if (components.house_number) {
        res.house = components.house_number;
      }
      if (components.road || components.pedestrian) {
        res.street = components.road || components.pedestrian;
      }
      if (components.neighbourhood || components.village) {
        res.community = components.neighbourhood || components.village;
      }
      if (components.town || components.city) {
        res.town = components.town || components.city;
      }
      if (components.county) {
        res.county = components.county;
      }
      if (components.state_code) {
        res.province = normalize.state(components.state) || components.state_code;
      }
      if (components.country) {
        res.country = normalize.country(components.country);
      }
      return res;
    });
    return result;
  }

  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
      options.opencage_url || 'https://api.opencagedata.com/geocode/v1/json',
      options.opencage_key),
    status: getStatus,
    prepareRequest,
    processResponse
  });
  if (options.opencage_parameters) {
    options = util.defaults(options, options.opencage_parameters);
  }
  return require('..')(options);
}

function join(ll) {
  return ll.join(',');
}

},{"..":22,"../normalize":25,"../status":29,"../util":31}],27:[function(require,module,exports){
const normalize = require('../normalize');
const status = require('../status');
const util = require('../util');

module.exports = init;

/*
 * https://github.com/pelias/documentation/blob/master/search.md#search-the-world
 * https://github.com/pelias/documentation/blob/master/reverse.md#reverse-geocoding
 */

function getStatus(err, response) {
  if (err && !response) {
    return status.failure;
  }
  if (!response) {
    return status.error;
  }
  if (!response.features || response.features.length === 0) {
    return status.empty;
  }
  return status.success;
}

/*
Examples:

https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=SS%20So%C5%82dek"
https://api.openrouteservice.org/geocode/autocomplete?api_key=${API_KEY}&text=SS%20So%C5%82dek"
https://api.openrouteservice.org/geocode/reverse?api_key=${API_KEY}&point.lat=-22.6792&point.lon=14.5272"

*/

function getUrl(url, key, enablePartial, op, query) {
  const q = [];
  let suffix;
  switch (op) {
    case 'forward':
      suffix = query.partial && enablePartial ? '/autocomplete' : '/search';
      q.push(`text=${encodeURIComponent(query.address || query.place)}`);
      if (query.bounds) {
        const [sw, ne] = query.bounds;
        q.push(
          `boundary.rect.min_lon=${sw[0]}`,
          `boundary.rect.min_lat=${sw[1]}`,
          `boundary.rect.max_lon=${ne[0]}`,
          `boundary.rect.max_lat=${ne[1]}`
        );
        if (query.address) {
          q.push('layers=address');
        } else {
          q.push('layers=venue,coarse');
        }
      }
      break;
    case 'reverse':
      suffix = '/reverse';
      q.push(
        `point.lon=${query.ll[0]}`,
        `point.lat=${query.ll[1]}`
      );
      break;
    default:
      // invalid operation
      return;
  }
  if (query.max) {
    q.push(`size=${query.max}`);
  }
  if (query.lang) {
    const lang = query.lang.toLowerCase().split('_').join('-');
    q.push(`lang=${lang}`);
  }
  q.push(`api_key=${key}`);
  return url + suffix + '?' + q.join('&');
}

function prepareRequest() {
  return true;
}

function filter(f) {
  return f.type === 'Feature' && f.geometry && f.geometry.type === 'Point';
}

const ID_TOKEN = '__ID__';
const SOURCES = {
  openstreetmap: `https://www.openstreetmap.org/${ID_TOKEN}`,
  whosonfirst: `https://spelunker.whosonfirst.org/id/${ID_TOKEN}/`
};

function map(f) {
  const query = this;
  const p = f.properties;
  const place = {
    ll: f.geometry.coordinates,
    type: p.layer,
    house: p.housenumber,
    street: p.street,
    town: p.locality,
    county: p.county,
    province: normalize.state(p.region),
    country: normalize.country(p.country)
  };
  if (place.type === 'venue') {
    place.place = p.name;
    if (query.type) {
      place.type = query.type;
    }
    const url = SOURCES[p.source];
    if (url) {
      place.url = url.replace(ID_TOKEN, p.source_id);
    }
  }

  // remove empties
  return util.removeEmpties(place);
}

function venueFirst({ properties: { confidence: c1, distance: d1, layer: l1 } },
    { properties: { confidence: c2, distance: d2, layer: l2 } }) {
  if (c1 !== c2) {
    // higher confidence is better
    return c2 - c1;
  }
  if (d1 !== d2) {
    // lower distance is better
    return d1 - d2;
  }
  if (l1 === l2) {
    return 0;
  }
  if (l1 === 'venue') {
    return -1;
  }
  if (l2 === 'venue') {
    return 1;
  }
  return 0;
}

function processResponse({ features }, query, result) {
  const places = features.filter(filter);
  if (query.type) {
    places.sort(venueFirst);
  }
  result.places = places.map(map, query);
  return result;
}

function init(options) {
  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
      options.pelias_url || 'https://api.openrouteservice.org/geocode',
      options.pelias_key,
      options.pelias_parameters && options.pelias_parameters.enablePartial),
    status: getStatus,
    prepareRequest,
    processResponse
  });
  if (options.pelias_parameters) {
    options = util.defaults(options, options.pelias_parameters);
  }
  return require('..')(options);
}

},{"..":22,"../normalize":25,"../status":29,"../util":31}],28:[function(require,module,exports){
const normalize = require('../normalize');
const status = require('../status');
const util = require('../util');

module.exports = init;

/*
 * https://positionstack.com/documentation
 */

function getStatus(err, response) {
  if (!(response && response.data && response.data.length > 0)) {
    return status.empty;
  }
  return status.success;
}

function getUrl(url, key, unrestricted, op, query) {
  const q = [];
  let suffix;
  switch (op) {
    case 'forward':
      suffix = '/forward';
      q.push(`query=${encodeURIComponent(query.address || query.place)}`);
      break;
    case 'reverse':
      suffix = '/reverse';
      q.push(`query=${query.ll[1]},${query.ll[0]}`);
      break;
    default:
      // invalid operation
      return;
  }
  if (query.max) {
    q.push(`limit=${query.max}`);
  }
  if (query.lang && unrestricted) {
    const lang = query.lang.toLowerCase().split(/_|-/)[0];
    q.push(`language=${lang}`);
  }
  q.push(`access_key=${key}`);
  return url + suffix + '?' + q.join('&');
}

function prepareRequest() {
  return true;
}

function guessCity({ label, name, region_code, type }) {
  const labelWithoutName = label.replace(name, '').split(',').find(t => t.trim());
  if (labelWithoutName) {
    const city = labelWithoutName.trim();
    if (city !== region_code) {
      return city;
    }
  }
  if (type === 'locality') {
    return name;
  }
}

function map(f) {
  const place = {
    ll: [f.longitude, f.latitude],
    type: f.type,
    house: f.number,
    street: f.street,
    town: guessCity(f),
    province: normalize.state(f.region) || f.region_code,
    country: normalize.country(f.country)
  };
  if (f.type !== 'address') {
    place.place = f.name;
  }

  // remove empties
  return util.removeEmpties(place);
}

function processResponse(response, query, result) {
  const { data } = response;
  result.places = data.map(map);
  return result;
}

function init(options) {
  const url = options.positionstack_url || 'http://api.positionstack.com/v1';
  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
      url,
      options.positionstack_key,
      url.startsWith('https:')),
    status: getStatus,
    prepareRequest,
    processResponse
  });
  if (options.positionstack_parameters) {
    options = util.defaults(options, options.positionstack_parameters);
  }
  return require('..')(options);
}

},{"..":22,"../normalize":25,"../status":29,"../util":31}],29:[function(require,module,exports){
module.exports = {
  success: 'success', // success
  failure: 'failure', // ultimate failure
  error: 'error', // temporary error
  empty: 'empty' // no result
};

},{}],30:[function(require,module,exports){
const status = require('../status');
const util = require('../util');

module.exports = init;

function request(url, req, fn) {
  fn();
}

function getUrl() {}

function prepareRequest() {
  return true;
}

function getStatus() {
  return status.success;
}

function init(options) {
  options = util.defaults(options, {
    forward: true,
    reverse: true,
    request,
    url: getUrl,
    status: getStatus,
    prepareRequest,
    processResponse(response, query, result) {
      result.places = options.response(query);
      return result;
    }
  });
  if (options.synchronous_parameters) {
    options = util.defaults(options, options.synchronous_parameters);
  }
  return require('..')(options);
}

},{"..":22,"../status":29,"../util":31}],31:[function(require,module,exports){
const { prettify, stringify } = require('@furkot/address');

module.exports = {
  defaults,
  prettify,
  removeEmpties,
  stringify,
  toObject,
  withTimeout
};

function defaults(obj, source) {
  return Object.assign({}, source, obj);
}

function removeEmpties(place) {
  Object.keys(place).forEach(function (key) {
    if (!place[key]) {
      delete place[key];
    }
  });
  return place;
}

function toObject(array) {
  return array.reduce(function (obj, e) {
    obj[e] = e;
    return obj;
  }, {});
}

function withTimeout(promise, timeout) {
  let id;
  return Promise
    .race([promise, new Promise(timeoutPromise)])
    .finally(() => clearTimeout(id));

  function timeoutPromise(_, reject) {
    id = setTimeout(
      () => reject(Error('timeout', { cause: Symbol.for('timeout') })),
      timeout
    );
  }
}

},{"@furkot/address":4}],32:[function(require,module,exports){
/**
 * Simple, lightweight, usable local autocomplete library for modern browsers
 * Because there weren’t enough autocomplete scripts in the world? Because I’m completely insane and have NIH syndrome? Probably both. :P
 * @author Lea Verou http://leaverou.github.io/awesomplete
 * MIT license
 */

(function () {

var _ = function (input, o) {
	var me = this;
    
    // Keep track of number of instances for unique IDs
    _.count = (_.count || 0) + 1;
    this.count = _.count;

	// Setup

	this.isOpened = false;

	this.input = $(input);
	this.input.setAttribute("autocomplete", "off");
	this.input.setAttribute("aria-owns", "awesomplete_list_" + this.count);
	this.input.setAttribute("role", "combobox");

	o = o || {};

	configure(this, {
		minChars: 2,
		maxItems: 10,
		autoFirst: false,
		data: _.DATA,
		filter: _.FILTER_CONTAINS,
		sort: o.sort === false ? false : _.SORT_BYLENGTH,
		container: _.CONTAINER,
		item: _.ITEM,
		replace: _.REPLACE
	}, o);

	this.index = -1;

	// Create necessary elements

	this.container = this.container(input);

	this.ul = $.create("ul", {
		hidden: "hidden",
        role: "listbox",
        id: "awesomplete_list_" + this.count,
		inside: this.container
	});

	this.status = $.create("span", {
		className: "visually-hidden",
		role: "status",
		"aria-live": "assertive",
        "aria-atomic": true,
        inside: this.container,
        textContent: this.minChars != 0 ? ("Type " + this.minChars + " or more characters for results.") : "Begin typing for results."
	});

	// Bind events

	this._events = {
		input: {
			"input": this.evaluate.bind(this),
			"blur": this.close.bind(this, { reason: "blur" }),
			"keydown": function(evt) {
				var c = evt.keyCode;

				// If the dropdown `ul` is in view, then act on keydown for the following keys:
				// Enter / Esc / Up / Down
				if(me.opened) {
					if (c === 13 && me.selected) { // Enter
						evt.preventDefault();
						me.select();
					}
					else if (c === 27) { // Esc
						me.close({ reason: "esc" });
					}
					else if (c === 38 || c === 40) { // Down/Up arrow
						evt.preventDefault();
						me[c === 38? "previous" : "next"]();
					}
				}
			}
		},
		form: {
			"submit": this.close.bind(this, { reason: "submit" })
		},
		ul: {
			// Prevent the default mousedowm, which ensures the input is not blurred.
			// The actual selection will happen on click. This also ensures dragging the
			// cursor away from the list item will cancel the selection
			"mousedown": function(evt) {
				evt.preventDefault();
			},
			// The click event is fired even if the corresponding mousedown event has called preventDefault
			"click": function(evt) {
				var li = evt.target;

				if (li !== this) {

					while (li && !/li/i.test(li.nodeName)) {
						li = li.parentNode;
					}

					if (li && evt.button === 0) {  // Only select on left click
						evt.preventDefault();
						me.select(li, evt.target);
					}
				}
			}
		}
	};

	$.bind(this.input, this._events.input);
	$.bind(this.input.form, this._events.form);
	$.bind(this.ul, this._events.ul);

	if (this.input.hasAttribute("list")) {
		this.list = "#" + this.input.getAttribute("list");
		this.input.removeAttribute("list");
	}
	else {
		this.list = this.input.getAttribute("data-list") || o.list || [];
	}

	_.all.push(this);
};

_.prototype = {
	set list(list) {
		if (Array.isArray(list)) {
			this._list = list;
		}
		else if (typeof list === "string" && list.indexOf(",") > -1) {
				this._list = list.split(/\s*,\s*/);
		}
		else { // Element or CSS selector
			list = $(list);

			if (list && list.children) {
				var items = [];
				slice.apply(list.children).forEach(function (el) {
					if (!el.disabled) {
						var text = el.textContent.trim();
						var value = el.value || text;
						var label = el.label || text;
						if (value !== "") {
							items.push({ label: label, value: value });
						}
					}
				});
				this._list = items;
			}
		}

		if (document.activeElement === this.input) {
			this.evaluate();
		}
	},

	get selected() {
		return this.index > -1;
	},

	get opened() {
		return this.isOpened;
	},

	close: function (o) {
		if (!this.opened) {
			return;
		}

		this.ul.setAttribute("hidden", "");
		this.isOpened = false;
		this.index = -1;
    
		this.status.setAttribute("hidden", "");

		$.fire(this.input, "awesomplete-close", o || {});
	},

	open: function () {
		this.ul.removeAttribute("hidden");
		this.isOpened = true;
        
		this.status.removeAttribute("hidden");

		if (this.autoFirst && this.index === -1) {
			this.goto(0);
		}

		$.fire(this.input, "awesomplete-open");
	},

	destroy: function() {
		//remove events from the input and its form
		$.unbind(this.input, this._events.input);
		$.unbind(this.input.form, this._events.form);

		if (this.input.parentNode === this.container) {
			//move the input out of the awesomplete container and remove the container and its children
			var parentNode = this.container.parentNode;

			parentNode.insertBefore(this.input, this.container);
			parentNode.removeChild(this.container);
		}

		//remove autocomplete and aria-autocomplete attributes
		this.input.removeAttribute("autocomplete");
		this.input.removeAttribute("aria-autocomplete");

		//remove this awesomeplete instance from the global array of instances
		var indexOfAwesomplete = _.all.indexOf(this);

		if (indexOfAwesomplete !== -1) {
			_.all.splice(indexOfAwesomplete, 1);
		}
	},

	next: function () {
		var count = this.ul.children.length;
		this.goto(this.index < count - 1 ? this.index + 1 : (count ? 0 : -1) );
	},

	previous: function () {
		var count = this.ul.children.length;
		var pos = this.index - 1;

		this.goto(this.selected && pos !== -1 ? pos : count - 1);
	},

	// Should not be used, highlights specific item without any checks!
	goto: function (i) {
		var lis = this.ul.children;

		if (this.selected) {
			lis[this.index].setAttribute("aria-selected", "false");
		}

		this.index = i;

		if (i > -1 && lis.length > 0) {
			lis[i].setAttribute("aria-selected", "true");
            
			this.status.textContent = lis[i].textContent + ", list item " + (i + 1) + " of " + lis.length;
            
            this.input.setAttribute("aria-activedescendant", this.ul.id + "_item_" + this.index);

			// scroll to highlighted element in case parent's height is fixed
			this.ul.scrollTop = lis[i].offsetTop - this.ul.clientHeight + lis[i].clientHeight;

			$.fire(this.input, "awesomplete-highlight", {
				text: this.suggestions[this.index]
			});
		}
	},

	select: function (selected, origin) {
		if (selected) {
			this.index = $.siblingIndex(selected);
		} else {
			selected = this.ul.children[this.index];
		}

		if (selected) {
			var suggestion = this.suggestions[this.index];

			var allowed = $.fire(this.input, "awesomplete-select", {
				text: suggestion,
				origin: origin || selected
			});

			if (allowed) {
				this.replace(suggestion);
				this.close({ reason: "select" });
				$.fire(this.input, "awesomplete-selectcomplete", {
					text: suggestion
				});
			}
		}
	},

	evaluate: function() {
		var me = this;
		var value = this.input.value;

		if (value.length >= this.minChars && this._list && this._list.length > 0) {
			this.index = -1;
			// Populate list with options that match
			this.ul.innerHTML = "";

			this.suggestions = this._list
				.map(function(item) {
					return new Suggestion(me.data(item, value));
				})
				.filter(function(item) {
					return me.filter(item, value);
				});

			if (this.sort !== false) {
				this.suggestions = this.suggestions.sort(this.sort);
			}

			this.suggestions = this.suggestions.slice(0, this.maxItems);

			this.suggestions.forEach(function(text, index) {
					me.ul.appendChild(me.item(text, value, index));
				});

			if (this.ul.children.length === 0) {
                
                this.status.textContent = "No results found";
                
				this.close({ reason: "nomatches" });
        
			} else {
				this.open();
        
                this.status.textContent = this.ul.children.length + " results found";
			}
		}
		else {
			this.close({ reason: "nomatches" });
            
                this.status.textContent = "No results found";
		}
	}
};

// Static methods/properties

_.all = [];

_.FILTER_CONTAINS = function (text, input) {
	return RegExp($.regExpEscape(input.trim()), "i").test(text);
};

_.FILTER_STARTSWITH = function (text, input) {
	return RegExp("^" + $.regExpEscape(input.trim()), "i").test(text);
};

_.SORT_BYLENGTH = function (a, b) {
	if (a.length !== b.length) {
		return a.length - b.length;
	}

	return a < b? -1 : 1;
};

_.CONTAINER = function (input) {
	return $.create("div", {
		className: "awesomplete",
		around: input
	});
}

_.ITEM = function (text, input, item_id) {
	var html = input.trim() === "" ? text : text.replace(RegExp($.regExpEscape(input.trim()), "gi"), "<mark>$&</mark>");
	return $.create("li", {
		innerHTML: html,
		"aria-selected": "false",
        "id": "awesomplete_list_" + this.count + "_item_" + item_id
	});
};

_.REPLACE = function (text) {
	this.input.value = text.value;
};

_.DATA = function (item/*, input*/) { return item; };

// Private functions

function Suggestion(data) {
	var o = Array.isArray(data)
	  ? { label: data[0], value: data[1] }
	  : typeof data === "object" && "label" in data && "value" in data ? data : { label: data, value: data };

	this.label = o.label || o.value;
	this.value = o.value;
}
Object.defineProperty(Suggestion.prototype = Object.create(String.prototype), "length", {
	get: function() { return this.label.length; }
});
Suggestion.prototype.toString = Suggestion.prototype.valueOf = function () {
	return "" + this.label;
};

function configure(instance, properties, o) {
	for (var i in properties) {
		var initial = properties[i],
		    attrValue = instance.input.getAttribute("data-" + i.toLowerCase());

		if (typeof initial === "number") {
			instance[i] = parseInt(attrValue);
		}
		else if (initial === false) { // Boolean options must be false by default anyway
			instance[i] = attrValue !== null;
		}
		else if (initial instanceof Function) {
			instance[i] = null;
		}
		else {
			instance[i] = attrValue;
		}

		if (!instance[i] && instance[i] !== 0) {
			instance[i] = (i in o)? o[i] : initial;
		}
	}
}

// Helpers

var slice = Array.prototype.slice;

function $(expr, con) {
	return typeof expr === "string"? (con || document).querySelector(expr) : expr || null;
}

function $$(expr, con) {
	return slice.call((con || document).querySelectorAll(expr));
}

$.create = function(tag, o) {
	var element = document.createElement(tag);

	for (var i in o) {
		var val = o[i];

		if (i === "inside") {
			$(val).appendChild(element);
		}
		else if (i === "around") {
			var ref = $(val);
			ref.parentNode.insertBefore(element, ref);
			element.appendChild(ref);
			
			if (ref.getAttribute("autofocus") != null) {
				ref.focus();
			}
		}
		else if (i in element) {
			element[i] = val;
		}
		else {
			element.setAttribute(i, val);
		}
	}

	return element;
};

$.bind = function(element, o) {
	if (element) {
		for (var event in o) {
			var callback = o[event];

			event.split(/\s+/).forEach(function (event) {
				element.addEventListener(event, callback);
			});
		}
	}
};

$.unbind = function(element, o) {
	if (element) {
		for (var event in o) {
			var callback = o[event];

			event.split(/\s+/).forEach(function(event) {
				element.removeEventListener(event, callback);
			});
		}
	}
};

$.fire = function(target, type, properties) {
	var evt = document.createEvent("HTMLEvents");

	evt.initEvent(type, true, true );

	for (var j in properties) {
		evt[j] = properties[j];
	}

	return target.dispatchEvent(evt);
};

$.regExpEscape = function (s) {
	return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};

$.siblingIndex = function (el) {
	/* eslint-disable no-cond-assign */
	for (var i = 0; el = el.previousElementSibling; i++);
	return i;
};

// Initialization

function init() {
	$$("input.awesomplete").forEach(function (input) {
		new _(input);
	});
}

// Make sure to export Awesomplete on self when in a browser
if (typeof self !== "undefined") {
	self.Awesomplete = _;
}

// Are we in a browser? Check for Document constructor
if (typeof Document !== "undefined") {
	// DOM already loaded?
	if (document.readyState !== "loading") {
		init();
	}
	else {
		// Wait for it
		document.addEventListener("DOMContentLoaded", init);
	}
}

_.$ = $;
_.$$ = $$;

// Expose Awesomplete as a CJS module
if (typeof module === "object" && module.exports) {
	module.exports = _;
}

return _;

}());

},{}],33:[function(require,module,exports){
function debounce(function_, wait = 100, options = {}) {
	if (typeof function_ !== 'function') {
		throw new TypeError(`Expected the first parameter to be a function, got \`${typeof function_}\`.`);
	}

	if (wait < 0) {
		throw new RangeError('`wait` must not be negative.');
	}

	// TODO: Deprecate the boolean parameter at some point.
	const {immediate} = typeof options === 'boolean' ? {immediate: options} : options;

	let storedContext;
	let storedArguments;
	let timeoutId;
	let timestamp;
	let result;

	function run() {
		const callContext = storedContext;
		const callArguments = storedArguments;
		storedContext = undefined;
		storedArguments = undefined;
		result = function_.apply(callContext, callArguments);
		return result;
	}

	function later() {
		const last = Date.now() - timestamp;

		if (last < wait && last >= 0) {
			timeoutId = setTimeout(later, wait - last);
		} else {
			timeoutId = undefined;

			if (!immediate) {
				result = run();
			}
		}
	}

	const debounced = function (...arguments_) {
		if (
			storedContext
			&& this !== storedContext
			&& Object.getPrototypeOf(this) === Object.getPrototypeOf(storedContext)
		) {
			throw new Error('Debounced method called with different contexts of the same prototype.');
		}

		storedContext = this; // eslint-disable-line unicorn/no-this-assignment
		storedArguments = arguments_;
		timestamp = Date.now();

		const callNow = immediate && !timeoutId;

		if (!timeoutId) {
			timeoutId = setTimeout(later, wait);
		}

		if (callNow) {
			result = run();
		}

		return result;
	};

	Object.defineProperty(debounced, 'isPending', {
		get() {
			return timeoutId !== undefined;
		},
	});

	debounced.clear = () => {
		if (!timeoutId) {
			return;
		}

		clearTimeout(timeoutId);
		timeoutId = undefined;
	};

	debounced.flush = () => {
		if (!timeoutId) {
			return;
		}

		debounced.trigger();
	};

	debounced.trigger = () => {
		result = run();

		debounced.clear();
	};

	return debounced;
}

// Adds compatibility for ES modules
module.exports.debounce = debounce;

module.exports = debounce;

},{}],34:[function(require,module,exports){
(function (process){(function (){
/* eslint-env browser */

/**
 * This is the web browser implementation of `debug()`.
 */

exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (() => {
	let warned = false;

	return () => {
		if (!warned) {
			warned = true;
			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
		}
	};
})();

/**
 * Colors.
 */

exports.colors = [
	'#0000CC',
	'#0000FF',
	'#0033CC',
	'#0033FF',
	'#0066CC',
	'#0066FF',
	'#0099CC',
	'#0099FF',
	'#00CC00',
	'#00CC33',
	'#00CC66',
	'#00CC99',
	'#00CCCC',
	'#00CCFF',
	'#3300CC',
	'#3300FF',
	'#3333CC',
	'#3333FF',
	'#3366CC',
	'#3366FF',
	'#3399CC',
	'#3399FF',
	'#33CC00',
	'#33CC33',
	'#33CC66',
	'#33CC99',
	'#33CCCC',
	'#33CCFF',
	'#6600CC',
	'#6600FF',
	'#6633CC',
	'#6633FF',
	'#66CC00',
	'#66CC33',
	'#9900CC',
	'#9900FF',
	'#9933CC',
	'#9933FF',
	'#99CC00',
	'#99CC33',
	'#CC0000',
	'#CC0033',
	'#CC0066',
	'#CC0099',
	'#CC00CC',
	'#CC00FF',
	'#CC3300',
	'#CC3333',
	'#CC3366',
	'#CC3399',
	'#CC33CC',
	'#CC33FF',
	'#CC6600',
	'#CC6633',
	'#CC9900',
	'#CC9933',
	'#CCCC00',
	'#CCCC33',
	'#FF0000',
	'#FF0033',
	'#FF0066',
	'#FF0099',
	'#FF00CC',
	'#FF00FF',
	'#FF3300',
	'#FF3333',
	'#FF3366',
	'#FF3399',
	'#FF33CC',
	'#FF33FF',
	'#FF6600',
	'#FF6633',
	'#FF9900',
	'#FF9933',
	'#FFCC00',
	'#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

// eslint-disable-next-line complexity
function useColors() {
	// NB: In an Electron preload script, document will be defined but not fully
	// initialized. Since we know we're in Chrome, we'll just detect this case
	// explicitly
	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
		return true;
	}

	// Internet Explorer and Edge do not support colors.
	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
		return false;
	}

	let m;

	// Is webkit? http://stackoverflow.com/a/16459606/376773
	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	// eslint-disable-next-line no-return-assign
	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		// Is firebug? http://stackoverflow.com/a/398120/376773
		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		// Is firefox >= v31?
		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		(typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31) ||
		// Double check webkit in userAgent just in case we are in a worker
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	args[0] = (this.useColors ? '%c' : '') +
		this.namespace +
		(this.useColors ? ' %c' : ' ') +
		args[0] +
		(this.useColors ? '%c ' : ' ') +
		'+' + module.exports.humanize(this.diff);

	if (!this.useColors) {
		return;
	}

	const c = 'color: ' + this.color;
	args.splice(1, 0, c, 'color: inherit');

	// The final "%c" is somewhat tricky, because there could be other
	// arguments passed either before or after the %c, so we need to
	// figure out the correct index to insert the CSS into
	let index = 0;
	let lastC = 0;
	args[0].replace(/%[a-zA-Z%]/g, match => {
		if (match === '%%') {
			return;
		}
		index++;
		if (match === '%c') {
			// We only are interested in the *last* %c
			// (the user may have provided their own)
			lastC = index;
		}
	});

	args.splice(lastC, 0, c);
}

/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */
exports.log = console.debug || console.log || (() => {});

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	try {
		if (namespaces) {
			exports.storage.setItem('debug', namespaces);
		} else {
			exports.storage.removeItem('debug');
		}
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
	let r;
	try {
		r = exports.storage.getItem('debug');
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}

	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	if (!r && typeof process !== 'undefined' && 'env' in process) {
		r = process.env.DEBUG;
	}

	return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
	try {
		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
		// The Browser also has localStorage in the global context.
		return localStorage;
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

module.exports = require('./common')(exports);

const {formatters} = module.exports;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

formatters.j = function (v) {
	try {
		return JSON.stringify(v);
	} catch (error) {
		return '[UnexpectedJSONParseError]: ' + error.message;
	}
};

}).call(this)}).call(this,require('_process'))

},{"./common":35,"_process":1}],35:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

function setup(env) {
	createDebug.debug = createDebug;
	createDebug.default = createDebug;
	createDebug.coerce = coerce;
	createDebug.disable = disable;
	createDebug.enable = enable;
	createDebug.enabled = enabled;
	createDebug.humanize = require('ms');
	createDebug.destroy = destroy;

	Object.keys(env).forEach(key => {
		createDebug[key] = env[key];
	});

	/**
	* The currently active debug mode names, and names to skip.
	*/

	createDebug.names = [];
	createDebug.skips = [];

	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
	createDebug.formatters = {};

	/**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/
	function selectColor(namespace) {
		let hash = 0;

		for (let i = 0; i < namespace.length; i++) {
			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}

		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
	}
	createDebug.selectColor = selectColor;

	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
	function createDebug(namespace) {
		let prevTime;
		let enableOverride = null;
		let namespacesCache;
		let enabledCache;

		function debug(...args) {
			// Disabled?
			if (!debug.enabled) {
				return;
			}

			const self = debug;

			// Set `diff` timestamp
			const curr = Number(new Date());
			const ms = curr - (prevTime || curr);
			self.diff = ms;
			self.prev = prevTime;
			self.curr = curr;
			prevTime = curr;

			args[0] = createDebug.coerce(args[0]);

			if (typeof args[0] !== 'string') {
				// Anything else let's inspect with %O
				args.unshift('%O');
			}

			// Apply any `formatters` transformations
			let index = 0;
			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
				// If we encounter an escaped % then don't increase the array index
				if (match === '%%') {
					return '%';
				}
				index++;
				const formatter = createDebug.formatters[format];
				if (typeof formatter === 'function') {
					const val = args[index];
					match = formatter.call(self, val);

					// Now we need to remove `args[index]` since it's inlined in the `format`
					args.splice(index, 1);
					index--;
				}
				return match;
			});

			// Apply env-specific formatting (colors, etc.)
			createDebug.formatArgs.call(self, args);

			const logFn = self.log || createDebug.log;
			logFn.apply(self, args);
		}

		debug.namespace = namespace;
		debug.useColors = createDebug.useColors();
		debug.color = createDebug.selectColor(namespace);
		debug.extend = extend;
		debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

		Object.defineProperty(debug, 'enabled', {
			enumerable: true,
			configurable: false,
			get: () => {
				if (enableOverride !== null) {
					return enableOverride;
				}
				if (namespacesCache !== createDebug.namespaces) {
					namespacesCache = createDebug.namespaces;
					enabledCache = createDebug.enabled(namespace);
				}

				return enabledCache;
			},
			set: v => {
				enableOverride = v;
			}
		});

		// Env-specific initialization logic for debug instances
		if (typeof createDebug.init === 'function') {
			createDebug.init(debug);
		}

		return debug;
	}

	function extend(namespace, delimiter) {
		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
		newDebug.log = this.log;
		return newDebug;
	}

	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
	function enable(namespaces) {
		createDebug.save(namespaces);
		createDebug.namespaces = namespaces;

		createDebug.names = [];
		createDebug.skips = [];

		const split = (typeof namespaces === 'string' ? namespaces : '')
			.trim()
			.replace(' ', ',')
			.split(',')
			.filter(Boolean);

		for (const ns of split) {
			if (ns[0] === '-') {
				createDebug.skips.push(ns.slice(1));
			} else {
				createDebug.names.push(ns);
			}
		}
	}

	/**
	 * Checks if the given string matches a namespace template, honoring
	 * asterisks as wildcards.
	 *
	 * @param {String} search
	 * @param {String} template
	 * @return {Boolean}
	 */
	function matchesTemplate(search, template) {
		let searchIndex = 0;
		let templateIndex = 0;
		let starIndex = -1;
		let matchIndex = 0;

		while (searchIndex < search.length) {
			if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
				// Match character or proceed with wildcard
				if (template[templateIndex] === '*') {
					starIndex = templateIndex;
					matchIndex = searchIndex;
					templateIndex++; // Skip the '*'
				} else {
					searchIndex++;
					templateIndex++;
				}
			} else if (starIndex !== -1) { // eslint-disable-line no-negated-condition
				// Backtrack to the last '*' and try to match more characters
				templateIndex = starIndex + 1;
				matchIndex++;
				searchIndex = matchIndex;
			} else {
				return false; // No match
			}
		}

		// Handle trailing '*' in template
		while (templateIndex < template.length && template[templateIndex] === '*') {
			templateIndex++;
		}

		return templateIndex === template.length;
	}

	/**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/
	function disable() {
		const namespaces = [
			...createDebug.names,
			...createDebug.skips.map(namespace => '-' + namespace)
		].join(',');
		createDebug.enable('');
		return namespaces;
	}

	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
	function enabled(name) {
		for (const skip of createDebug.skips) {
			if (matchesTemplate(name, skip)) {
				return false;
			}
		}

		for (const ns of createDebug.names) {
			if (matchesTemplate(name, ns)) {
				return true;
			}
		}

		return false;
	}

	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
	function coerce(val) {
		if (val instanceof Error) {
			return val.stack || val.message;
		}
		return val;
	}

	/**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/
	function destroy() {
		console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
	}

	createDebug.enable(createDebug.load());

	return createDebug;
}

module.exports = setup;

},{"ms":39}],36:[function(require,module,exports){
module.exports = require('./lib/fetchagent');

},{"./lib/fetchagent":37}],37:[function(require,module,exports){
/* global Headers */

module.exports = fetchagent;

['get', 'put', 'post', 'delete'].forEach(method => {
  fetchagent[method] = url => fetchagent(method.toUpperCase(), url);
});

fetchagent.del = fetchagent.delete;

function setAll(destination, source) {
  Object.keys(source).forEach(p => destination.set(p, source[p]));
}

function formatUrl(prefix, query) {
  function encode(v) {
    return Array.isArray(v)
      ? v.map(encodeURIComponent).join(',')
      : encodeURIComponent(v);
  }

  if (!query) {
    return prefix;
  }
  const qs = Object
    .keys(query)
    .map(name => `${name}=${encode(query[name])}`)
    .join('&');
  if (!qs) {
    return prefix;
  }
  return `${prefix}?${qs}`;
}

function defaultContentParser(contentType) {
  return contentType && contentType.includes('json') ? 'json': 'text';
}

function fetchagent(method, url) {
  const req = {
    url,
    query: undefined
  };
  const init = {
    method,
    redirect: 'manual',
    credentials: 'same-origin'
  };
  const self = {
    end,
    json,
    parser,
    query,
    redirect,
    signal,
    send,
    set,
    text
  };

  let error;
  let contentParser = defaultContentParser;

  function end(fn) {
    const fetched = fetch(formatUrl(req.url, req.query), init);

    if (!fn) {
      return fetched;
    }

    fetched
      .then(res => {
        if (!res.ok) {
          error = {
            status: res.status,
            response: res
          };
        }
        const parser = contentParser(res.headers.get('Content-Type'));
        if (parser) {
          return res[parser]();
        } else if (!error) {
          error = {
            status: 'unknown Content-Type',
            response: res
          };
        }
      })
      .then(
        body => fn(error, body),
        e => {
          error = error || {};
          error.error = e;
          return fn(error);
        }
      );
  }

  function json() {
    return end().then(res => res.json());
  }

  function text() {
    return end().then(res => res.text());
  }

  function send(body) {
    if (_instanceof(body, 'Blob') || _instanceof(body, 'FormData') || typeof body !== 'object') {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      set('Content-Type', 'application/json');
    }
    return self;
  }

  function query(q) {
    req.query = q;
    return self;
  }

  function signal(s) {
    init.signal = s;
    return self;
  }

  function set(header, value) {
    if (!init.headers) {
      init.headers = new Headers();
    }
    if (typeof value === 'string') {
      init.headers.set(header, value);
    }
    else  {
      setAll(init.headers, header);
    }
    return self;
  }

  function redirect(follow) {
    init.redirect = follow ? 'follow' : 'manual';
    return self;
  }

  function parser(fn) {
    contentParser = fn;
    return self;
  }

  return self;
}

function _instanceof(object, constructorName) {
  if (typeof globalThis === 'undefined') {
    return false;
  }
  const constructor = globalThis[constructorName];
  return typeof constructor === 'function' && object instanceof constructor;
}

},{}],38:[function(require,module,exports){
module.exports = limiter;

function limiter(interval, penaltyInterval = 5 * interval) {
  let queue = [];
  let lastTrigger = 0;
  let penaltyCounter = 0;
  let skipCounter = 0;
  let timer;

  return {
    trigger,
    penalty,
    skip,
    cancel
  };

  function trigger(fn) {
    const p = promised(fn);
    if (since() >= currentInterval() && !queue.length) {
      runNow(p);
    } else {
      queue.push(p);
      schedule();
    }
    return p.promise;
  }

  function penalty() {
    penaltyCounter += 1;
  }

  function skip() {
    skipCounter += 1;
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer);
    }
    queue.forEach(p => p.reject());
    queue = [];
  }

  function since() {
    return Date.now() - lastTrigger;
  }

  function currentInterval() {
    return penaltyCounter > 0 ? penaltyInterval : interval;
  }

  function runNow(p) {
    penaltyCounter = 0;
    p.resolve();
    // wait to the next interval unless told to skip
    // to the next operation immediately
    if (skipCounter > 0) {
      skipCounter = 0;
    } else {
      lastTrigger = Date.now();
    }
  }

  function deque() {
    timer = undefined;
    if (since() >= currentInterval()) {
      runNow(queue.shift());
    }
    schedule();
  }

  function schedule() {
    if (!timer && queue.length) {
      const delay = currentInterval() - since();
      if (delay < 0) {
        return deque();
      }
      timer = setTimeout(deque, delay);
    }
  }
}

function promised(fn) {
  let _ = {};
  const promise = new Promise((resolve, reject) => _ = { resolve, reject });
  return {
    promise,
    resolve,
    reject
  };

  function resolve() {
    if (fn) { fn(); }
    _.resolve();
  }
  function reject() {
    _.reject();
  }
}

},{}],39:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function (val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isFinite(val)) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}

},{}],"demo":[function(require,module,exports){
const geoplete = require('..');

const keys = {
  geocodio: "",
  graphhopper: "",
  locationiq: "",
  maptiler: "ZnQURXfQguJYDPTD5zWw",
  opencage: "",
  pelias: "",
  positionstack: ""
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

},{"..":2}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiLi4vaW5kZXguanMiLCIuLi9saWIvZ2VvcGxldGUuanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9hZGRyZXNzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvYWRkcmVzcy9saWIvYWRkcmVzcy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9AZnVya290L2FkZHJlc3MvbGliL2FkZHJlc3Mvbm9ybWFsaXplLmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvYWRkcmVzcy9saWIvYWRkcmVzcy9wYXJzZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9AZnVya290L2FkZHJlc3MvbGliL2FkZHJlc3MvcHJldHRpZnkuanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9hZGRyZXNzL2xpYi9hZGRyZXNzL3N0cmluZ2lmeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9AZnVya290L2FkZHJlc3MvbGliL2NvdW50cnkvY291bnRyaWVzLmpzb24iLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9hZGRyZXNzL2xpYi9jb3VudHJ5L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvYWRkcmVzcy9saWIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9hZGRyZXNzL2xpYi9zdGF0ZS9jYS5qc29uIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvYWRkcmVzcy9saWIvc3RhdGUvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9hZGRyZXNzL2xpYi9zdGF0ZS91cy5qc29uIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvYWRkcmVzcy9saWIvdXRpbC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9AZnVya290L2dlb2NvZGUvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9nZW9jb2RlL2xpYi9nZW9jb2RlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9nZW9jb2Rpby9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9AZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2UvZ3JhcGhob3BwZXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL2hvZ2Zpc2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9sb2NhdGlvbmlxL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9tYXB0aWxlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9AZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2Uvbm9ybWFsaXplLmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9vcGVuY2FnZS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9AZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2UvcGVsaWFzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9wb3NpdGlvbnN0YWNrL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9zdGF0dXMuanMiLCIuLi9ub2RlX21vZHVsZXMvQGZ1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL3N5bmNocm9ub3VzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BmdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS91dGlsLmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BtZWxpdGVsZS9hd2Vzb21wbGV0ZS9hd2Vzb21wbGV0ZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9kZWJvdW5jZS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvYnJvd3Nlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvY29tbW9uLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2ZldGNoYWdlbnQvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZmV0Y2hhZ2VudC9saWIvZmV0Y2hhZ2VudC5qcyIsIi4uL25vZGVfbW9kdWxlcy9saW1pdGVyLWNvbXBvbmVudC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9tcy9pbmRleC5qcyIsImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbE1BO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFNBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9nZW9wbGV0ZScpO1xuIiwiY29uc3QgQXdlc29tcGxldGUgPSByZXF1aXJlKCdAbWVsaXRlbGUvYXdlc29tcGxldGUnKTtcbmNvbnN0IGZ1cmtvdEdlb2NvZGUgPSByZXF1aXJlKCdAZnVya290L2dlb2NvZGUnKTtcbmNvbnN0IGRlYm91bmNlID0gcmVxdWlyZSgnZGVib3VuY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBnZW9wbGV0ZTtcblxuLyogZ2xvYmFsIEFib3J0Q29udHJvbGxlciAqL1xuXG5jb25zdCBTdWdnZXN0aW9ucyA9IHtcbiAgJ2FkZHJlc3MnOiB7XG4gICAgdG9TdHJpbmcoKSB7IHJldHVybiB0aGlzLmFkZHJlc3MgfHwgdGhpcy5wbGFjZTsgfVxuICB9LFxuICAncGxhY2UnOiB7XG4gICAgdG9TdHJpbmcoKSB7IHJldHVybiB0aGlzLnBsYWNlIHx8IHRoaXMuYWRkcmVzczsgfVxuICB9XG59O1xuXG5jb25zdCBrZWVwT3BlbiA9IHtcbiAgZXNjOiB0cnVlXG59O1xuXG5mdW5jdGlvbiBkaXNwbGF5QWxsKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2VvUXVlcnkocXVlcnkpIHtcbiAgcmV0dXJuIHF1ZXJ5O1xufVxuXG5mdW5jdGlvbiByZWdFeHBFc2NhcGUocykge1xuICByZXR1cm4gcy5yZXBsYWNlKC9bLVxcXFxeJCorPy4oKXxbXFxde31dL2csIFwiXFxcXCQmXCIpO1xufVxuXG5mdW5jdGlvbiBnZW9wbGV0ZShlbCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy50eXBlID0gU3VnZ2VzdGlvbnNbb3B0aW9ucy50eXBlXSA/IG9wdGlvbnMudHlwZSA6ICdhZGRyZXNzJztcbiAgb3B0aW9ucy5taW5DaGFycyA9IG9wdGlvbnMubWluQ2hhcnMgfHwgNDtcbiAgb3B0aW9ucy50cmlnZ2VyID0gb3B0aW9ucy50cmlnZ2VyIHx8IHRyaWdnZXI7XG5cbiAgb3B0aW9ucy5nZW9RdWVyeSA9IG9wdGlvbnMuZ2VvUXVlcnkgfHwgZ2VvUXVlcnk7XG4gIG9wdGlvbnMubWluTWF0Y2hpbmcgPSBvcHRpb25zLm1pbk1hdGNoaW5nIHx8IDI7XG4gIG9wdGlvbnMuZmlsdGVyTWF0Y2hlcyA9IG9wdGlvbnMuZmlsdGVyTWF0Y2hlcyB8fCBmaWx0ZXJNYXRjaGVzO1xuICBjb25zdCBhY09wdGlvbnMgPSB7XG4gICAgbWluQ2hhcnM6IDAsXG4gICAgZmlsdGVyOiBkaXNwbGF5QWxsLFxuICAgIHNvcnQ6IG9wdGlvbnMuc29ydFxuICB9O1xuICBpZiAob3B0aW9ucy5pdGVtKSB7XG4gICAgYWNPcHRpb25zLml0ZW0gPSBvcHRpb25zLml0ZW07XG4gIH1cbiAgaWYgKG9wdGlvbnMuY29udGFpbmVyKSB7XG4gICAgYWNPcHRpb25zLmNvbnRhaW5lciA9IG9wdGlvbnMuY29udGFpbmVyO1xuICB9XG5cblxuICBjb25zdCBnZW9PcHRpb25zID0gb3B0aW9ucy5nZW9jb2RlcjtcblxuICBsZXQgbGFzdFZhbHVlO1xuICBsZXQgYWJvcnRDb250cm9sbGVyO1xuICBjb25zdCBnZW9jb2RlID0gZnVya290R2VvY29kZShnZW9PcHRpb25zKTtcbiAgY29uc3QgYWMgPSBuZXcgQXdlc29tcGxldGUoZWwsIGFjT3B0aW9ucyk7XG5cbiAgaWYgKG9wdGlvbnMua2VlcE9wZW4pIHtcbiAgICBhYy5jbG9zZSA9IGZ1bmN0aW9uIChjbG9zZSwgbykge1xuICAgICAgaWYgKG8gJiYgby5yZWFzb24gJiYga2VlcE9wZW5bby5yZWFzb25dKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNsb3NlLmFwcGx5KHRoaXMsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIH0uYmluZChhYywgYWMuY2xvc2UpO1xuICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2JsdXInLCBhYy5fZXZlbnRzLmlucHV0LmJsdXIpO1xuICB9XG5cbiAgY29uc3Qgb25pbnB1dCA9IGRlYm91bmNlKGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gZWwudmFsdWUudHJpbSgpO1xuICAgIGlmICghb3B0aW9ucy50cmlnZ2VyKHZhbHVlKSkge1xuICAgICAgcG9wdWxhdGUoW10pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBxdWVyeSh2YWx1ZSk7XG4gIH0sIDMwMCk7XG5cbiAgZnVuY3Rpb24gdHJpZ2dlcih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZS5sZW5ndGggPj0gb3B0aW9ucy5taW5DaGFycztcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uY2hhbmdlKGV2ZW50KSB7XG4gICAgY29uc3QgdmFsdWUgPSBldmVudC50ZXh0LnZhbHVlO1xuICAgIGNvbnN0IGNoYW5nZUV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdnZW9wbGV0ZS1jaGFuZ2UnLCB7IGRldGFpbDogdmFsdWUgfSk7XG4gICAgZWwuZGlzcGF0Y2hFdmVudChjaGFuZ2VFdmVudCk7XG4gIH1cblxuICBmdW5jdGlvbiBmcm9tUGxhY2UocGxhY2UpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKFN1Z2dlc3Rpb25zW29wdGlvbnMudHlwZV0pLCBwbGFjZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJNYXRjaGVzKHJlc3VsdCwgdmFsdWUpIHtcbiAgICB2YWx1ZSA9IG5ldyBSZWdFeHAocmVnRXhwRXNjYXBlKHZhbHVlKSwgJ2knKTtcbiAgICByZXR1cm4gcmVzdWx0LmZpbHRlcihmdW5jdGlvbiAoZW50cnkpIHtcbiAgICAgIHJldHVybiB2YWx1ZS50ZXN0KGVudHJ5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1hdGNoaW5nKGxhc3RWYWx1ZSwgdmFsdWUsIGJvdW5kcykge1xuICAgIGlmICghbGFzdFZhbHVlIHx8IGxhc3RWYWx1ZS5ib3VuZHMgIT09IGJvdW5kcykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAobGFzdFZhbHVlLnZhbHVlID09PSB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGxhc3RWYWx1ZTtcbiAgICB9XG4gICAgaWYgKGxhc3RWYWx1ZS52YWx1ZS5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCEobGFzdFZhbHVlLnJlc3VsdCAmJiBsYXN0VmFsdWUucmVzdWx0Lmxlbmd0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gb3B0aW9ucy5maWx0ZXJNYXRjaGVzKGxhc3RWYWx1ZS5yZXN1bHQsIHZhbHVlKTtcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA+PSBNYXRoLm1pbihvcHRpb25zLm1pbk1hdGNoaW5nLCBsYXN0VmFsdWUucmVzdWx0Lmxlbmd0aCkpIHtcbiAgICAgIGxhc3RWYWx1ZS52YWx1ZSA9IHZhbHVlO1xuICAgICAgbGFzdFZhbHVlLnJlc3VsdCA9IHJlc3VsdDtcbiAgICAgIHJldHVybiBsYXN0VmFsdWU7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gcXVlcnkodmFsdWUpIHtcbiAgICBpZiAobWF0Y2hpbmcobGFzdFZhbHVlLCB2YWx1ZSwgb3B0aW9ucy5ib3VuZHMpKSB7XG4gICAgICAvLyBkbyBub3QgcmVxdWVyeSBmb3IgdGhlIHNhbWUgdmFsdWUgb3Igd2hlbiB0aGVyZSBhcmUgZW5vdWdoIG1hdGNoaW5nIGVudHJpZXNcbiAgICAgIGlmIChsYXN0VmFsdWUucmVzdWx0KSB7XG4gICAgICAgIHBvcHVsYXRlKGxhc3RWYWx1ZS5yZXN1bHQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoYWJvcnRDb250cm9sbGVyKSB7XG4gICAgICBhYm9ydENvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgcGFydGlhbDogdHJ1ZSxcbiAgICAgIGJvdW5kczogb3B0aW9ucy5ib3VuZHMsXG4gICAgICBsYW5nOiBvcHRpb25zLmxhbmcgfHwgZG9jdW1lbnQubGFuZyB8fCAnZW4nXG4gICAgfTtcbiAgICBwYXJhbXNbb3B0aW9ucy50eXBlXSA9IHZhbHVlO1xuICAgIGxhc3RWYWx1ZSA9IHtcbiAgICAgIHZhbHVlLFxuICAgICAgYm91bmRzOiBvcHRpb25zLmJvdW5kc1xuICAgIH07XG4gICAgdHJ5IHtcbiAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2dlb3BsZXRlLWluLXByb2dyZXNzJyk7XG4gICAgICBhYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnZW9jb2RlKG9wdGlvbnMuZ2VvUXVlcnkocGFyYW1zKSwgeyBzaWduYWw6IGFib3J0Q29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5wbGFjZXMpIHtcbiAgICAgICAgbGFzdFZhbHVlLnJlc3VsdCA9IHJlc3VsdC5wbGFjZXMubWFwKGZyb21QbGFjZSk7XG4gICAgICAgIHBvcHVsYXRlKGxhc3RWYWx1ZS5yZXN1bHQsIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIGlnbm9yZSBhYm9ydCBhbmQgdGltZW91dCBlcnJvcnNcbiAgICAgIGlmIChlcnJvci5uYW1lICE9PSBcIkFib3J0RXJyb3JcIiAmJiBlcnJvci5jYXVzZSAhPT0gU3ltYm9sLmZvcigndGltZW91dCcpKSB7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBhYm9ydENvbnRyb2xsZXIgPSB1bmRlZmluZWQ7XG4gICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdnZW9wbGV0ZS1pbi1wcm9ncmVzcycpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBvcHVsYXRlKHBsYWNlcywgcmVzdWx0KSB7XG4gICAgYWMubGlzdCA9IHBsYWNlcztcbiAgICBhYy5ldmFsdWF0ZSgpO1xuICAgIGlmIChyZXN1bHQgJiYgcGxhY2VzKSB7XG4gICAgICBwbGFjZXMgPSBwbGFjZXMuc2xpY2UoKTtcbiAgICAgIHBsYWNlcy5wcm92aWRlciA9IHJlc3VsdC5wcm92aWRlcjtcbiAgICAgIHBsYWNlcy5zdGF0cyA9IHJlc3VsdC5zdGF0cztcbiAgICB9XG4gICAgY29uc3QgbGlzdEV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdnZW9wbGV0ZS1saXN0JywgeyBkZXRhaWw6IHBsYWNlcyB9KTtcbiAgICBlbC5kaXNwYXRjaEV2ZW50KGxpc3RFdmVudCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2lucHV0Jywgb25pbnB1dCk7XG4gICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignYXdlc29tcGxldGUtc2VsZWN0Y29tcGxldGUnLCBvbmNoYW5nZSk7XG4gICAgYWMuZGVzdHJveSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0KHByb3BlcnR5LCB2YWx1ZSkge1xuICAgIG9wdGlvbnNbcHJvcGVydHldID0gdmFsdWU7XG4gIH1cblxuICBlbC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIG9uaW5wdXQpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdhd2Vzb21wbGV0ZS1zZWxlY3Rjb21wbGV0ZScsIG9uY2hhbmdlKTtcblxuICByZXR1cm4ge1xuICAgIHBvcHVsYXRlLFxuICAgIHNldCxcbiAgICBkZXN0cm95XG4gIH07XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliJyk7XG4iLCJjb25zdCBub3JtYWxpemUgPSByZXF1aXJlKCcuL25vcm1hbGl6ZScpO1xuY29uc3QgcGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG5jb25zdCBwcmV0dGlmeSA9IHJlcXVpcmUoJy4vcHJldHRpZnknKTtcbmNvbnN0IHN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vc3RyaW5naWZ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBub3JtYWxpemUsXG4gIHBhcnNlLFxuICBwcmV0dGlmeSxcbiAgc3RyaW5naWZ5XG59O1xuIiwiY29uc3QgeyBjb3VudHJ5MmFiYnIgfSA9IHJlcXVpcmUoJy4uL2NvdW50cnknKTtcbmNvbnN0IHsgYWJicjJzdGF0ZSwgc3RhdGUyYWJiciwgc3RhdGUyY291bnRyeSB9ID0gcmVxdWlyZSgnLi4vc3RhdGUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBub3JtYWxpemU7XG5cbi8qKlxuICogTm9ybWFsaXplcyBhbiBhZGRyZXNzXG4gKiBAcGFyYW0geyp9IGFkZHJlc3NcbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKlxuICogQGV4YW1wbGVcbiAqIG5vcm1hbGl6ZSgnMTIzIE1haW4gU3QsIExvcyBBbmdlbGVzLCBDYWxpZm9ybmlhJyk7IC8vID0+ICcxMjMgTWFpbiBTdCxMb3MgQW5nZWxlcyxDQSxVUydcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplKGFkZHJlc3MpIHtcblxuICBpZiAoIWFkZHJlc3MpIHtcbiAgICByZXR1cm4gYWRkcmVzcztcbiAgfVxuXG4gIGxldCBbY291bnRyeSwgc3RhdGUsIHRvd24sIHN0cmVldF0gPSBhZGRyZXNzLnNwbGl0KCcsJykubWFwKHBhcnQgPT4gcGFydC50cmltKCkpLnJldmVyc2UoKTtcblxuICBpZiAoY291bnRyeTJhYmJyW2NvdW50cnldKSB7XG4gICAgY291bnRyeSA9IGNvdW50cnkyYWJicltjb3VudHJ5XTtcbiAgfVxuICBlbHNlIHtcbiAgICBjb25zdCBfc3RhdGUgPSBnZXRTdGF0ZShjb3VudHJ5KTtcbiAgICBjb25zdCBfY291bnRyeSA9IHN0YXRlMmNvdW50cnlbX3N0YXRlXTtcbiAgICBpZiAoX3N0YXRlICYmIF9jb3VudHJ5KSB7XG4gICAgICBzdHJlZXQgPSB0b3duO1xuICAgICAgdG93biA9IHN0YXRlO1xuICAgICAgc3RhdGUgPSBfc3RhdGU7XG4gICAgICBjb3VudHJ5ID0gX2NvdW50cnk7XG4gICAgfVxuICB9XG4gIHN0YXRlID0gZ2V0U3RhdGUoc3RhdGUpO1xuICBpZiAoc3RhdGUgJiYgIShzdHJlZXQgfHwgYWJicjJzdGF0ZVtzdGF0ZV0pKSB7XG4gICAgc3RyZWV0ID0gdG93bjtcbiAgICB0b3duID0gc3RhdGU7XG4gICAgc3RhdGUgPSAnJztcbiAgfVxuXG4gIHJldHVybiBbc3RyZWV0LCB0b3duLCBzdGF0ZSwgY291bnRyeV0ubWFwKHBhcnQgPT4gcGFydCB8fCAnJykuam9pbignLCcpLnJlcGxhY2UoL14sKy8sICcnKTtcbn1cblxuZnVuY3Rpb24gZ2V0U3RhdGUoc3RhdGUpIHtcbiAgbGV0IHVzU3RhdGUgPSAvXihbYS16QS1aXXsyfSkoXFxzK1xcZHs1fSg/Oi1cXGR7NH0pPyk/JC8uZXhlYyhzdGF0ZSk7XG4gIGlmICh1c1N0YXRlKSB7XG4gICAgdXNTdGF0ZSA9IHVzU3RhdGVbMV0udG9VcHBlckNhc2UoKTtcbiAgfVxuICBpZiAodXNTdGF0ZSkge1xuICAgIHN0YXRlID0gdXNTdGF0ZTtcbiAgfVxuICBlbHNlIHtcbiAgICBzdGF0ZSA9IHN0YXRlMmFiYnJbc3RhdGVdIHx8IHN0YXRlO1xuICB9XG4gIHJldHVybiBzdGF0ZTtcbn1cbiIsImNvbnN0IHsgYWJicjJjb3VudHJ5IH0gPSByZXF1aXJlKCcuLi9jb3VudHJ5Jyk7XG5jb25zdCB7IHN0YXRlMmNvdW50cnkgfSA9IHJlcXVpcmUoJy4uL3N0YXRlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2U7XG5cbi8qKlxuICogUGFyc2VzIGFuIGFkZHJlc3Mgc3RyaW5nXG4gKiBAcGFyYW0ge3N0cmluZ30gYWRkcmVzcyB0aGUgYWRkcmVzcyBzdHJpbmdcbiAqIEByZXR1cm5zIHtPYmplY3R9IHRoZSBwYXJzZWQgYWRkcmVzc1xuICpcbiAqIEBleGFtcGxlXG4gKiBwYXJzZSgnMSBzdHJlZXQsdG93bixwcm92aW5jZSxjb3VudHJ5Jyk7XG4gKiAvLyA9PiB7IGhvdXNlOiAnMScsIHN0cmVldDogJ3N0cmVldCcsIHRvd246ICd0b3duJywgcHJvdmluY2U6ICdwcm92aW5jZScsIGNvdW50cnk6ICdjb3VudHJ5JyB9XG4gKi9cbmZ1bmN0aW9uIHBhcnNlKGFkZHJlc3MpIHtcbiAgaWYgKCFhZGRyZXNzKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IHBhcnRzID0gYWRkcmVzcy5zcGxpdCgnLCcpO1xuICBpZiAocGFydHMubGVuZ3RoID4gNCkge1xuICAgIHJldHVybjsgLy8gZG9uJ3QgZXZlbiB0cnkgdG8gcGFyc2VcbiAgfVxuICB3aGlsZSAocGFydHMubGVuZ3RoIDwgNCkge1xuICAgIHBhcnRzLnVuc2hpZnQoJycpO1xuICB9XG4gIGxldCBbc3RyZWV0LCB0b3duLCBwcm92aW5jZSwgY291bnRyeV0gPSBwYXJ0cztcbiAgaWYgKCFjb3VudHJ5ICYmIHByb3ZpbmNlKSB7XG4gICAgY291bnRyeSA9IHN0YXRlMmNvdW50cnlbcHJvdmluY2VdO1xuICB9XG4gIGlmIChjb3VudHJ5ID09PSAnVVMnKSB7XG4gICAgY291bnRyeSA9ICdVU0EnO1xuICB9XG4gIGVsc2Uge1xuICAgIGNvdW50cnkgPSBhYmJyMmNvdW50cnlbY291bnRyeV0gfHwgY291bnRyeTtcbiAgfVxuICAvLyBleHRyYWN0IG51bWJlciBmcm9tIHN0cmVldFxuICBsZXQgaG91c2UgPSBzdHJlZXQubWF0Y2goL15cXGQrW15cXHNdXFxzLyk7XG4gIGlmIChob3VzZSkge1xuICAgIHN0cmVldCA9IHN0cmVldC5yZXBsYWNlKGhvdXNlLCAnJyk7XG4gICAgaG91c2UgPSBob3VzZVswXS50cmltKCk7XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHtcbiAgICBob3VzZSxcbiAgICBzdHJlZXQsXG4gICAgdG93bixcbiAgICBwcm92aW5jZSxcbiAgICBjb3VudHJ5XG4gIH0pLnJlZHVjZSgob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIG9ialtrZXldID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH0sIHt9KTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcHJldHRpZnk7XG5cbmNvbnN0IHtcbiAgYWJicjJjb3VudHJ5XG59ID0gcmVxdWlyZSgnLi4vY291bnRyeScpO1xuY29uc3QgeyBhYmJyMnN0YXRlIH0gPSByZXF1aXJlKCcuLi9zdGF0ZScpO1xuXG4vKipcbiAqIE1ha2VzIGFuZCBhZGRyZXNzIG1vcmUgcmVhZGVhYmxlXG4gKiBAcGFyYW0ge3N0cmluZ30gYWRkcmVzc1xuICogQHJldHVybnMge3N0cmluZ31cbiAqXG4gKiBAZXhhbXBsZVxuICogcHJldHRpZnkoJzEgc3RyZWV0LGNpdHksc3RhdGUsY291bnRyeScpOyAvLyA9PiAnMSBzdHJlZXQsIGNpdHksIHN0YXRlLCBjb3VudHJ5J1xuICogcHJldHRpZnkoJzEgc3RyZWV0LCxzdGF0ZSxjb3VudHJ5Jyk7IC8vID0+ICcxIHN0cmVldCwgc3RhdGUsIGNvdW50cnknXG4gKiBwcmV0dGlmeSgnLGNpdHksLGNvdW50cnknKTsgLy8gPT4gJ2NpdHksIGNvdW50cnknXG4gKiBwcmV0dGlmeSgnY2l0eSwsY291bnRyeScpOyAvLyA9PiAnY2l0eSwgY291bnRyeSdcbiAqL1xuZnVuY3Rpb24gcHJldHRpZnkoYWRkcmVzcykge1xuICBpZiAoIWFkZHJlc3MpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgY29uc3QgcGFydHMgPSBhZGRyZXNzLnNwbGl0KCcsJykubWFwKHBhcnQgPT4gcGFydC50cmltKCkpO1xuICBpZiAocGFydHMubGVuZ3RoID4gNCkge1xuICAgIHJldHVybiBwcmV0dHkocGFydHMpO1xuICB9XG4gIHdoaWxlIChwYXJ0cy5sZW5ndGggPCA0KSB7XG4gICAgcGFydHMudW5zaGlmdCgnJyk7XG4gIH1cbiAgcGFydHNbM10gPSBhYmJyMmNvdW50cnlbcGFydHNbM11dIHx8IHBhcnRzWzNdO1xuICBpZiAoIShwYXJ0c1swXSB8fCBwYXJ0c1sxXSkpIHtcbiAgICBpZiAoIXBhcnRzWzJdKSB7XG4gICAgICByZXR1cm4gcGFydHNbM107XG4gICAgfVxuICAgIHBhcnRzWzJdID0gYWJicjJzdGF0ZVtwYXJ0c1syXV0gfHwgcGFydHNbMl07XG4gICAgaWYgKHBhcnRzWzNdID09PSAnVW5pdGVkIFN0YXRlcycpIHtcbiAgICAgIHBhcnRzWzNdID0gJ1VTQSc7XG4gICAgfVxuICB9XG4gIGlmIChwYXJ0c1szXSA9PT0gJ1VuaXRlZCBTdGF0ZXMnKSB7XG4gICAgcGFydHMubGVuZ3RoID0gMztcbiAgfVxuICBlbHNlIHtcbiAgICBpZiAocGFydHNbMV0gPT09IHBhcnRzWzJdKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoMiwgMSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmV0dHkocGFydHMpO1xufVxuXG5mdW5jdGlvbiBwcmV0dHkocGFydHMpIHtcbiAgcmV0dXJuIHBhcnRzLmZpbHRlcihCb29sZWFuKS5qb2luKCcsICcpO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBzdHJpbmdpZnk7XG5cbmNvbnN0IHtcbiAgY291bnRyeTJhYmJyXG59ID0gcmVxdWlyZSgnLi4vY291bnRyeScpO1xuXG5jb25zdCB7XG4gIHN0YXRlMmFiYnIsXG4gIHN0YXRlMmNvdW50cnlcbn0gPSByZXF1aXJlKCcuLi9zdGF0ZScpO1xuXG4vKipcbiAqIFN0cmluZ2lmaWVzIGFuIGFkZHJlc3Mgc3BlY2lmaWNhdGlvbi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBzcGVjIC0gVGhlIGFkZHJlc3Mgc3BlY2lmaWNhdGlvbi5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHN0cmluZ2lmaWVkIGFkZHJlc3MuXG4gKlxuICogQGV4YW1wbGVcbiAqIHN0cmluZ2lmeSh7IGhvdXNlOiAxLCBzdHJlZXQ6ICdzdHJlZXQnLCB0b3duOiAndG93bicsIHByb3ZpbmNlOiAncHJvdmluY2UnLCBjb3VudHJ5OiAnY291bnRyeScgfSk7XG4gKiAvLyA9PiAnMSBzdHJlZXQsdG93bixwcm92aW5jZSxjb3VudHJ5J1xuICpcbiAqIHN0cmluZ2lmeSh7IGhvdXNlOiAxLCBzdHJlZXQ6ICdzdHJlZXQnLCBwcm92aW5jZTogJ3Byb3ZpbmNlJ30pO1xuICogLy8gPT4gJzEgc3RyZWV0LCxwcm92aW5jZSxjb3VudHJ5J1xuICpcbiAqIHN0cmluZ2lmeSh7IGhvdXNlOiAxLCBzdHJlZXQ6ICdzdHJlZXQnLCBwcm92aW5jZTogJ3Byb3ZpbmNlJ30pO1xuICogLy8gPT4gJzEgc3RyZWV0LCxwcm92aW5jZSwnXG4gKlxuICogc3RyaW5naWZ5KHsgaG91c2U6IDEsIHRvd246ICd0b3duJywgY291bnRyeTogJ2NvdW50cnknIH0pO1xuICogLy8gPT4gJzEsdG93biwsY291bnRyeSdcbiAqXG4gKiBzdHJpbmdpZnkoeyBzdHJlZXQ6ICdzdHJlZXQnLCB0b3duOiAndG93bicgfSk7XG4gKiAvLyA9PiAnc3RyZWV0LHRvd24sLCdcbiAqXG4gKiAgKiBzdHJpbmdpZnkoe30pO1xuICogLy8gPT4gJydcbiAqXG4gKiBzdHJpbmdpZnkoKTtcbiAqIC8vID0+IHVuZGVmaW5lZFxuICovXG5mdW5jdGlvbiBzdHJpbmdpZnkoc3BlYykge1xuICBpZiAoIXNwZWMpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgeyBob3VzZSwgc3RyZWV0LCB0b3duLCBwcm92aW5jZSwgY291bnRyeSB9ID0gc3BlYztcblxuICBjb3VudHJ5ID0gY291bnRyeTJhYmJyW2NvdW50cnldIHx8IGNvdW50cnk7XG4gIHByb3ZpbmNlID0gc3RhdGUyYWJicltwcm92aW5jZV0gfHwgcHJvdmluY2U7XG4gIGlmICghY291bnRyeSkge1xuICAgIGNvdW50cnkgPSBzdGF0ZTJjb3VudHJ5W3Byb3ZpbmNlXTtcbiAgfVxuXG4gIGlmIChob3VzZSkge1xuICAgIGlmIChzdHJlZXQpIHtcbiAgICAgIHN0cmVldCA9IFtob3VzZSwgc3RyZWV0XS5qb2luKCcgJyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgc3RyZWV0ID0gaG91c2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFtzdHJlZXQsIHRvd24sIHByb3ZpbmNlLCBjb3VudHJ5XS5tYXAocCA9PiBwID8/ICcnKS5qb2luKCcsJykucmVwbGFjZSgvXiwrLywgJycpO1xufVxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIkFEXCI6IFwiQW5kb3JyYVwiLFxuICBcIkFFXCI6IFwiVW5pdGVkIEFyYWIgRW1pcmF0ZXNcIixcbiAgXCJBRlwiOiBcIkFmZ2hhbmlzdGFuXCIsXG4gIFwiQUdcIjogXCJBbnRpZ3VhIGFuZCBCYXJidWRhXCIsXG4gIFwiQUlcIjogXCJBbmd1aWxsYVwiLFxuICBcIkFMXCI6IFwiQWxiYW5pYVwiLFxuICBcIkFNXCI6IFwiQXJtZW5pYVwiLFxuICBcIkFPXCI6IFwiQW5nb2xhXCIsXG4gIFwiQVFcIjogXCJBbnRhcmN0aWNhXCIsXG4gIFwiQVJcIjogXCJBcmdlbnRpbmFcIixcbiAgXCJBU1wiOiBcIkFtZXJpY2FuIFNhbW9hXCIsXG4gIFwiQVRcIjogXCJBdXN0cmlhXCIsXG4gIFwiQVVcIjogXCJBdXN0cmFsaWFcIixcbiAgXCJBV1wiOiBcIkFydWJhXCIsXG4gIFwiQVhcIjogXCJBbGFuZCBJc2xhbmRzXCIsXG4gIFwiQVpcIjogXCJBemVyYmFpamFuXCIsXG4gIFwiQkFcIjogXCJCb3NuaWEgYW5kIEhlcnplZ292aW5hXCIsXG4gIFwiQkJcIjogXCJCYXJiYWRvc1wiLFxuICBcIkJEXCI6IFwiQmFuZ2xhZGVzaFwiLFxuICBcIkJFXCI6IFwiQmVsZ2l1bVwiLFxuICBcIkJGXCI6IFwiQnVya2luYSBGYXNvXCIsXG4gIFwiQkdcIjogXCJCdWxnYXJpYVwiLFxuICBcIkJIXCI6IFwiQmFocmFpblwiLFxuICBcIkJJXCI6IFwiQnVydW5kaVwiLFxuICBcIkJKXCI6IFwiQmVuaW5cIixcbiAgXCJCTFwiOiBcIlNhaW50IEJhcnRoZWxlbXlcIixcbiAgXCJCTVwiOiBcIkJlcm11ZGFcIixcbiAgXCJCTlwiOiBcIkJydW5laVwiLFxuICBcIkJPXCI6IFwiQm9saXZpYVwiLFxuICBcIkJRXCI6IFwiQ2FyaWJiZWFuIE5ldGhlcmxhbmRzXCIsXG4gIFwiQlJcIjogXCJCcmF6aWxcIixcbiAgXCJCU1wiOiBcIkJhaGFtYXNcIixcbiAgXCJCVFwiOiBcIkJodXRhblwiLFxuICBcIkJWXCI6IFwiQm91dmV0IElzbGFuZFwiLFxuICBcIkJXXCI6IFwiQm90c3dhbmFcIixcbiAgXCJCWVwiOiBcIkJlbGFydXNcIixcbiAgXCJCWlwiOiBcIkJlbGl6ZVwiLFxuICBcIkNBXCI6IFwiQ2FuYWRhXCIsXG4gIFwiQ0NcIjogXCJDb2NvcyAoS2VlbGluZykgSXNsYW5kc1wiLFxuICBcIkNEXCI6IFwiRGVtb2NyYXRpYyBSZXB1YmxpYyBvZiBDb25nb1wiLFxuICBcIkNGXCI6IFwiQ2VudHJhbCBBZnJpY2FuIFJlcHVibGljXCIsXG4gIFwiQ0dcIjogXCJDb25nb1wiLFxuICBcIkNIXCI6IFwiU3dpdHplcmxhbmRcIixcbiAgXCJDSVwiOiBcIkl2b3J5IENvYXN0XCIsXG4gIFwiQ0tcIjogXCJDb29rIElzbGFuZHNcIixcbiAgXCJDTFwiOiBcIkNoaWxlXCIsXG4gIFwiQ01cIjogXCJDYW1lcm9vblwiLFxuICBcIkNOXCI6IFwiQ2hpbmFcIixcbiAgXCJDT1wiOiBcIkNvbG9tYmlhXCIsXG4gIFwiQ1JcIjogXCJDb3N0YSBSaWNhXCIsXG4gIFwiQ1VcIjogXCJDdWJhXCIsXG4gIFwiQ1ZcIjogXCJDYXBlIFZlcmRlXCIsXG4gIFwiQ1dcIjogXCJDdXJhY2FvXCIsXG4gIFwiQ1hcIjogXCJDaHJpc3RtYXMgSXNsYW5kXCIsXG4gIFwiQ1lcIjogXCJDeXBydXNcIixcbiAgXCJDWlwiOiBcIkN6ZWNoIFJlcHVibGljXCIsXG4gIFwiREVcIjogXCJHZXJtYW55XCIsXG4gIFwiREpcIjogXCJEamlib3V0aVwiLFxuICBcIkRLXCI6IFwiRGVubWFya1wiLFxuICBcIkRNXCI6IFwiRG9taW5pY2FcIixcbiAgXCJET1wiOiBcIkRvbWluaWNhbiBSZXB1YmxpY1wiLFxuICBcIkRaXCI6IFwiQWxnZXJpYVwiLFxuICBcIkVDXCI6IFwiRWN1YWRvclwiLFxuICBcIkVFXCI6IFwiRXN0b25pYVwiLFxuICBcIkVHXCI6IFwiRWd5cHRcIixcbiAgXCJFSFwiOiBcIldlc3Rlcm4gU2FoYXJhXCIsXG4gIFwiRVJcIjogXCJFcml0cmVhXCIsXG4gIFwiRVNcIjogXCJTcGFpblwiLFxuICBcIkVUXCI6IFwiRXRoaW9waWFcIixcbiAgXCJGSVwiOiBcIkZpbmxhbmRcIixcbiAgXCJGSlwiOiBcIkZpamlcIixcbiAgXCJGS1wiOiBcIkZhbGtsYW5kIElzbGFuZHNcIixcbiAgXCJGTVwiOiBcIkZlZGVyYXRlZCBTdGF0ZXMgb2YgTWljcm9uZXNpYVwiLFxuICBcIkZPXCI6IFwiRmFyb2UgSXNsYW5kc1wiLFxuICBcIkZSXCI6IFwiRnJhbmNlXCIsXG4gIFwiR0FcIjogXCJHYWJvblwiLFxuICBcIkdCXCI6IFwiVW5pdGVkIEtpbmdkb21cIixcbiAgXCJHRFwiOiBcIkdyZW5hZGFcIixcbiAgXCJHRVwiOiBcIkdlb3JnaWFcIixcbiAgXCJHRlwiOiBcIkZyZW5jaCBHdWlhbmFcIixcbiAgXCJHR1wiOiBcIkd1ZXJuc2V5XCIsXG4gIFwiR0hcIjogXCJHaGFuYVwiLFxuICBcIkdJXCI6IFwiR2licmFsdGFyXCIsXG4gIFwiR0xcIjogXCJHcmVlbmxhbmRcIixcbiAgXCJHTVwiOiBcIkdhbWJpYVwiLFxuICBcIkdOXCI6IFwiR3VpbmVhXCIsXG4gIFwiR1BcIjogXCJHdWFkZWxvdXBlXCIsXG4gIFwiR1FcIjogXCJFcXVhdG9yaWFsIEd1aW5lYVwiLFxuICBcIkdSXCI6IFwiR3JlZWNlXCIsXG4gIFwiR1NcIjogXCJTb3V0aCBHZW9yZ2lhIGFuZCB0aGUgU291dGggU2FuZHdpY2ggSXNsYW5kc1wiLFxuICBcIkdUXCI6IFwiR3VhdGVtYWxhXCIsXG4gIFwiR1VcIjogXCJHdWFtXCIsXG4gIFwiR1dcIjogXCJHdWluZWEtQmlzc2F1XCIsXG4gIFwiR1lcIjogXCJHdXlhbmFcIixcbiAgXCJIS1wiOiBcIkhvbmcgS29uZ1wiLFxuICBcIkhNXCI6IFwiSGVhcmQgYW5kIE1jRG9uYWxkIElzbGFuZHNcIixcbiAgXCJITlwiOiBcIkhvbmR1cmFzXCIsXG4gIFwiSFJcIjogXCJDcm9hdGlhXCIsXG4gIFwiSFRcIjogXCJIYWl0aVwiLFxuICBcIkhVXCI6IFwiSHVuZ2FyeVwiLFxuICBcIklEXCI6IFwiSW5kb25lc2lhXCIsXG4gIFwiSUVcIjogXCJJcmVsYW5kXCIsXG4gIFwiSUxcIjogXCJJc3JhZWxcIixcbiAgXCJJTVwiOiBcIklzbGUgb2YgTWFuXCIsXG4gIFwiSU5cIjogXCJJbmRpYVwiLFxuICBcIklPXCI6IFwiQnJpdGlzaCBJbmRpYW4gT2NlYW4gVGVycml0b3J5XCIsXG4gIFwiSVFcIjogXCJJcmFxXCIsXG4gIFwiSVJcIjogXCJJcmFuXCIsXG4gIFwiSVNcIjogXCJJY2VsYW5kXCIsXG4gIFwiSVRcIjogXCJJdGFseVwiLFxuICBcIkpFXCI6IFwiSmVyc2V5XCIsXG4gIFwiSk1cIjogXCJKYW1haWNhXCIsXG4gIFwiSk9cIjogXCJKb3JkYW5cIixcbiAgXCJKUFwiOiBcIkphcGFuXCIsXG4gIFwiS0VcIjogXCJLZW55YVwiLFxuICBcIktHXCI6IFwiS3lyZ3l6c3RhblwiLFxuICBcIktIXCI6IFwiQ2FtYm9kaWFcIixcbiAgXCJLSVwiOiBcIktpcmliYXRpXCIsXG4gIFwiS01cIjogXCJDb21vcm9zXCIsXG4gIFwiS05cIjogXCJTYWludCBLaXR0cyBhbmQgTmV2aXNcIixcbiAgXCJLUFwiOiBcIk5vcnRoIEtvcmVhXCIsXG4gIFwiS1JcIjogXCJTb3V0aCBLb3JlYVwiLFxuICBcIktXXCI6IFwiS3V3YWl0XCIsXG4gIFwiS1lcIjogXCJDYXltYW4gSXNsYW5kc1wiLFxuICBcIktaXCI6IFwiS2F6YWtoc3RhblwiLFxuICBcIkxBXCI6IFwiTGFvIFBlb3BsZSdzIERlbW9jcmF0aWMgUmVwdWJsaWNcIixcbiAgXCJMQlwiOiBcIkxlYmFub25cIixcbiAgXCJMQ1wiOiBcIlNhaW50IEx1Y2lhXCIsXG4gIFwiTElcIjogXCJMaWVjaHRlbnN0ZWluXCIsXG4gIFwiTEtcIjogXCJTcmkgTGFua2FcIixcbiAgXCJMUlwiOiBcIkxpYmVyaWFcIixcbiAgXCJMU1wiOiBcIkxlc290aG9cIixcbiAgXCJMVFwiOiBcIkxpdGh1YW5pYVwiLFxuICBcIkxVXCI6IFwiTHV4ZW1ib3VyZ1wiLFxuICBcIkxWXCI6IFwiTGF0dmlhXCIsXG4gIFwiTFlcIjogXCJMaWJ5YVwiLFxuICBcIk1BXCI6IFwiTW9yb2Njb1wiLFxuICBcIk1DXCI6IFwiTW9uYWNvXCIsXG4gIFwiTURcIjogXCJNb2xkb3ZhXCIsXG4gIFwiTUVcIjogXCJNb250ZW5lZ3JvXCIsXG4gIFwiTUZcIjogXCJTYWludC1NYXJ0aW5cIixcbiAgXCJNR1wiOiBcIk1hZGFnYXNjYXJcIixcbiAgXCJNSFwiOiBcIk1hcnNoYWxsIElzbGFuZHNcIixcbiAgXCJNS1wiOiBcIk5vcnRoIE1hY2Vkb25pYVwiLFxuICBcIk1MXCI6IFwiTWFsaVwiLFxuICBcIk1NXCI6IFwiTXlhbm1hclwiLFxuICBcIk1OXCI6IFwiTW9uZ29saWFcIixcbiAgXCJNT1wiOiBcIk1hY2F1XCIsXG4gIFwiTVBcIjogXCJOb3J0aGVybiBNYXJpYW5hIElzbGFuZHNcIixcbiAgXCJNUVwiOiBcIk1hcnRpbmlxdWVcIixcbiAgXCJNUlwiOiBcIk1hdXJpdGFuaWFcIixcbiAgXCJNU1wiOiBcIk1vbnRzZXJyYXRcIixcbiAgXCJNVFwiOiBcIk1hbHRhXCIsXG4gIFwiTVVcIjogXCJNYXVyaXRpdXNcIixcbiAgXCJNVlwiOiBcIk1hbGRpdmVzXCIsXG4gIFwiTVdcIjogXCJNYWxhd2lcIixcbiAgXCJNWFwiOiBcIk1leGljb1wiLFxuICBcIk1ZXCI6IFwiTWFsYXlzaWFcIixcbiAgXCJNWlwiOiBcIk1vemFtYmlxdWVcIixcbiAgXCJOQVwiOiBcIk5hbWliaWFcIixcbiAgXCJOQ1wiOiBcIk5ldyBDYWxlZG9uaWFcIixcbiAgXCJORVwiOiBcIk5pZ2VyXCIsXG4gIFwiTkZcIjogXCJOb3Jmb2xrIElzbGFuZFwiLFxuICBcIk5HXCI6IFwiTmlnZXJpYVwiLFxuICBcIk5JXCI6IFwiTmljYXJhZ3VhXCIsXG4gIFwiTkxcIjogXCJUaGUgTmV0aGVybGFuZHNcIixcbiAgXCJOT1wiOiBcIk5vcndheVwiLFxuICBcIk5QXCI6IFwiTmVwYWxcIixcbiAgXCJOUlwiOiBcIk5hdXJ1XCIsXG4gIFwiTlVcIjogXCJOaXVlXCIsXG4gIFwiTlpcIjogXCJOZXcgWmVhbGFuZFwiLFxuICBcIk9NXCI6IFwiT21hblwiLFxuICBcIlBBXCI6IFwiUGFuYW1hXCIsXG4gIFwiUEVcIjogXCJQZXJ1XCIsXG4gIFwiUEZcIjogXCJGcmVuY2ggUG9seW5lc2lhXCIsXG4gIFwiUEdcIjogXCJQYXB1YSBOZXcgR3VpbmVhXCIsXG4gIFwiUEhcIjogXCJQaGlsaXBwaW5lc1wiLFxuICBcIlBLXCI6IFwiUGFraXN0YW5cIixcbiAgXCJQTFwiOiBcIlBvbGFuZFwiLFxuICBcIlBNXCI6IFwiU3QuIFBpZXJyZSBhbmQgTWlxdWVsb25cIixcbiAgXCJQTlwiOiBcIlBpdGNhaXJuXCIsXG4gIFwiUFJcIjogXCJQdWVydG8gUmljb1wiLFxuICBcIlBTXCI6IFwiUGFsZXN0aW5lXCIsXG4gIFwiUFRcIjogXCJQb3J0dWdhbFwiLFxuICBcIlBXXCI6IFwiUGFsYXVcIixcbiAgXCJQWVwiOiBcIlBhcmFndWF5XCIsXG4gIFwiUUFcIjogXCJRYXRhclwiLFxuICBcIlJFXCI6IFwiUmV1bmlvblwiLFxuICBcIlJPXCI6IFwiUm9tYW5pYVwiLFxuICBcIlJTXCI6IFwiU2VyYmlhXCIsXG4gIFwiUlVcIjogXCJSdXNzaWFcIixcbiAgXCJSV1wiOiBcIlJ3YW5kYVwiLFxuICBcIlNBXCI6IFwiU2F1ZGkgQXJhYmlhXCIsXG4gIFwiU0JcIjogXCJTb2xvbW9uIElzbGFuZHNcIixcbiAgXCJTQ1wiOiBcIlNleWNoZWxsZXNcIixcbiAgXCJTRFwiOiBcIlN1ZGFuXCIsXG4gIFwiU0VcIjogXCJTd2VkZW5cIixcbiAgXCJTR1wiOiBcIlNpbmdhcG9yZVwiLFxuICBcIlNIXCI6IFwiU2FpbnQgSGVsZW5hLCBBc2NlbnNpb24gYW5kIFRyaXN0YW4gZGEgQ3VuaGFcIixcbiAgXCJTSVwiOiBcIlNsb3ZlbmlhXCIsXG4gIFwiU0pcIjogXCJTdmFsYmFyZCBhbmQgSmFuIE1heWVuIElzbGFuZHNcIixcbiAgXCJTS1wiOiBcIlNsb3Zha2lhXCIsXG4gIFwiU0xcIjogXCJTaWVycmEgTGVvbmVcIixcbiAgXCJTTVwiOiBcIlNhbiBNYXJpbm9cIixcbiAgXCJTTlwiOiBcIlNlbmVnYWxcIixcbiAgXCJTT1wiOiBcIlNvbWFsaWFcIixcbiAgXCJTUlwiOiBcIlN1cmluYW1lXCIsXG4gIFwiU1NcIjogXCJTb3V0aCBTdWRhblwiLFxuICBcIlNUXCI6IFwiU2FvIFRvbWUgYW5kIFByaW5jaXBlXCIsXG4gIFwiU1ZcIjogXCJFbCBTYWx2YWRvclwiLFxuICBcIlNYXCI6IFwiU2ludCBNYWFydGVuXCIsXG4gIFwiU1lcIjogXCJTeXJpYVwiLFxuICBcIlNaXCI6IFwiRXN3YXRpbmlcIixcbiAgXCJUQ1wiOiBcIlR1cmtzIGFuZCBDYWljb3MgSXNsYW5kc1wiLFxuICBcIlREXCI6IFwiQ2hhZFwiLFxuICBcIlRGXCI6IFwiRnJlbmNoIFNvdXRoZXJuIFRlcnJpdG9yaWVzXCIsXG4gIFwiVEdcIjogXCJUb2dvXCIsXG4gIFwiVEhcIjogXCJUaGFpbGFuZFwiLFxuICBcIlRKXCI6IFwiVGFqaWtpc3RhblwiLFxuICBcIlRLXCI6IFwiVG9rZWxhdVwiLFxuICBcIlRMXCI6IFwiVGltb3ItTGVzdGVcIixcbiAgXCJUTVwiOiBcIlR1cmttZW5pc3RhblwiLFxuICBcIlROXCI6IFwiVHVuaXNpYVwiLFxuICBcIlRPXCI6IFwiVG9uZ2FcIixcbiAgXCJUUlwiOiBcIlR1cmtleVwiLFxuICBcIlRUXCI6IFwiVHJpbmlkYWQgYW5kIFRvYmFnb1wiLFxuICBcIlRWXCI6IFwiVHV2YWx1XCIsXG4gIFwiVFdcIjogXCJUYWl3YW5cIixcbiAgXCJUWlwiOiBcIlRhbnphbmlhXCIsXG4gIFwiVUFcIjogXCJVa3JhaW5lXCIsXG4gIFwiVUdcIjogXCJVZ2FuZGFcIixcbiAgXCJVTVwiOiBcIlVuaXRlZCBTdGF0ZXMgTWlub3IgT3V0bHlpbmcgSXNsYW5kc1wiLFxuICBcIlVTXCI6IFwiVW5pdGVkIFN0YXRlc1wiLFxuICBcIlVZXCI6IFwiVXJ1Z3VheVwiLFxuICBcIlVaXCI6IFwiVXpiZWtpc3RhblwiLFxuICBcIlZBXCI6IFwiVmF0aWNhblwiLFxuICBcIlZDXCI6IFwiU2FpbnQgVmluY2VudCBhbmQgdGhlIEdyZW5hZGluZXNcIixcbiAgXCJWRVwiOiBcIlZlbmV6dWVsYVwiLFxuICBcIlZHXCI6IFwiQnJpdGlzaCBWaXJnaW4gSXNsYW5kc1wiLFxuICBcIlZJXCI6IFwiVVMgVmlyZ2luIElzbGFuZHNcIixcbiAgXCJWTlwiOiBcIlZpZXRuYW1cIixcbiAgXCJWVVwiOiBcIlZhbnVhdHVcIixcbiAgXCJXRlwiOiBcIldhbGxpcyBhbmQgRnV0dW5hIElzbGFuZHNcIixcbiAgXCJXU1wiOiBcIlNhbW9hXCIsXG4gIFwiWEtcIjogXCJLb3Nvdm9cIixcbiAgXCJZRVwiOiBcIlllbWVuXCIsXG4gIFwiWVRcIjogXCJNYXlvdHRlXCIsXG4gIFwiWkFcIjogXCJTb3V0aCBBZnJpY2FcIixcbiAgXCJaTVwiOiBcIlphbWJpYVwiLFxuICBcIlpXXCI6IFwiWmltYmFid2VcIlxufVxuIiwiY29uc3QgeyBrZXlzMnZhbHVlcyB9ID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5jb25zdCBhYmJyMmNvdW50cnkgPSByZXF1aXJlKCcuL2NvdW50cmllcy5qc29uJyk7XG5jb25zdCBjb3VudHJ5MmFiYnIgPSBrZXlzMnZhbHVlcyhhYmJyMmNvdW50cnkpO1xuXG4vLyBhZGQgc29tZSBhbGlhc2VzXG5jb3VudHJ5MmFiYnJbJ0JyYXNpbCddID0gJ0JSJztcbmNvdW50cnkyYWJiclsnUG9sc2thJ10gPSAnUEwnO1xuY291bnRyeTJhYmJyWydVbml0ZWQgU3RhdGVzJ10gPSAnVVMnO1xuY291bnRyeTJhYmJyWydVbml0ZWQgU3RhdGVzIG9mIEFtZXJpY2EnXSA9ICdVUyc7XG5jb3VudHJ5MmFiYnIuVVNBID0gJ1VTJztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNvdW50cnkyYWJicixcbiAgYWJicjJjb3VudHJ5XG59O1xuIiwiY29uc3QgYWRkcmVzcyA9IHJlcXVpcmUoJy4vYWRkcmVzcycpO1xuY29uc3QgY291bnRyeSA9IHJlcXVpcmUoJy4vY291bnRyeScpO1xuY29uc3Qgc3RhdGUgPSByZXF1aXJlKCcuL3N0YXRlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAuLi5hZGRyZXNzLFxuICAuLi5jb3VudHJ5LFxuICAuLi5zdGF0ZVxufTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJBbGJlcnRhXCI6IFwiQUJcIixcbiAgXCJCcml0aXNoIENvbHVtYmlhXCI6IFwiQkNcIixcbiAgXCJNYW5pdG9iYVwiOiBcIk1CXCIsXG4gIFwiTmV3IEJydW5zd2lja1wiOiBcIk5CXCIsXG4gIFwiTmV3Zm91bmRsYW5kIGFuZCBMYWJyYWRvclwiOiBcIk5MXCIsXG4gIFwiTm9ydGh3ZXN0IFRlcnJpdG9yaWVzXCI6IFwiTlRcIixcbiAgXCJOb3ZhIFNjb3RpYVwiOiBcIk5TXCIsXG4gIFwiTnVuYXZ1dFwiOiBcIk5VXCIsXG4gIFwiT250YXJpb1wiOiBcIk9OXCIsXG4gIFwiUHJpbmNlIEVkd2FyZCBJc2xhbmRcIjogXCJQRVwiLFxuICBcIlF1ZWJlY1wiOiBcIlFDXCIsXG4gIFwiU2Fza2F0Y2hld2FuXCI6IFwiU0tcIixcbiAgXCJZdWtvblwiOiBcIllUXCJcbn1cbiIsImNvbnN0IHsga2V5czJ2YWx1ZXMgfSA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxuY29uc3QgY291bnRyeTJzdGF0ZXMgPSB7XG4gIENBOiBrZXlzMnZhbHVlcyhyZXF1aXJlKCcuL2NhLmpzb24nKSksXG4gIFVTOiBrZXlzMnZhbHVlcyhyZXF1aXJlKCcuL3VzLmpzb24nKSlcbn07XG5cbmNvbnN0IGFiYnIyc3RhdGUgPSBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIGNvdW50cnkyc3RhdGVzLlVTLCBjb3VudHJ5MnN0YXRlcy5DQSk7XG5jb25zdCBzdGF0ZTJhYmJyID0ga2V5czJ2YWx1ZXMoYWJicjJzdGF0ZSk7XG5jb25zdCBzdGF0ZTJjb3VudHJ5ID0gT2JqZWN0LmVudHJpZXMoY291bnRyeTJzdGF0ZXMpLnJlZHVjZShcbiAgKG9iaiwgW2NvdW50cnksIHN0YXRlc10pID0+IE9iamVjdC5hc3NpZ24ob2JqLCBPYmplY3Qua2V5cyhzdGF0ZXMpLnJlZHVjZShcbiAgICAob2JqLCBzdGF0ZSkgPT4ge1xuICAgICAgb2JqW3N0YXRlXSA9IGNvdW50cnk7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH0sIG9iaikpLFxuICBPYmplY3QuY3JlYXRlKG51bGwpKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFiYnIyc3RhdGUsXG4gIGNvdW50cnkyc3RhdGVzLFxuICBzdGF0ZTJhYmJyLFxuICBzdGF0ZTJjb3VudHJ5XG59O1xuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIkFsYWJhbWFcIjogXCJBTFwiLFxuICBcIkFsYXNrYVwiOiBcIkFLXCIsXG4gIFwiQXJpem9uYVwiOiBcIkFaXCIsXG4gIFwiQXJrYW5zYXNcIjogXCJBUlwiLFxuICBcIkNhbGlmb3JuaWFcIjogXCJDQVwiLFxuICBcIkNvbG9yYWRvXCI6IFwiQ09cIixcbiAgXCJDb25uZWN0aWN1dFwiOiBcIkNUXCIsXG4gIFwiRGVsYXdhcmVcIjogXCJERVwiLFxuICBcIkRpc3RyaWN0IG9mIENvbHVtYmlhXCI6IFwiRENcIixcbiAgXCJGbG9yaWRhXCI6IFwiRkxcIixcbiAgXCJHZW9yZ2lhXCI6IFwiR0FcIixcbiAgXCJIYXdhaWlcIjogXCJISVwiLFxuICBcIklkYWhvXCI6IFwiSURcIixcbiAgXCJJbGxpbm9pc1wiOiBcIklMXCIsXG4gIFwiSW5kaWFuYVwiOiBcIklOXCIsXG4gIFwiSW93YVwiOiBcIklBXCIsXG4gIFwiS2Fuc2FzXCI6IFwiS1NcIixcbiAgXCJLZW50dWNreVwiOiBcIktZXCIsXG4gIFwiTG91aXNpYW5hXCI6IFwiTEFcIixcbiAgXCJNYWluZVwiOiBcIk1FXCIsXG4gIFwiTW9udGFuYVwiOiBcIk1UXCIsXG4gIFwiTmVicmFza2FcIjogXCJORVwiLFxuICBcIk5ldmFkYVwiOiBcIk5WXCIsXG4gIFwiTmV3IEhhbXBzaGlyZVwiOiBcIk5IXCIsXG4gIFwiTmV3IEplcnNleVwiOiBcIk5KXCIsXG4gIFwiTmV3IE1leGljb1wiOiBcIk5NXCIsXG4gIFwiTmV3IFlvcmtcIjogXCJOWVwiLFxuICBcIk5vcnRoIENhcm9saW5hXCI6IFwiTkNcIixcbiAgXCJOb3J0aCBEYWtvdGFcIjogXCJORFwiLFxuICBcIk9oaW9cIjogXCJPSFwiLFxuICBcIk9rbGFob21hXCI6IFwiT0tcIixcbiAgXCJPcmVnb25cIjogXCJPUlwiLFxuICBcIk1hcnlsYW5kXCI6IFwiTURcIixcbiAgXCJNYXNzYWNodXNldHRzXCI6IFwiTUFcIixcbiAgXCJNaWNoaWdhblwiOiBcIk1JXCIsXG4gIFwiTWlubmVzb3RhXCI6IFwiTU5cIixcbiAgXCJNaXNzaXNzaXBwaVwiOiBcIk1TXCIsXG4gIFwiTWlzc291cmlcIjogXCJNT1wiLFxuICBcIlBlbm5zeWx2YW5pYVwiOiBcIlBBXCIsXG4gIFwiUmhvZGUgSXNsYW5kXCI6IFwiUklcIixcbiAgXCJTb3V0aCBDYXJvbGluYVwiOiBcIlNDXCIsXG4gIFwiU291dGggRGFrb3RhXCI6IFwiU0RcIixcbiAgXCJUZW5uZXNzZWVcIjogXCJUTlwiLFxuICBcIlRleGFzXCI6IFwiVFhcIixcbiAgXCJVdGFoXCI6IFwiVVRcIixcbiAgXCJWZXJtb250XCI6IFwiVlRcIixcbiAgXCJWaXJnaW5pYVwiOiBcIlZBXCIsXG4gIFwiV2FzaGluZ3RvblwiOiBcIldBXCIsXG4gIFwiV2VzdCBWaXJnaW5pYVwiOiBcIldWXCIsXG4gIFwiV2lzY29uc2luXCI6IFwiV0lcIixcbiAgXCJXeW9taW5nXCI6IFwiV1lcIlxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGtleXMydmFsdWVzLFxuICBzdHIyb2JqXG59O1xuXG4vKipcbiAqIFN3YXBzIGtleXMgb2YgYW4gb2JqZWN0IHdpdGggdGhlaXIgdmFsdWVzLlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIFRoZSBvYmplY3QgdG8gc3dhcC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IC0gVGhlIHN3YXBwZWQgb2JqZWN0LlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IG9iaiA9IHsgYTogMSwgYjogMiwgYzogMyB9O1xuICogY29uc3Qgc3dhcHBlZCA9IGtleXMydmFsdWVzKG9iaik7XG4gKiBjb25zb2xlLmxvZyhzd2FwcGVkKTtcbiAqIC8vID0+IHsgMTogJ2EnLCAyOiAnYicsIDM6ICdjJyB9XG4gKi9cbmZ1bmN0aW9uIGtleXMydmFsdWVzKG9iaikge1xuICByZXR1cm4gT2JqZWN0LmVudHJpZXMob2JqKS5yZWR1Y2UoKG9iaiwgW2ssIHZdKSA9PiB7XG4gICAgb2JqW3ZdID0gaztcbiAgICByZXR1cm4gb2JqO1xuICB9LCBPYmplY3QuY3JlYXRlKG51bGwpKTtcbn1cblxuLyoqXG4gKiBUdXJucyBhIGNvbW1hLXNlcGFyYXRlZCBzdHJpbmcgaW50byBhbiBvYmplY3QuXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyB0byBwYXJzZS5cbiAqIEByZXR1cm5zIHtPYmplY3R9IC0gVGhlIHBhcnNlZCBvYmplY3QuXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgc3RyID0gJ2EsYixcImMgZFwiJztcbiAqIGNvbnN0IG9iaiA9IHN0cjJvYmooc3RyKTtcbiAqIGNvbnNvbGUubG9nKG9iaik7XG4gKiAvLyA9PiB7IGE6IHRydWUsIGI6IHRydWUsICdjIGQnOiB0cnVlIH1cbiAqL1xuZnVuY3Rpb24gc3RyMm9iaihzdHIpIHtcbiAgcmV0dXJuIHN0ci5zcGxpdCgnLCcpLnJlZHVjZSgob2JqLCBrZXkpID0+IHtcbiAgICBvYmpba2V5XSA9IHRydWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfSwgT2JqZWN0LmNyZWF0ZShudWxsKSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2dlb2NvZGUnKTtcbiIsImNvbnN0IHV0aWwgPSByZXF1aXJlKCcuL3NlcnZpY2UvdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1cmtvdEdlb2NvZGU7XG5cbi8vZGVmYXVsdCB0aW1lb3V0IHRvIGNvbXBsZXRlIG9wZXJhdGlvblxuY29uc3QgZGVmYXVsdFRpbWVvdXQgPSAyMCAqIDEwMDA7XG5sZXQgaWQgPSAwO1xuXG5mdW5jdGlvbiBmdXJrb3RHZW9jb2RlKG9wdGlvbnMpIHtcbiAgY29uc3Qgc2VydmljZXMgPSB7XG4gICAgZ2VvY29kaW86IHtcbiAgICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9nZW9jb2RpbycpXG4gICAgfSxcbiAgICBncmFwaGhvcHBlcjoge1xuICAgICAgaW5pdDogcmVxdWlyZSgnLi9zZXJ2aWNlL2dyYXBoaG9wcGVyJylcbiAgICB9LFxuICAgIGhvZ2Zpc2g6IHtcbiAgICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9ob2dmaXNoJylcbiAgICB9LFxuICAgIGxvY2F0aW9uaXE6IHtcbiAgICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9sb2NhdGlvbmlxJylcbiAgICB9LFxuICAgIG9wZW5jYWdlOiB7XG4gICAgICBpbml0OiByZXF1aXJlKCcuL3NlcnZpY2Uvb3BlbmNhZ2UnKVxuICAgIH0sXG4gICAgcGVsaWFzOiB7XG4gICAgICBpbml0OiByZXF1aXJlKCcuL3NlcnZpY2UvcGVsaWFzJylcbiAgICB9LFxuICAgIHBvc2l0aW9uc3RhY2s6IHtcbiAgICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9wb3NpdGlvbnN0YWNrJylcbiAgICB9LFxuICAgIHN5bmNocm9ub3VzOiB7XG4gICAgICBpbml0OiByZXF1aXJlKCcuL3NlcnZpY2Uvc3luY2hyb25vdXMnKVxuICAgIH0sXG4gICAgbWFwdGlsZXI6IHtcbiAgICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9tYXB0aWxlcicpXG4gICAgfVxuICB9O1xuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICB0aW1lb3V0OiBkZWZhdWx0VGltZW91dCxcbiAgICBvcmRlcjogWydvcGVuY2FnZSddXG4gIH0pO1xuICBjb25zdCBvcGVyYXRpb25zID0geyAuLi5vcHRpb25zIH07XG4gIFsnZm9yd2FyZCcsICdyZXZlcnNlJ10uZm9yRWFjaChvcCA9PiB7XG4gICAgaWYgKG9wZXJhdGlvbnNbb3BdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIG9wZXJhdGlvbnNbb3BdID0gb3B0aW9ucy5vcmRlci5mbGF0TWFwKG5hbWUgPT4ge1xuICAgICAgY29uc3Qgc2VydmljZSA9IHNlcnZpY2VzW29wdGlvbnNbbmFtZV0gfHwgbmFtZV07XG4gICAgICBpZiAoc2VydmljZSAmJiBvcHRpb25zW25hbWUgKyAnX2VuYWJsZSddICYmXG4gICAgICAgICghb3B0aW9uc1tuYW1lICsgJ19wYXJhbWV0ZXJzJ10gfHwgb3B0aW9uc1tuYW1lICsgJ19wYXJhbWV0ZXJzJ11bb3BdICE9PSBmYWxzZSkpIHtcbiAgICAgICAgaWYgKCFzZXJ2aWNlLnNlcnZpY2UpIHtcbiAgICAgICAgICBjb25zdCBkZWZhdWx0cyA9IHtcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBsaW1pdGVyOiBvcHRpb25zWyhuYW1lICsgJ19saW1pdGVyJyldLFxuICAgICAgICAgICAgZW5hYmxlOiBvcHRpb25zWyhuYW1lICsgJ19lbmFibGUnKV1cbiAgICAgICAgICB9O1xuICAgICAgICAgIGlmIChvcHRpb25zW25hbWVdKSB7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyhvcHRpb25zKS5yZWR1Y2UobWFwT3B0aW9ucywge1xuICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICBvcHROYW1lOiBvcHRpb25zW25hbWVdLFxuICAgICAgICAgICAgICBkZWZhdWx0c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlcnZpY2Uuc2VydmljZSA9IHNlcnZpY2UuaW5pdCh1dGlsLmRlZmF1bHRzKGRlZmF1bHRzLCBvcHRpb25zKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNlcnZpY2Uuc2VydmljZVtvcF0gJiYgc2VydmljZS5zZXJ2aWNlLmdlb2NvZGUpIHtcbiAgICAgICAgICBjb25zdCBvcGVyYXRpb24gPSBzZXJ2aWNlLnNlcnZpY2UuZ2VvY29kZS5iaW5kKHVuZGVmaW5lZCwgb3ApO1xuICAgICAgICAgIG9wZXJhdGlvbi5hYm9ydCA9IHNlcnZpY2Uuc2VydmljZS5hYm9ydDtcbiAgICAgICAgICBvcGVyYXRpb24ucHJvdmlkZXIgPSBuYW1lO1xuICAgICAgICAgIHJldHVybiBbb3BlcmF0aW9uXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIFtdO1xuICAgIH0pO1xuICB9KTtcbiAgZ2VvY29kZS5vcHRpb25zID0gb3BlcmF0aW9ucztcbiAgcmV0dXJuIGdlb2NvZGU7XG5cbiAgYXN5bmMgZnVuY3Rpb24gZ2VvY29kZShxdWVyeSwgeyBzaWduYWwgfSA9IHt9KSB7XG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBvcCA9IHF1ZXJ5LmxsID8gJ3JldmVyc2UnIDogJ2ZvcndhcmQnO1xuICAgIGlmICghb3BlcmF0aW9uc1tvcF0/Lmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoc2lnbmFsKSB7XG4gICAgICBzaWduYWwub25hYm9ydCA9IGFib3J0O1xuICAgIH1cblxuICAgIGxldCBhYm9ydGVkO1xuICAgIGxldCBjdXJyZW50T3BlcmF0aW9uO1xuICAgIGNvbnN0IHF1ZXJ5SWQgPSArK2lkO1xuICAgIHF1ZXJ5Lm1heCA9IHF1ZXJ5Lm1heCB8fCBvcHRpb25zLm1heDtcblxuICAgIHJldHVybiB1dGlsLndpdGhUaW1lb3V0KHJlcXVlc3QoKSwgb3B0aW9ucy50aW1lb3V0KTtcblxuICAgIGFzeW5jIGZ1bmN0aW9uIHJlcXVlc3QoKSB7XG4gICAgICBjb25zdCBzdGF0cyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBvcGVyYXRpb24gb2Ygb3BlcmF0aW9uc1tvcF0pIHtcbiAgICAgICAgc3RhdHMucHVzaChvcGVyYXRpb24ucHJvdmlkZXIpO1xuICAgICAgICBjdXJyZW50T3BlcmF0aW9uID0gb3BlcmF0aW9uO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBvcGVyYXRpb24ocXVlcnlJZCwgcXVlcnkpO1xuICAgICAgICBjdXJyZW50T3BlcmF0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICBzaWduYWw/LnRocm93SWZBYm9ydGVkKCk7XG4gICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHJlc3VsdC5wcm92aWRlciA9IG9wZXJhdGlvbi5wcm92aWRlcjtcbiAgICAgICAgaWYgKHJlc3VsdC5wbGFjZXMgJiYgKHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UpKSB7XG4gICAgICAgICAgY29uc3QgcGxhY2VzID0gcmVzdWx0LnBsYWNlcy5maWx0ZXIocXVlcnkucGxhY2UgPyBpc1BsYWNlIDogaXNBZGRyZXNzKTtcbiAgICAgICAgICBpZiAocGxhY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgcmVzdWx0LnBsYWNlcyA9IHBsYWNlcztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHF1ZXJ5Lm1heCA+IDAgJiYgcmVzdWx0LnBsYWNlcz8ubGVuZ3RoID4gcXVlcnkubWF4KSB7XG4gICAgICAgICAgcmVzdWx0LnBsYWNlcy5sZW5ndGggPSBxdWVyeS5tYXg7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhYm9ydCgpIHtcbiAgICAgIGlmICghYWJvcnRlZCkge1xuICAgICAgICBhYm9ydGVkID0gdHJ1ZTtcbiAgICAgICAgLy8gY2FuY2VsIG91dHN0YW5kaW5nIHJlcXVlc3RcbiAgICAgICAgY3VycmVudE9wZXJhdGlvbj8uYWJvcnQ/LihxdWVyeUlkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNQbGFjZShwbGFjZSkge1xuICByZXR1cm4gcGxhY2UucGxhY2UgfHwgIXBsYWNlLnN0cmVldDtcbn1cblxuZnVuY3Rpb24gaXNBZGRyZXNzKHBsYWNlKSB7XG4gIHJldHVybiAhcGxhY2UucGxhY2U7XG59XG5cbmZ1bmN0aW9uIG1hcE9wdGlvbnMocmVzdWx0LCBvcHQpIHtcbiAgaWYgKG9wdC5zdGFydHNXaXRoKHJlc3VsdC5uYW1lKSkge1xuICAgIHJlc3VsdC5kZWZhdWx0c1tvcHQucmVwbGFjZShyZXN1bHQubmFtZSwgcmVzdWx0Lm9wdE5hbWUpXSA9IHJlc3VsdC5vcHRpb25zW29wdF07XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsImNvbnN0IG5vcm1hbGl6ZSA9IHJlcXVpcmUoJy4uL25vcm1hbGl6ZScpO1xuY29uc3Qgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG5jb25zdCB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIGlmIChlcnIpIHtcbiAgICBzd2l0Y2ggKGVyci5zdGF0dXMpIHtcbiAgICAgIGNhc2UgNDAzOlxuICAgICAgICByZXR1cm4gc3RhdHVzLmZhaWx1cmU7XG4gICAgICBjYXNlIDQyMjpcbiAgICAgICAgcmV0dXJuIHN0YXR1cy5lbXB0eTtcbiAgICAgIGNhc2UgNTAwOlxuICAgICAgICByZXR1cm4gc3RhdHVzLmVycm9yO1xuICAgIH1cbiAgfVxuICBpZiAoIXJlc3BvbnNlIHx8IHJlc3BvbnNlLmVycm9yIHx8ICFyZXNwb25zZS5yZXN1bHRzIHx8IHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHN0YXR1cy5lbXB0eTtcbiAgfVxuICByZXR1cm4gc3RhdHVzLnN1Y2Nlc3M7XG59XG5cbmZ1bmN0aW9uIGdldFVybCh1cmwsIGtleSwgb3AsIHF1ZXJ5KSB7XG4gIGNvbnN0IHEgPSBbXTtcbiAgbGV0IHZlcmI7XG4gIHN3aXRjaCAob3ApIHtcbiAgICBjYXNlICdmb3J3YXJkJzpcbiAgICAgIHZlcmIgPSAnZ2VvY29kZSc7XG4gICAgICBxLnB1c2goJ3E9JyArIGVuY29kZVVSSUNvbXBvbmVudChxdWVyeS5hZGRyZXNzIHx8IHF1ZXJ5LnBsYWNlKSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyZXZlcnNlJzpcbiAgICAgIHZlcmIgPSAncmV2ZXJzZSc7XG4gICAgICBxLnB1c2goJ3E9JyArIHF1ZXJ5LmxsWzFdICsgJywnICsgcXVlcnkubGxbMF0pOyAvLyBsYXRpdHVkZSwgbG9uZ2l0dWRlXG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gaW52YWxpZCBvcGVyYXRpb25cbiAgICAgIHJldHVybjtcbiAgfVxuICBxLnB1c2goJ2FwaV9rZXk9JyArIGtleSk7XG4gIHJldHVybiB1cmwgKyB2ZXJiICsgJz8nICsgcS5qb2luKCcmJyk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gbWFwKGYpIHtcbiAgY29uc3QgYWRkcmVzcyA9IGYuYWRkcmVzc19jb21wb25lbnRzO1xuICBjb25zdCBsb2NhdGlvbiA9IGYubG9jYXRpb247XG4gIGNvbnN0IHBsYWNlID0ge1xuICAgIGxsOiBbbG9jYXRpb24ubG5nLCBsb2NhdGlvbi5sYXRdLFxuICAgIHBsYWNlOiBmLm5hbWUsXG4gICAgaG91c2U6IGFkZHJlc3MubnVtYmVyLFxuICAgIHN0cmVldDogYWRkcmVzcy5mb3JtYXR0ZWRfc3RyZWV0LFxuICAgIHRvd246IGFkZHJlc3MuY2l0eSxcbiAgICBjb3VudHk6IGFkZHJlc3MuY291bnR5LFxuICAgIHByb3ZpbmNlOiBhZGRyZXNzLnN0YXRlLFxuICAgIGNvdW50cnk6IG5vcm1hbGl6ZS5jb3VudHJ5KGFkZHJlc3MuY291bnRyeSlcbiAgfTtcblxuICAvLyByZW1vdmUgZW1wdGllc1xuICByZXR1cm4gdXRpbC5yZW1vdmVFbXB0aWVzKHBsYWNlKTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlLCBxdWVyeSwgcmVzdWx0KSB7XG4gIHJlc3VsdC5wbGFjZXMgPSByZXNwb25zZS5yZXN1bHRzLm1hcChtYXApO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcmV2ZXJzZTogdHJ1ZSxcbiAgICB1cmw6IGdldFVybC5iaW5kKHVuZGVmaW5lZCxcbiAgICAgIG9wdGlvbnMuZ2VvY29kaW9fdXJsIHx8ICdodHRwczovL2FwaS5nZW9jb2QuaW8vdjEuNy8nLFxuICAgICAgb3B0aW9ucy5nZW9jb2Rpb19rZXkpLFxuICAgIHN0YXR1czogZ2V0U3RhdHVzLFxuICAgIHByZXBhcmVSZXF1ZXN0LFxuICAgIHByb2Nlc3NSZXNwb25zZVxuICB9KTtcbiAgaWYgKG9wdGlvbnMuZ2VvY29kaW9fcGFyYW1ldGVycykge1xuICAgIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIG9wdGlvbnMuZ2VvY29kaW9fcGFyYW1ldGVycyk7XG4gIH1cbiAgcmV0dXJuIHJlcXVpcmUoJy4uJykob3B0aW9ucyk7XG59XG4iLCJjb25zdCBub3JtYWxpemUgPSByZXF1aXJlKCcuLi9ub3JtYWxpemUnKTtcbmNvbnN0IHN0YXR1cyA9IHJlcXVpcmUoJy4uL3N0YXR1cycpO1xuY29uc3QgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG4vKlxuICogaHR0cHM6Ly9ncmFwaGhvcHBlci5jb20vYXBpLzEvZG9jcy9nZW9jb2RpbmcvXG4gKi9cblxuZnVuY3Rpb24gZ2V0U3RhdHVzKGVyciwgcmVzcG9uc2UpIHtcbiAgaWYgKCFyZXNwb25zZSB8fCAhcmVzcG9uc2UuaGl0cyB8fCByZXNwb25zZS5oaXRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIHN0YXR1cy5zdWNjZXNzO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIG9wLCBxdWVyeSkge1xuICBjb25zdCBxID0gW107XG4gIGlmIChxdWVyeS5tYXgpIHtcbiAgICBxLnB1c2goJ2xpbWl0PScgKyBxdWVyeS5tYXgpO1xuICB9XG4gIHN3aXRjaCAob3ApIHtcbiAgICBjYXNlICdmb3J3YXJkJzpcbiAgICAgIHEucHVzaCgncT0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UpKTtcbiAgICAgIGlmIChxdWVyeS5ib3VuZHMpIHtcbiAgICAgICAgY29uc3QgbGwgPSBbXG4gICAgICAgICAgKHF1ZXJ5LmJvdW5kc1swXVswXSArIHF1ZXJ5LmJvdW5kc1sxXVswXSkgLyAyLFxuICAgICAgICAgIChxdWVyeS5ib3VuZHNbMF1bMV0gKyBxdWVyeS5ib3VuZHNbMV1bMV0pIC8gMlxuICAgICAgICBdO1xuICAgICAgICBxLnB1c2goJ3BvaW50PScgKyBsbFsxXSArICcsJyArIGxsWzBdKTsgLy8gbGF0aXR1ZGUsIGxvbmdpdHVkZVxuICAgICAgfVxuICAgICAgaWYgKHF1ZXJ5LnBhcnRpYWwpIHtcbiAgICAgICAgcS5wdXNoKCdhdXRvY29tcGxldGU9dHJ1ZScpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncmV2ZXJzZSc6XG4gICAgICBxLnB1c2goJ3JldmVyc2U9dHJ1ZScpO1xuICAgICAgcS5wdXNoKCdwb2ludD0nICsgcXVlcnkubGxbMV0gKyAnLCcgKyBxdWVyeS5sbFswXSk7IC8vIGxhdGl0dWRlLCBsb25naXR1ZGVcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBpbnZhbGlkIG9wZXJhdGlvblxuICAgICAgcmV0dXJuO1xuICB9XG4gIGlmIChxdWVyeS5sYW5nKSB7XG4gICAgcS5wdXNoKCdsb2NhbGU9JyArIHF1ZXJ5LmxhbmcpO1xuICB9XG4gIHEucHVzaCgna2V5PScgKyBrZXkpO1xuICByZXR1cm4gdXJsICsgJz8nICsgcS5qb2luKCcmJyk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gbWFwKGYpIHtcbiAgY29uc3QgcGxhY2UgPSB7XG4gICAgbGw6IFtmLnBvaW50LmxuZywgZi5wb2ludC5sYXRdLFxuICAgIHR5cGU6IGYub3NtX3ZhbHVlLFxuICAgIGhvdXNlOiBmLmhvdXNlbnVtYmVyLFxuICAgIHN0cmVldDogZi5zdHJlZXQsXG4gICAgdG93bjogZi5jaXR5LFxuICAgIHByb3ZpbmNlOiBub3JtYWxpemUuc3RhdGUoZi5zdGF0ZSksXG4gICAgY291bnRyeTogbm9ybWFsaXplLmNvdW50cnkoZi5jb3VudHJ5KVxuICB9O1xuICBpZiAoIXBsYWNlLnN0cmVldCAmJiBmLm9zbV9rZXkgPT09ICdoaWdod2F5Jykge1xuICAgIHBsYWNlLnN0cmVldCA9IGYubmFtZTtcbiAgfVxuICBpZiAoZi5uYW1lICE9PSBwbGFjZS5zdHJlZXQgJiZcbiAgICBmLm5hbWUgIT09IHBsYWNlLnRvd24pIHtcbiAgICBwbGFjZS5wbGFjZSA9IGYubmFtZTtcbiAgfVxuXG4gIC8vIHJlbW92ZSBlbXB0aWVzXG4gIHJldHVybiB1dGlsLnJlbW92ZUVtcHRpZXMocGxhY2UpO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQpIHtcbiAgY29uc3QgaGl0cyA9IHJlc3BvbnNlLmhpdHM7XG4gIHJlc3VsdC5wbGFjZXMgPSBoaXRzLm1hcChtYXApO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcmV2ZXJzZTogdHJ1ZSxcbiAgICB1cmw6IGdldFVybC5iaW5kKHVuZGVmaW5lZCxcbiAgICAgIG9wdGlvbnMuZ3JhcGhob3BwZXJfdXJsIHx8ICdodHRwczovL2dyYXBoaG9wcGVyLmNvbS9hcGkvMS9nZW9jb2RlJyxcbiAgICAgIG9wdGlvbnMuZ3JhcGhob3BwZXJfa2V5KSxcbiAgICBzdGF0dXM6IGdldFN0YXR1cyxcbiAgICBwcmVwYXJlUmVxdWVzdCxcbiAgICBwcm9jZXNzUmVzcG9uc2VcbiAgfSk7XG4gIGlmIChvcHRpb25zLmdyYXBoaG9wcGVyX3BhcmFtZXRlcnMpIHtcbiAgICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCBvcHRpb25zLmdyYXBoaG9wcGVyX3BhcmFtZXRlcnMpO1xuICB9XG4gIHJldHVybiByZXF1aXJlKCcuLicpKG9wdGlvbnMpO1xufVxuIiwiY29uc3Qgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG5jb25zdCB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIGlmIChlcnIpIHtcbiAgICByZXR1cm4gc3RhdHVzLmZhaWx1cmU7XG4gIH1cbiAgaWYgKCFyZXNwb25zZSkge1xuICAgIHJldHVybiBzdGF0dXMuZXJyb3I7XG4gIH1cbiAgaWYgKHJlc3BvbnNlLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIHN0YXR1cy5zdWNjZXNzO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCB0eXBlcywgb3AsIHF1ZXJ5KSB7XG4gIGNvbnN0IHEgPSBbXTtcbiAgc3dpdGNoIChvcCkge1xuICAgIGNhc2UgJ3JldmVyc2UnOlxuICAgICAgcS5wdXNoKCdsbD0nICsgcXVlcnkubGwuam9pbignLCcpKTtcbiAgICAgIHEucHVzaCgncmFkaXVzPTEwMCcpO1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdmb3J3YXJkJzpcbiAgICAgICAgcS5wdXNoKCdxPScgKyBlbmNvZGVVUklDb21wb25lbnQocXVlcnkucGxhY2UgfHwgcXVlcnkuYWRkcmVzcykpO1xuICAgICAgICBpZiAocXVlcnkuYm91bmRzKSB7XG4gICAgICAgICAgcS5wdXNoKCdzdz0nICsgcXVlcnkuYm91bmRzWzBdLmpvaW4oJywnKSk7XG4gICAgICAgICAgcS5wdXNoKCduZT0nICsgcXVlcnkuYm91bmRzWzFdLmpvaW4oJywnKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgLy8gaW52YWxpZCBvcGVyYXRpb25cbiAgICAgIHJldHVybjtcbiAgfVxuICBxLnB1c2goLi4udHlwZXNbcXVlcnkudHlwZV0pO1xuICBpZiAocXVlcnkubWF4KSB7XG4gICAgcS5wdXNoKCdsaW1pdD0nICsgcXVlcnkubWF4KTtcbiAgfVxuICByZXR1cm4gdXJsICsgJz8nICsgcS5qb2luKCcmJyk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KHR5cGVzLCBvcCwgcXVlcnkpIHtcbiAgaWYgKG9wID09PSAnZm9yd2FyZCcpIHtcbiAgICBxdWVyeS50eXBlID0gcXVlcnkudHlwZSA/PyBbJ3BsYWNlJywgJ2FkZHJlc3MnXS5maW5kKHR5cGUgPT4gcXVlcnkuaGFzT3duUHJvcGVydHkodHlwZSkpO1xuICB9XG4gIHJldHVybiBCb29sZWFuKHR5cGVzW3F1ZXJ5LnR5cGVdKTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hOYW1lcyhuMSwgbjIpIHtcbiAgaWYgKG4xLmxlbmd0aCA+IG4yLmxlbmd0aCkge1xuICAgIGNvbnN0IG4gPSBuMTtcbiAgICBuMSA9IG4yO1xuICAgIG4yID0gbjtcbiAgfVxuICBuMSA9IG4xLnNwbGl0KCcgJyk7XG4gIHJldHVybiBuMS5zb21lKGZ1bmN0aW9uIChuKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcztcbiAgICBpZiAocmVzdWx0Lm5hbWUuaW5kZXhPZihuKSA+IC0xKSB7XG4gICAgICByZXN1bHQud29yZHMgLT0gMTtcbiAgICAgIGlmICghcmVzdWx0LndvcmRzKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIG5hbWU6IG4yLFxuICAgIHdvcmRzOiBNYXRoLm1pbihuMS5sZW5ndGgsIDIpXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpc0Nsb3NlcihyZXN1bHQsIHBsYWNlKSB7XG4gIGNvbnN0IGRpc3QgPSBNYXRoLnBvdyhyZXN1bHQubGxbMF0gLSBwbGFjZS5sbFswXSwgMikgKyBNYXRoLnBvdyhyZXN1bHQubGxbMV0gLSBwbGFjZS5sbFsxXSwgMik7XG4gIGlmIChyZXN1bHQuZGlzdGFuY2UgPT09IHVuZGVmaW5lZCB8fCBkaXN0IDwgcmVzdWx0LmRpc3RhbmNlKSB7XG4gICAgcmVzdWx0LmRpc3RhbmNlID0gZGlzdDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kUGxhY2UocmVzdWx0LCBwbGFjZSkge1xuICBpZiAoKCFyZXN1bHQucGxhY2UgfHwgKHBsYWNlLm5hbWUgJiYgbWF0Y2hOYW1lcyhwbGFjZS5uYW1lLCByZXN1bHQucGxhY2UpKSkgJiZcbiAgICBpc0Nsb3NlcihyZXN1bHQsIHBsYWNlKSkge1xuICAgIHBsYWNlLnR5cGUgPSByZXN1bHQudHlwZTtcbiAgICByZXN1bHRbMF0gPSBwbGFjZTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBtYXAoZikge1xuICBjb25zdCBwbGFjZSA9IHtcbiAgICBsbDogZi5sbCxcbiAgICBwbGFjZTogZi5uYW1lLFxuICAgIHVybDogZi51cmwsXG4gICAgc3RyZWV0OiBmLmFkZHJlc3MsXG4gICAgdG93bjogZi5jaXR5LFxuICAgIHByb3ZpbmNlOiBmLnN0YXRlLFxuICAgIGNvdW50cnk6IGYuY291bnRyeSxcbiAgICB0eXBlOiBmLnR5cGUsXG4gICAgc2VydmljZTogZi5zZXJ2aWNlXG4gIH07XG5cbiAgLy8gcmVtb3ZlIGVtcHRpZXNcbiAgcmV0dXJuIHV0aWwucmVtb3ZlRW1wdGllcyhwbGFjZSk7XG59XG5cbmZ1bmN0aW9uIGZpbHRlclJlc3BvbnNlKHF1ZXJ5LCByZXNwb25zZSkge1xuICBpZiAoIShxdWVyeS5sbCAmJiBxdWVyeS50eXBlKSkge1xuICAgIHJldHVybiByZXNwb25zZTtcbiAgfVxuICBjb25zdCBwbGFjZXMgPSBbXTtcbiAgcGxhY2VzLnR5cGUgPSBxdWVyeS50eXBlO1xuICBwbGFjZXMucGxhY2UgPSBxdWVyeS5wbGFjZTtcbiAgcGxhY2VzLmxsID0gcXVlcnkubGw7XG4gIHJldHVybiByZXNwb25zZS5yZWR1Y2UoZmluZFBsYWNlLCBwbGFjZXMpO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQpIHtcbiAgcmVzdWx0LnBsYWNlcyA9IGZpbHRlclJlc3BvbnNlKHF1ZXJ5LCByZXNwb25zZSkubWFwKG1hcCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGluaXQob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5ob2dmaXNoX3BhcmFtZXRlcnMpIHtcbiAgICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCBvcHRpb25zLmhvZ2Zpc2hfcGFyYW1ldGVycyk7XG4gIH1cbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIHJldmVyc2U6IHRydWUsXG4gICAgZm9yd2FyZDogdHJ1ZSxcbiAgICB1cmw6IGdldFVybC5iaW5kKHVuZGVmaW5lZCwgb3B0aW9ucy5ob2dmaXNoX3VybCwgb3B0aW9ucy50eXBlcyksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3Q6IHByZXBhcmVSZXF1ZXN0LmJpbmQodW5kZWZpbmVkLCBvcHRpb25zLnR5cGVzKSxcbiAgICBwcm9jZXNzUmVzcG9uc2VcbiAgfSk7XG4gIHJldHVybiByZXF1aXJlKCcuLicpKG9wdGlvbnMpO1xufVxuIiwiY29uc3QgZmV0Y2hhZ2VudCA9IHJlcXVpcmUoJ2ZldGNoYWdlbnQnKTtcbmNvbnN0IG1ha2VMaW1pdGVyID0gcmVxdWlyZSgnbGltaXRlci1jb21wb25lbnQnKTtcbmNvbnN0IGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnZnVya290Omdlb2NvZGU6c2VydmljZScpO1xuXG5jb25zdCBzdGF0dXMgPSByZXF1aXJlKCcuL3N0YXR1cycpO1xuY29uc3QgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbmNvbnN0IGxpbWl0ZXJzID0ge307XG5cbmNvbnN0IEFCT1JUX1RPX0ZBSUxVUkUgPSAzOyAvLyBtYXggbnVtYmVyIG9mIGFib3J0ZWQgcmVxdWVzdHMgYmVmb3JlIHNodXR0aW5nIGRvd24gc2VydmljZVxuXG5mdW5jdGlvbiByZXF1ZXN0KHVybCwgcmVxLCBmbikge1xuICBjb25zdCBvcHRpb25zID0gdGhpcztcbiAgbGV0IGZhID0gZmV0Y2hhZ2VudDtcbiAgaWYgKG9wdGlvbnMucG9zdCkge1xuICAgIGZhID0gZmEucG9zdCh1cmwpLnNlbmQocmVxKTtcbiAgfSBlbHNlIHtcbiAgICBmYSA9IGZhLmdldCh1cmwpLnF1ZXJ5KHJlcSk7XG4gIH1cbiAgcmV0dXJuIGZhXG4gICAgLnNldCgnYWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKVxuICAgIC5lbmQoZm4pO1xufVxuXG5mdW5jdGlvbiBpbml0VXJsKHVybCkge1xuICByZXR1cm4gdHlwZW9mIHVybCA9PT0gJ2Z1bmN0aW9uJyA/IHVybCA6ICgpID0+IHVybDtcbn1cblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG4gIGxldCBob2xkUmVxdWVzdHM7XG4gIGxldCBhYm9ydENvdW50ZXIgPSAwO1xuICBjb25zdCBvdXRzdGFuZGluZyA9IHt9O1xuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBpbnRlcnZhbDogMzQwLFxuICAgIHBlbmFsdHlJbnRlcnZhbDogMjAwMCxcbiAgICBsaW1pdGVyOiBsaW1pdGVyc1tvcHRpb25zLm5hbWVdLFxuICAgIHJlcXVlc3QsXG4gICAgYWJvcnRcbiAgfSk7XG4gIG9wdGlvbnMudXJsID0gaW5pdFVybChvcHRpb25zLnVybCk7XG4gIGxpbWl0ZXJzW29wdGlvbnMubmFtZV0gPSBvcHRpb25zLmxpbWl0ZXIgfHwgbWFrZUxpbWl0ZXIob3B0aW9ucy5pbnRlcnZhbCwgb3B0aW9ucy5wZW5hbHR5SW50ZXJ2YWwpO1xuICBjb25zdCBsaW1pdGVyID0gbGltaXRlcnNbb3B0aW9ucy5uYW1lXTtcblxuICByZXR1cm4ge1xuICAgIGZvcndhcmQ6IG9wdGlvbnMuZm9yd2FyZCxcbiAgICByZXZlcnNlOiBvcHRpb25zLnJldmVyc2UsXG4gICAgZ2VvY29kZSxcbiAgICBhYm9ydDogb3B0aW9ucy5hYm9ydFxuICB9O1xuXG4gIGZ1bmN0aW9uIGFib3J0KHF1ZXJ5SWQpIHtcbiAgICBkZWJ1ZygnYWJvcnQnLCBxdWVyeUlkKTtcbiAgICBpZiAoIW91dHN0YW5kaW5nW3F1ZXJ5SWRdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHsgbGF0ZXJUaW1lb3V0SWQsIHJlcUluUHJvZ3Jlc3N9ID0gb3V0c3RhbmRpbmdbcXVlcnlJZF07XG4gICAgLy8gY2FuY2VsIGxhdGVyIHJlcXVlc3QgaWYgc2NoZWR1bGVkXG4gICAgaWYgKGxhdGVyVGltZW91dElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQobGF0ZXJUaW1lb3V0SWQpO1xuICAgIH1cbiAgICAvLyBjYW5jZWwgcmVxdWVzdCBpbiBwcm9ncmVzc1xuICAgIHJlcUluUHJvZ3Jlc3M/LmFib3J0Py4oKTtcbiAgICBhYm9ydENvdW50ZXIgKz0gMTtcbiAgICBpZiAoYWJvcnRDb3VudGVyID49IEFCT1JUX1RPX0ZBSUxVUkUpIHtcbiAgICAgIC8vIGRvbid0IGV2ZXIgYXNrIGFnYWluXG4gICAgICBob2xkUmVxdWVzdHMgPSB0cnVlO1xuICAgIH1cbiAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXNvbHZlT25BYm9ydCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2VvY29kZShvcCwgcXVlcnlJZCwgcXVlcnkpIHtcbiAgICBjb25zdCBmbnMgPSB7fTtcbiAgICBjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBmbnMucmVzb2x2ZSA9IHJlc29sdmUpO1xuXG4gICAgb3V0c3RhbmRpbmdbcXVlcnlJZF0gPSB7IHJlc29sdmUsIHJlc29sdmVPbkFib3J0IH07XG4gICAgZXhlY3V0ZVF1ZXJ5KCk7XG4gICAgcmV0dXJuIHByb21pc2U7XG5cbiAgICBmdW5jdGlvbiByZXNvbHZlKHJlc3VsdCkge1xuICAgICAgYWJvcnRDb3VudGVyID0gMDtcbiAgICAgIGRlbGV0ZSBvdXRzdGFuZGluZ1txdWVyeUlkXTtcbiAgICAgIGZucy5yZXNvbHZlKHJlc3VsdCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVzb2x2ZU9uQWJvcnQoKSB7XG4gICAgICBkZWxldGUgb3V0c3RhbmRpbmdbcXVlcnlJZF07XG4gICAgICBmbnMucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlcXVlc3RMYXRlcigpIHtcbiAgICAgIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmxhdGVyVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChvdXRzdGFuZGluZ1txdWVyeUlkXSkge1xuICAgICAgICAgIGRlbGV0ZSBvdXRzdGFuZGluZ1txdWVyeUlkXS5sYXRlclRpbWVvdXRJZDtcbiAgICAgICAgfVxuICAgICAgICBleGVjdXRlUXVlcnkoKTtcbiAgICAgIH0sIG9wdGlvbnMucGVuYWx0eVRpbWVvdXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4ZWN1dGVRdWVyeSgpIHtcbiAgICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgLy8gcXVlcnkgaGFzIGJlZW4gYWJvcnRlZFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgcmVzb2x2ZSB9ID0gb3V0c3RhbmRpbmdbcXVlcnlJZF07XG4gICAgICBpZiAoaG9sZFJlcXVlc3RzKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5lbmFibGUgJiYgIW9wdGlvbnMuZW5hYmxlKHF1ZXJ5KSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgfVxuICAgICAgbGV0IHJlcSA9IG9wdGlvbnMucHJlcGFyZVJlcXVlc3Qob3AsIHF1ZXJ5KTtcbiAgICAgIGlmICghcmVxKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgICBpZiAocmVxID09PSB0cnVlKSB7XG4gICAgICAgIHJlcSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgbGltaXRlci50cmlnZ2VyKGV4ZWN1dGVRdWVyeVRyaWdnZXJlZCk7XG5cbiAgICAgIGZ1bmN0aW9uIGV4ZWN1dGVRdWVyeVRyaWdnZXJlZCgpIHtcbiAgICAgICAgaWYgKCFvdXRzdGFuZGluZ1txdWVyeUlkXSkge1xuICAgICAgICAgIC8vIHF1ZXJ5IGhhcyBiZWVuIGFib3J0ZWRcbiAgICAgICAgICBsaW1pdGVyLnNraXAoKTsgLy8gaW1tZWRpYXRlbHkgcHJvY2VzcyB0aGUgbmV4dCByZXF1ZXN0IGluIHRoZSBxdWV1ZVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzID0gb3B0aW9ucy5yZXF1ZXN0KG9wdGlvbnMudXJsKG9wLCBxdWVyeSksIHJlcSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgICAgICBpZiAoIW91dHN0YW5kaW5nW3F1ZXJ5SWRdKSB7XG4gICAgICAgICAgICAvLyBxdWVyeSBoYXMgYmVlbiBhYm9ydGVkXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlbGV0ZSBvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzO1xuICAgICAgICAgIHN3aXRjaCAob3B0aW9ucy5zdGF0dXMoZXJyLCByZXNwb25zZSkpIHtcbiAgICAgICAgICAgIGNhc2Ugc3RhdHVzLnN1Y2Nlc3M6XG4gICAgICAgICAgICAgIGNvbnN0IHJlcyA9IG9wdGlvbnMucHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlLCBxdWVyeSwge30pO1xuICAgICAgICAgICAgICByZXMucGxhY2VzPy5mb3JFYWNoKHAgPT4geyBwLm5vcm1hbCA9IHV0aWwuc3RyaW5naWZ5KHApIHx8ICcnOyBwLmFkZHJlc3MgPSB1dGlsLnByZXR0aWZ5KHAubm9ybWFsKTsgfSk7XG4gICAgICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHN0YXR1cy5mYWlsdXJlOlxuICAgICAgICAgICAgICAvLyBkb24ndCBldmVyIGFzayBhZ2FpblxuICAgICAgICAgICAgICBob2xkUmVxdWVzdHMgPSB0cnVlO1xuICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBzdGF0dXMuZXJyb3I6XG4gICAgICAgICAgICAgIC8vIHRyeSBhZ2FpbiBsYXRlclxuICAgICAgICAgICAgICBsaW1pdGVyLnBlbmFsdHkoKTtcbiAgICAgICAgICAgICAgcmVxdWVzdExhdGVyKCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwiY29uc3Qgbm9ybWFsaXplID0gcmVxdWlyZSgnLi4vbm9ybWFsaXplJyk7XG5jb25zdCBzdGF0dXMgPSByZXF1aXJlKCcuLi9zdGF0dXMnKTtcbmNvbnN0IHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcblxuLypcbiAqIGh0dHBzOi8vbG9jYXRpb25pcS5vcmcvZG9jc1xuICovXG5cbmNvbnN0IERFRkFVTFRfVVJMID0gJ2FwaS5sb2NhdGlvbmlxLmNvbSc7XG5cbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIGlmIChlcnIpIHtcbiAgICBpZiAoZXJyLnN0YXR1cyA9PT0gNDAxIHx8XG4gICAgICAoZXJyLnN0YXR1cyA9PT0gNDI5ICYmIHJlc3BvbnNlLmVycm9yID09PSAnUmF0ZSBMaW1pdGVkIERheScpKSB7XG4gICAgICByZXR1cm4gc3RhdHVzLmZhaWx1cmU7XG4gICAgfVxuICAgIGlmIChlcnIuc3RhdHVzID09PSA0MjkgfHwgZXJyLnN0YXR1cyA9PT0gNTAwKSB7XG4gICAgICByZXR1cm4gc3RhdHVzLmVycm9yO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdHVzLmVtcHR5O1xuICB9XG4gIGlmICghcmVzcG9uc2UpIHtcbiAgICByZXR1cm4gc3RhdHVzLmVtcHR5O1xuICB9XG4gIHJldHVybiBzdGF0dXMuc3VjY2Vzcztcbn1cblxuZnVuY3Rpb24gZ2V0VXJsKHVybCwga2V5LCBvcCwgcXVlcnkpIHtcbiAgY29uc3QgcSA9IFtdO1xuICBsZXQgdmVyYjtcbiAgc3dpdGNoIChvcCkge1xuICAgIGNhc2UgJ2ZvcndhcmQnOlxuICAgICAgdmVyYiA9ICdzZWFyY2gnO1xuICAgICAgcS5wdXNoKCdxPScgKyBlbmNvZGVVUklDb21wb25lbnQocXVlcnkuYWRkcmVzcyB8fCBxdWVyeS5wbGFjZSkpO1xuICAgICAgaWYgKHF1ZXJ5Lm1heCkge1xuICAgICAgICBxLnB1c2goJ2xpbWl0PScgKyBxdWVyeS5tYXgpO1xuICAgICAgfVxuICAgICAgaWYgKHF1ZXJ5LmJvdW5kcykge1xuICAgICAgICBjb25zdCBib3ggPSBbXG4gICAgICAgICAgcXVlcnkuYm91bmRzWzBdWzBdLCAvLyBsZWZ0XG4gICAgICAgICAgcXVlcnkuYm91bmRzWzBdWzFdLCAvLyBib3R0b21cbiAgICAgICAgICBxdWVyeS5ib3VuZHNbMV1bMF0sIC8vIHJpZ2h0XG4gICAgICAgICAgcXVlcnkuYm91bmRzWzFdWzFdIC8vIHRvcFxuICAgICAgICBdLmpvaW4oJywnKTtcbiAgICAgICAgcS5wdXNoKCd2aWV3Ym94PScgKyBib3gpO1xuICAgICAgICBxLnB1c2goJ2JvdW5kZWQ9MScpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncmV2ZXJzZSc6XG4gICAgICB2ZXJiID0gJ3JldmVyc2UnO1xuICAgICAgcS5wdXNoKCdsb249JyArIHF1ZXJ5LmxsWzBdKTtcbiAgICAgIHEucHVzaCgnbGF0PScgKyBxdWVyeS5sbFsxXSk7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gaW52YWxpZCBvcGVyYXRpb25cbiAgICAgIHJldHVybjtcbiAgfVxuICBpZiAocXVlcnkubGFuZykge1xuICAgIHEucHVzaCgnYWNjZXB0LWxhbmd1YWdlPScgKyBxdWVyeS5sYW5nKTtcbiAgfVxuICBxLnB1c2goJ2FkZHJlc3NkZXRhaWxzPTEnKTtcbiAgcS5wdXNoKCdub3JtYWxpemVjaXR5PTEnKTtcbiAgcS5wdXNoKCdmb3JtYXQ9anNvbicpO1xuICBxLnB1c2goJ2tleT0nICsga2V5KTtcbiAgaWYgKHF1ZXJ5LnBhcnRpYWwpIHtcbiAgICB1cmwgPSB1cmxcbiAgICAgIC5yZXBsYWNlKCd1czEubG9jYXRpb25pcS5jb20nLCBERUZBVUxUX1VSTClcbiAgICAgIC5yZXBsYWNlKCdldTEubG9jYXRpb25pcS5jb20nLCBERUZBVUxUX1VSTCk7XG4gIH1cbiAgcmV0dXJuIHVybCArIHZlcmIgKyAnLnBocD8nICsgcS5qb2luKCcmJyk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0VHlwZShrZXkpIHtcbiAgY29uc3QgYSA9IHRoaXMuYTtcbiAgY29uc3QgcGxhY2UgPSB0aGlzLnBsYWNlO1xuICBpZiAoYVtrZXldID09PSBwbGFjZS5wbGFjZSkge1xuICAgIHBsYWNlLnR5cGUgPSBrZXk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFwKGYpIHtcbiAgY29uc3QgYSA9IGYuYWRkcmVzcztcblxuICBjb25zdCBwbGFjZSA9IHtcbiAgICBsbDogW3BhcnNlRmxvYXQoZi5sb24pLCBwYXJzZUZsb2F0KGYubGF0KV0sXG4gICAgaG91c2U6IGEuaG91c2VfbnVtYmVyLFxuICAgIHN0cmVldDogYS5yb2FkIHx8IGEucGVkZXN0cmlhbixcbiAgICB0b3duOiBhLmNpdHksXG4gICAgcHJvdmluY2U6IG5vcm1hbGl6ZS5zdGF0ZShhLnN0YXRlKSxcbiAgICBjb3VudHJ5OiBub3JtYWxpemUuY291bnRyeShhLmNvdW50cnkpXG4gIH07XG5cbiAgaWYgKGYuZGlzcGxheV9uYW1lKSB7XG4gICAgcGxhY2UucGxhY2UgPSBmLmRpc3BsYXlfbmFtZS5zcGxpdCgnLCcpWzBdO1xuICAgIGlmICghKHBsYWNlLnBsYWNlICYmIE9iamVjdC5rZXlzKGEpLnNvbWUoZ2V0VHlwZSwge1xuICAgICAgICBhLFxuICAgICAgICBwbGFjZVxuICAgICAgfSkpKSB7XG4gICAgICBwbGFjZS50eXBlID0gZi50eXBlIHx8IGYuY2xhc3M7XG4gICAgfVxuICAgIGlmIChwbGFjZS5wbGFjZSA9PT0gYS5ob3VzZV9udW1iZXIgfHxcbiAgICAgIHBsYWNlLnBsYWNlID09PSBwbGFjZS5zdHJlZXQgfHxcbiAgICAgIHBsYWNlLnBsYWNlID09PSAoYS5yb2FkIHx8IGEucGVkZXN0cmlhbikpIHtcbiAgICAgIGRlbGV0ZSBwbGFjZS5wbGFjZTtcbiAgICB9XG4gIH1cblxuICAvLyByZW1vdmUgZW1wdGllc1xuICByZXR1cm4gdXRpbC5yZW1vdmVFbXB0aWVzKHBsYWNlKTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc1Jlc3BvbnNlKHBsYWNlcywgcXVlcnksIHJlc3VsdCkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocGxhY2VzKSkge1xuICAgIHBsYWNlcyA9IFtwbGFjZXNdO1xuICB9XG4gIHJlc3VsdC5wbGFjZXMgPSBwbGFjZXMubWFwKG1hcCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGluaXQob3B0aW9ucykge1xuICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCB7XG4gICAgZm9yd2FyZDogdHJ1ZSxcbiAgICByZXZlcnNlOiB0cnVlLFxuICAgIHVybDogZ2V0VXJsLmJpbmQodW5kZWZpbmVkLFxuICAgICAgb3B0aW9ucy5sb2NhdGlvbmlxX3VybCB8fCAnaHR0cHM6Ly8nICsgREVGQVVMVF9VUkwgKyAnL3YxLycsXG4gICAgICBvcHRpb25zLmxvY2F0aW9uaXFfa2V5KSxcbiAgICBzdGF0dXM6IGdldFN0YXR1cyxcbiAgICBwcmVwYXJlUmVxdWVzdCxcbiAgICBwcm9jZXNzUmVzcG9uc2VcbiAgfSk7XG4gIGlmIChvcHRpb25zLmxvY2F0aW9uaXFfcGFyYW1ldGVycykge1xuICAgIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIG9wdGlvbnMubG9jYXRpb25pcV9wYXJhbWV0ZXJzKTtcbiAgfVxuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cbiIsImNvbnN0IG5vcm1hbGl6ZSA9IHJlcXVpcmUoJy4uL25vcm1hbGl6ZScpO1xuY29uc3Qgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG5jb25zdCB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbi8qXG4gKiBodHRwczovL2RvY3MubWFwdGlsZXIuY29tL2Nsb3VkL2FwaS9nZW9jb2RpbmcvXG4gKi9cbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIGlmICghcmVzcG9uc2UpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGVycikge1xuICAgIHJldHVybiBlcnIuc3RhdHVzID8gc3RhdHVzLmVycm9yIDogc3RhdHVzLmZhaWx1cmU7XG4gIH1cbiAgaWYgKCEocmVzcG9uc2UudHlwZSA9PT0gJ0ZlYXR1cmVDb2xsZWN0aW9uJyAmJiByZXNwb25zZS5mZWF0dXJlcz8ubGVuZ3RoKSkge1xuICAgIHJldHVybiBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIHN0YXR1cy5zdWNjZXNzO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIG9wLCBxdWVyeSkge1xuICBsZXQgcTtcbiAgaWYgKG9wID09PSAnZm9yd2FyZCcpIHtcbiAgICBxID0gZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UpO1xuICB9IGVsc2Uge1xuICAgIHEgPSBxdWVyeS5sbC5qb2luKCcsJyk7XG4gIH1cbiAgcSArPSAnLmpzb24/a2V5PScgKyBrZXk7XG4gIGlmIChxdWVyeS5tYXgpIHtcbiAgICBxICs9ICcmbGltaXQ9JyArIHF1ZXJ5Lm1heDtcbiAgfVxuICBpZiAocXVlcnkuYm91bmRzKSB7XG4gICAgcSArPSAnJmJib3g9JyArIFtcbiAgICAgIHF1ZXJ5LmJvdW5kc1swXVswXSwgLy8gd2VzdFxuICAgICAgcXVlcnkuYm91bmRzWzBdWzFdLCAvLyBzb3V0aFxuICAgICAgcXVlcnkuYm91bmRzWzFdWzBdLCAvLyBlYXN0XG4gICAgICBxdWVyeS5ib3VuZHNbMV1bMV0gLy8gbm9ydGhcbiAgICBdLmpvaW4oJywnKTtcbiAgfVxuICByZXR1cm4gdXJsICsgcTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVJlcXVlc3QoKSB7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBtYXAocmVzdWx0KSB7XG4gIGNvbnN0IHJlcyA9IHtcbiAgICBsbDogcmVzdWx0LmNlbnRlclxuICB9O1xuXG4gIHJlcy5wbGFjZSA9IHJlc3VsdC50ZXh0O1xuICByZXMuaG91c2UgPSByZXN1bHQuYWRkcmVzcztcbiAgaWYgKHJlc3VsdC5wcm9wZXJ0aWVzKSB7XG4gICAgcmVzLnR5cGUgPSByZXN1bHQucHJvcGVydGllcy5raW5kO1xuICAgIHJlcy5jb3VudHJ5ID0gbm9ybWFsaXplLmNvdW50cnkocmVzdWx0LnByb3BlcnRpZXMuY291bnRyeV9jb2RlPy50b1VwcGVyQ2FzZSgpKTtcbiAgfVxuICByZXMuYWRkcmVzcyA9IHJlc3VsdC5wbGFjZV9uYW1lO1xuICBpZiAocmVzLnN0cmVldCAhPT0gcmVzLnBsYWNlKSB7XG4gICAgY29uc3QgYWRkciA9IHJlcy5hZGRyZXNzLnNwbGl0KCcsICcpO1xuICAgIGlmIChhZGRyLmxlbmd0aCA+IDEgJiYgYWRkclswXSA9PT0gcmVzLnBsYWNlKSB7XG4gICAgICBhZGRyLnNoaWZ0KCk7XG4gICAgICByZXMuYWRkcmVzcyA9IGFkZHIuam9pbignLCAnKTtcbiAgICB9XG4gIH1cbiAgLy8gcmVtb3ZlIGVtcHRpZXNcbiAgcmV0dXJuIHV0aWwucmVtb3ZlRW1wdGllcyhyZXMpO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQpIHtcbiAgaWYgKCEocmVzcG9uc2U/LnR5cGUgPT09ICdGZWF0dXJlQ29sbGVjdGlvbicgJiYgcmVzcG9uc2U/LmZlYXR1cmVzPy5sZW5ndGgpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHJlc3VsdC5wbGFjZXMgPSByZXNwb25zZS5mZWF0dXJlcy5tYXAobWFwKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG5cbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcmV2ZXJzZTogdHJ1ZSxcbiAgICB1cmw6IGdldFVybC5iaW5kKHVuZGVmaW5lZCxcbiAgICAgIG9wdGlvbnMubWFwdGlsZXJfdXJsIHx8ICdodHRwczovL2FwaS5tYXB0aWxlci5jb20vZ2VvY29kaW5nLycsXG4gICAgICBvcHRpb25zLm1hcHRpbGVyX2tleSksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3QsXG4gICAgcHJvY2Vzc1Jlc3BvbnNlXG4gIH0pO1xuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cbiIsImNvbnN0IHtcbiAgYWJicjJjb3VudHJ5LFxuICBjb3VudHJ5MmFiYnIsXG4gIHN0YXRlMmFiYnJcbn0gPSByZXF1aXJlKCdAZnVya290L2FkZHJlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNvdW50cnk6IG5vcm1hbGl6ZUNvdW50cnksXG4gIHN0YXRlOiBub3JtYWxpemVTdGF0ZVxufTtcblxuY29uc3QgY291bnRyaWVzID0ge1xuICAnVW5pdGVkIFN0YXRlcyc6ICdVU0EnXG59O1xuXG5mdW5jdGlvbiBub3JtYWxpemVDb3VudHJ5KGNvdW50cnkpIHtcbiAgY291bnRyeSA9IGNvdW50cnkyYWJicltjb3VudHJ5XSB8fCBjb3VudHJ5O1xuICBjb3VudHJ5ID0gYWJicjJjb3VudHJ5W2NvdW50cnldIHx8IGNvdW50cnk7XG4gIHJldHVybiBjb3VudHJpZXNbY291bnRyeV0gfHwgY291bnRyeTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU3RhdGUoc3RhdGUpIHtcbiAgcmV0dXJuIHN0YXRlMmFiYnJbc3RhdGVdIHx8IHN0YXRlO1xufVxuIiwiY29uc3Qgbm9ybWFsaXplID0gcmVxdWlyZSgnLi4vbm9ybWFsaXplJyk7XG5jb25zdCBzdGF0dXMgPSByZXF1aXJlKCcuLi9zdGF0dXMnKTtcbmNvbnN0IHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbmNvbnN0IGNvZGUyc3RhdHVzID0ge1xuICAyMDA6IHN0YXR1cy5zdWNjZXNzLCAvLyBPSyAoemVybyBvciBtb3JlIHJlc3VsdHMgd2lsbCBiZSByZXR1cm5lZClcbiAgNDAwOiBzdGF0dXMuZW1wdHksIC8vIEludmFsaWQgcmVxdWVzdCAoYmFkIHJlcXVlc3Q7IGEgcmVxdWlyZWQgcGFyYW1ldGVyIGlzIG1pc3Npbmc7IGludmFsaWQgY29vcmRpbmF0ZXMpXG4gIDQwMjogc3RhdHVzLmZhaWx1cmUsIC8vIFZhbGlkIHJlcXVlc3QgYnV0IHF1b3RhIGV4Y2VlZGVkIChwYXltZW50IHJlcXVpcmVkKVxuICA0MDM6IHN0YXR1cy5mYWlsdXJlLCAvLyBJbnZhbGlkIG9yIG1pc3NpbmcgYXBpIGtleSAoZm9yYmlkZGVuKVxuICA0MDQ6IHN0YXR1cy5mYWlsdXJlLCAvLyBJbnZhbGlkIEFQSSBlbmRwb2ludFxuICA0MDg6IHN0YXR1cy5lcnJvciwgLy8gVGltZW91dDsgeW91IGNhbiB0cnkgYWdhaW5cbiAgNDEwOiBzdGF0dXMuZW1wdHksIC8vIFJlcXVlc3QgdG9vIGxvbmdcbiAgNDI5OiBzdGF0dXMuZXJyb3IsIC8vIFRvbyBtYW55IHJlcXVlc3RzICh0b28gcXVpY2tseSwgcmF0ZSBsaW1pdGluZylcbiAgNTAzOiBzdGF0dXMuZW1wdHkgLy8gSW50ZXJuYWwgc2VydmVyIGVycm9yXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbi8qXG4gKiBodHRwczovL2dlb2NvZGVyLm9wZW5jYWdlZGF0YS5jb20vYXBpXG4gKi9cblxuZnVuY3Rpb24gZ2V0U3RhdHVzKGVyciwgcmVzcG9uc2UpIHtcbiAgbGV0IGNvZGUgPSByZXNwb25zZSAmJiByZXNwb25zZS5zdGF0dXMgJiYgcmVzcG9uc2Uuc3RhdHVzLmNvZGU7XG4gIGlmICghcmVzcG9uc2UpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29kZSA9IGNvZGUyc3RhdHVzW2NvZGVdO1xuICBpZiAoY29kZSA9PT0gc3RhdHVzLnN1Y2Nlc3MgJiYgIShyZXNwb25zZS5yZXN1bHRzICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoKSkge1xuICAgIGNvZGUgPSBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIGNvZGUgfHwgc3RhdHVzLmVycm9yO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIG9wLCBxdWVyeSkge1xuICBsZXQgcTtcbiAgaWYgKG9wID09PSAnZm9yd2FyZCcpIHtcbiAgICBxID0gKHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UpLnJlcGxhY2UoLyAvZywgJysnKS5yZXBsYWNlKC8sL2csICclMkMnKTtcbiAgfSBlbHNlIHtcbiAgICBxID0gcXVlcnkubGxbMV0gKyAnKycgKyBxdWVyeS5sbFswXTtcbiAgfVxuICB1cmwgKz0gJz9xPScgKyBxO1xuICBpZiAocXVlcnkubWF4KSB7XG4gICAgdXJsICs9ICcmbGltaXQ9JyArIHF1ZXJ5Lm1heDtcbiAgfVxuICBpZiAocXVlcnkuYm91bmRzKSB7XG4gICAgdXJsICs9ICcmYm91bmRzPScgKyBxdWVyeS5ib3VuZHMubWFwKGpvaW4pLmpvaW4oJywnKTtcbiAgfVxuICBpZiAocXVlcnkubGFuZykge1xuICAgIHVybCArPSAnJmxhbmd1YWdlPScgKyBxdWVyeS5sYW5nO1xuICB9XG4gIHVybCArPSAnJm5vX2Fubm90YXRpb25zPTEnO1xuICByZXR1cm4gdXJsICsgJyZrZXk9JyArIGtleTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVJlcXVlc3QoKSB7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcblxuICBmdW5jdGlvbiBwcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQpIHtcbiAgICBpZiAoIShyZXNwb25zZSAmJiByZXNwb25zZS5yZXN1bHRzICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXN1bHQucGxhY2VzID0gcmVzcG9uc2UucmVzdWx0cy5tYXAoZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgY29uc3QgY29tcG9uZW50cyA9IHJlc3VsdC5jb21wb25lbnRzO1xuICAgICAgY29uc3QgZ2VvbSA9IHJlc3VsdC5nZW9tZXRyeTtcblxuICAgICAgY29uc3QgcmVzID0ge1xuICAgICAgICBsbDogW2dlb20ubG5nLCBnZW9tLmxhdF1cbiAgICAgIH07XG5cbiAgICAgIGlmIChjb21wb25lbnRzLl90eXBlKSB7XG4gICAgICAgIHJlcy50eXBlID0gY29tcG9uZW50cy5fdHlwZTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzW2NvbXBvbmVudHMuX3R5cGVdKSB7XG4gICAgICAgIHJlcy5wbGFjZSA9IGNvbXBvbmVudHNbY29tcG9uZW50cy5fdHlwZV07XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5ob3VzZV9udW1iZXIpIHtcbiAgICAgICAgcmVzLmhvdXNlID0gY29tcG9uZW50cy5ob3VzZV9udW1iZXI7XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5yb2FkIHx8IGNvbXBvbmVudHMucGVkZXN0cmlhbikge1xuICAgICAgICByZXMuc3RyZWV0ID0gY29tcG9uZW50cy5yb2FkIHx8IGNvbXBvbmVudHMucGVkZXN0cmlhbjtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLm5laWdoYm91cmhvb2QgfHwgY29tcG9uZW50cy52aWxsYWdlKSB7XG4gICAgICAgIHJlcy5jb21tdW5pdHkgPSBjb21wb25lbnRzLm5laWdoYm91cmhvb2QgfHwgY29tcG9uZW50cy52aWxsYWdlO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMudG93biB8fCBjb21wb25lbnRzLmNpdHkpIHtcbiAgICAgICAgcmVzLnRvd24gPSBjb21wb25lbnRzLnRvd24gfHwgY29tcG9uZW50cy5jaXR5O1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMuY291bnR5KSB7XG4gICAgICAgIHJlcy5jb3VudHkgPSBjb21wb25lbnRzLmNvdW50eTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLnN0YXRlX2NvZGUpIHtcbiAgICAgICAgcmVzLnByb3ZpbmNlID0gbm9ybWFsaXplLnN0YXRlKGNvbXBvbmVudHMuc3RhdGUpIHx8IGNvbXBvbmVudHMuc3RhdGVfY29kZTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLmNvdW50cnkpIHtcbiAgICAgICAgcmVzLmNvdW50cnkgPSBub3JtYWxpemUuY291bnRyeShjb21wb25lbnRzLmNvdW50cnkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcmV2ZXJzZTogdHJ1ZSxcbiAgICB1cmw6IGdldFVybC5iaW5kKHVuZGVmaW5lZCxcbiAgICAgIG9wdGlvbnMub3BlbmNhZ2VfdXJsIHx8ICdodHRwczovL2FwaS5vcGVuY2FnZWRhdGEuY29tL2dlb2NvZGUvdjEvanNvbicsXG4gICAgICBvcHRpb25zLm9wZW5jYWdlX2tleSksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3QsXG4gICAgcHJvY2Vzc1Jlc3BvbnNlXG4gIH0pO1xuICBpZiAob3B0aW9ucy5vcGVuY2FnZV9wYXJhbWV0ZXJzKSB7XG4gICAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywgb3B0aW9ucy5vcGVuY2FnZV9wYXJhbWV0ZXJzKTtcbiAgfVxuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gam9pbihsbCkge1xuICByZXR1cm4gbGwuam9pbignLCcpO1xufVxuIiwiY29uc3Qgbm9ybWFsaXplID0gcmVxdWlyZSgnLi4vbm9ybWFsaXplJyk7XG5jb25zdCBzdGF0dXMgPSByZXF1aXJlKCcuLi9zdGF0dXMnKTtcbmNvbnN0IHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcblxuLypcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9wZWxpYXMvZG9jdW1lbnRhdGlvbi9ibG9iL21hc3Rlci9zZWFyY2gubWQjc2VhcmNoLXRoZS13b3JsZFxuICogaHR0cHM6Ly9naXRodWIuY29tL3BlbGlhcy9kb2N1bWVudGF0aW9uL2Jsb2IvbWFzdGVyL3JldmVyc2UubWQjcmV2ZXJzZS1nZW9jb2RpbmdcbiAqL1xuXG5mdW5jdGlvbiBnZXRTdGF0dXMoZXJyLCByZXNwb25zZSkge1xuICBpZiAoZXJyICYmICFyZXNwb25zZSkge1xuICAgIHJldHVybiBzdGF0dXMuZmFpbHVyZTtcbiAgfVxuICBpZiAoIXJlc3BvbnNlKSB7XG4gICAgcmV0dXJuIHN0YXR1cy5lcnJvcjtcbiAgfVxuICBpZiAoIXJlc3BvbnNlLmZlYXR1cmVzIHx8IHJlc3BvbnNlLmZlYXR1cmVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIHN0YXR1cy5zdWNjZXNzO1xufVxuXG4vKlxuRXhhbXBsZXM6XG5cbmh0dHBzOi8vYXBpLm9wZW5yb3V0ZXNlcnZpY2Uub3JnL2dlb2NvZGUvc2VhcmNoP2FwaV9rZXk9JHtBUElfS0VZfSZ0ZXh0PVNTJTIwU28lQzUlODJkZWtcIlxuaHR0cHM6Ly9hcGkub3BlbnJvdXRlc2VydmljZS5vcmcvZ2VvY29kZS9hdXRvY29tcGxldGU/YXBpX2tleT0ke0FQSV9LRVl9JnRleHQ9U1MlMjBTbyVDNSU4MmRla1wiXG5odHRwczovL2FwaS5vcGVucm91dGVzZXJ2aWNlLm9yZy9nZW9jb2RlL3JldmVyc2U/YXBpX2tleT0ke0FQSV9LRVl9JnBvaW50LmxhdD0tMjIuNjc5MiZwb2ludC5sb249MTQuNTI3MlwiXG5cbiovXG5cbmZ1bmN0aW9uIGdldFVybCh1cmwsIGtleSwgZW5hYmxlUGFydGlhbCwgb3AsIHF1ZXJ5KSB7XG4gIGNvbnN0IHEgPSBbXTtcbiAgbGV0IHN1ZmZpeDtcbiAgc3dpdGNoIChvcCkge1xuICAgIGNhc2UgJ2ZvcndhcmQnOlxuICAgICAgc3VmZml4ID0gcXVlcnkucGFydGlhbCAmJiBlbmFibGVQYXJ0aWFsID8gJy9hdXRvY29tcGxldGUnIDogJy9zZWFyY2gnO1xuICAgICAgcS5wdXNoKGB0ZXh0PSR7ZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UpfWApO1xuICAgICAgaWYgKHF1ZXJ5LmJvdW5kcykge1xuICAgICAgICBjb25zdCBbc3csIG5lXSA9IHF1ZXJ5LmJvdW5kcztcbiAgICAgICAgcS5wdXNoKFxuICAgICAgICAgIGBib3VuZGFyeS5yZWN0Lm1pbl9sb249JHtzd1swXX1gLFxuICAgICAgICAgIGBib3VuZGFyeS5yZWN0Lm1pbl9sYXQ9JHtzd1sxXX1gLFxuICAgICAgICAgIGBib3VuZGFyeS5yZWN0Lm1heF9sb249JHtuZVswXX1gLFxuICAgICAgICAgIGBib3VuZGFyeS5yZWN0Lm1heF9sYXQ9JHtuZVsxXX1gXG4gICAgICAgICk7XG4gICAgICAgIGlmIChxdWVyeS5hZGRyZXNzKSB7XG4gICAgICAgICAgcS5wdXNoKCdsYXllcnM9YWRkcmVzcycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHEucHVzaCgnbGF5ZXJzPXZlbnVlLGNvYXJzZScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyZXZlcnNlJzpcbiAgICAgIHN1ZmZpeCA9ICcvcmV2ZXJzZSc7XG4gICAgICBxLnB1c2goXG4gICAgICAgIGBwb2ludC5sb249JHtxdWVyeS5sbFswXX1gLFxuICAgICAgICBgcG9pbnQubGF0PSR7cXVlcnkubGxbMV19YFxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBpbnZhbGlkIG9wZXJhdGlvblxuICAgICAgcmV0dXJuO1xuICB9XG4gIGlmIChxdWVyeS5tYXgpIHtcbiAgICBxLnB1c2goYHNpemU9JHtxdWVyeS5tYXh9YCk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmxhbmcpIHtcbiAgICBjb25zdCBsYW5nID0gcXVlcnkubGFuZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCdfJykuam9pbignLScpO1xuICAgIHEucHVzaChgbGFuZz0ke2xhbmd9YCk7XG4gIH1cbiAgcS5wdXNoKGBhcGlfa2V5PSR7a2V5fWApO1xuICByZXR1cm4gdXJsICsgc3VmZml4ICsgJz8nICsgcS5qb2luKCcmJyk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZmlsdGVyKGYpIHtcbiAgcmV0dXJuIGYudHlwZSA9PT0gJ0ZlYXR1cmUnICYmIGYuZ2VvbWV0cnkgJiYgZi5nZW9tZXRyeS50eXBlID09PSAnUG9pbnQnO1xufVxuXG5jb25zdCBJRF9UT0tFTiA9ICdfX0lEX18nO1xuY29uc3QgU09VUkNFUyA9IHtcbiAgb3BlbnN0cmVldG1hcDogYGh0dHBzOi8vd3d3Lm9wZW5zdHJlZXRtYXAub3JnLyR7SURfVE9LRU59YCxcbiAgd2hvc29uZmlyc3Q6IGBodHRwczovL3NwZWx1bmtlci53aG9zb25maXJzdC5vcmcvaWQvJHtJRF9UT0tFTn0vYFxufTtcblxuZnVuY3Rpb24gbWFwKGYpIHtcbiAgY29uc3QgcXVlcnkgPSB0aGlzO1xuICBjb25zdCBwID0gZi5wcm9wZXJ0aWVzO1xuICBjb25zdCBwbGFjZSA9IHtcbiAgICBsbDogZi5nZW9tZXRyeS5jb29yZGluYXRlcyxcbiAgICB0eXBlOiBwLmxheWVyLFxuICAgIGhvdXNlOiBwLmhvdXNlbnVtYmVyLFxuICAgIHN0cmVldDogcC5zdHJlZXQsXG4gICAgdG93bjogcC5sb2NhbGl0eSxcbiAgICBjb3VudHk6IHAuY291bnR5LFxuICAgIHByb3ZpbmNlOiBub3JtYWxpemUuc3RhdGUocC5yZWdpb24pLFxuICAgIGNvdW50cnk6IG5vcm1hbGl6ZS5jb3VudHJ5KHAuY291bnRyeSlcbiAgfTtcbiAgaWYgKHBsYWNlLnR5cGUgPT09ICd2ZW51ZScpIHtcbiAgICBwbGFjZS5wbGFjZSA9IHAubmFtZTtcbiAgICBpZiAocXVlcnkudHlwZSkge1xuICAgICAgcGxhY2UudHlwZSA9IHF1ZXJ5LnR5cGU7XG4gICAgfVxuICAgIGNvbnN0IHVybCA9IFNPVVJDRVNbcC5zb3VyY2VdO1xuICAgIGlmICh1cmwpIHtcbiAgICAgIHBsYWNlLnVybCA9IHVybC5yZXBsYWNlKElEX1RPS0VOLCBwLnNvdXJjZV9pZCk7XG4gICAgfVxuICB9XG5cbiAgLy8gcmVtb3ZlIGVtcHRpZXNcbiAgcmV0dXJuIHV0aWwucmVtb3ZlRW1wdGllcyhwbGFjZSk7XG59XG5cbmZ1bmN0aW9uIHZlbnVlRmlyc3QoeyBwcm9wZXJ0aWVzOiB7IGNvbmZpZGVuY2U6IGMxLCBkaXN0YW5jZTogZDEsIGxheWVyOiBsMSB9IH0sXG4gICAgeyBwcm9wZXJ0aWVzOiB7IGNvbmZpZGVuY2U6IGMyLCBkaXN0YW5jZTogZDIsIGxheWVyOiBsMiB9IH0pIHtcbiAgaWYgKGMxICE9PSBjMikge1xuICAgIC8vIGhpZ2hlciBjb25maWRlbmNlIGlzIGJldHRlclxuICAgIHJldHVybiBjMiAtIGMxO1xuICB9XG4gIGlmIChkMSAhPT0gZDIpIHtcbiAgICAvLyBsb3dlciBkaXN0YW5jZSBpcyBiZXR0ZXJcbiAgICByZXR1cm4gZDEgLSBkMjtcbiAgfVxuICBpZiAobDEgPT09IGwyKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cbiAgaWYgKGwxID09PSAndmVudWUnKSB7XG4gICAgcmV0dXJuIC0xO1xuICB9XG4gIGlmIChsMiA9PT0gJ3ZlbnVlJykge1xuICAgIHJldHVybiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzUmVzcG9uc2UoeyBmZWF0dXJlcyB9LCBxdWVyeSwgcmVzdWx0KSB7XG4gIGNvbnN0IHBsYWNlcyA9IGZlYXR1cmVzLmZpbHRlcihmaWx0ZXIpO1xuICBpZiAocXVlcnkudHlwZSkge1xuICAgIHBsYWNlcy5zb3J0KHZlbnVlRmlyc3QpO1xuICB9XG4gIHJlc3VsdC5wbGFjZXMgPSBwbGFjZXMubWFwKG1hcCwgcXVlcnkpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcmV2ZXJzZTogdHJ1ZSxcbiAgICB1cmw6IGdldFVybC5iaW5kKHVuZGVmaW5lZCxcbiAgICAgIG9wdGlvbnMucGVsaWFzX3VybCB8fCAnaHR0cHM6Ly9hcGkub3BlbnJvdXRlc2VydmljZS5vcmcvZ2VvY29kZScsXG4gICAgICBvcHRpb25zLnBlbGlhc19rZXksXG4gICAgICBvcHRpb25zLnBlbGlhc19wYXJhbWV0ZXJzICYmIG9wdGlvbnMucGVsaWFzX3BhcmFtZXRlcnMuZW5hYmxlUGFydGlhbCksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3QsXG4gICAgcHJvY2Vzc1Jlc3BvbnNlXG4gIH0pO1xuICBpZiAob3B0aW9ucy5wZWxpYXNfcGFyYW1ldGVycykge1xuICAgIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIG9wdGlvbnMucGVsaWFzX3BhcmFtZXRlcnMpO1xuICB9XG4gIHJldHVybiByZXF1aXJlKCcuLicpKG9wdGlvbnMpO1xufVxuIiwiY29uc3Qgbm9ybWFsaXplID0gcmVxdWlyZSgnLi4vbm9ybWFsaXplJyk7XG5jb25zdCBzdGF0dXMgPSByZXF1aXJlKCcuLi9zdGF0dXMnKTtcbmNvbnN0IHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcblxuLypcbiAqIGh0dHBzOi8vcG9zaXRpb25zdGFjay5jb20vZG9jdW1lbnRhdGlvblxuICovXG5cbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIGlmICghKHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5sZW5ndGggPiAwKSkge1xuICAgIHJldHVybiBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIHN0YXR1cy5zdWNjZXNzO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIHVucmVzdHJpY3RlZCwgb3AsIHF1ZXJ5KSB7XG4gIGNvbnN0IHEgPSBbXTtcbiAgbGV0IHN1ZmZpeDtcbiAgc3dpdGNoIChvcCkge1xuICAgIGNhc2UgJ2ZvcndhcmQnOlxuICAgICAgc3VmZml4ID0gJy9mb3J3YXJkJztcbiAgICAgIHEucHVzaChgcXVlcnk9JHtlbmNvZGVVUklDb21wb25lbnQocXVlcnkuYWRkcmVzcyB8fCBxdWVyeS5wbGFjZSl9YCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyZXZlcnNlJzpcbiAgICAgIHN1ZmZpeCA9ICcvcmV2ZXJzZSc7XG4gICAgICBxLnB1c2goYHF1ZXJ5PSR7cXVlcnkubGxbMV19LCR7cXVlcnkubGxbMF19YCk7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gaW52YWxpZCBvcGVyYXRpb25cbiAgICAgIHJldHVybjtcbiAgfVxuICBpZiAocXVlcnkubWF4KSB7XG4gICAgcS5wdXNoKGBsaW1pdD0ke3F1ZXJ5Lm1heH1gKTtcbiAgfVxuICBpZiAocXVlcnkubGFuZyAmJiB1bnJlc3RyaWN0ZWQpIHtcbiAgICBjb25zdCBsYW5nID0gcXVlcnkubGFuZy50b0xvd2VyQ2FzZSgpLnNwbGl0KC9ffC0vKVswXTtcbiAgICBxLnB1c2goYGxhbmd1YWdlPSR7bGFuZ31gKTtcbiAgfVxuICBxLnB1c2goYGFjY2Vzc19rZXk9JHtrZXl9YCk7XG4gIHJldHVybiB1cmwgKyBzdWZmaXggKyAnPycgKyBxLmpvaW4oJyYnKTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVJlcXVlc3QoKSB7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBndWVzc0NpdHkoeyBsYWJlbCwgbmFtZSwgcmVnaW9uX2NvZGUsIHR5cGUgfSkge1xuICBjb25zdCBsYWJlbFdpdGhvdXROYW1lID0gbGFiZWwucmVwbGFjZShuYW1lLCAnJykuc3BsaXQoJywnKS5maW5kKHQgPT4gdC50cmltKCkpO1xuICBpZiAobGFiZWxXaXRob3V0TmFtZSkge1xuICAgIGNvbnN0IGNpdHkgPSBsYWJlbFdpdGhvdXROYW1lLnRyaW0oKTtcbiAgICBpZiAoY2l0eSAhPT0gcmVnaW9uX2NvZGUpIHtcbiAgICAgIHJldHVybiBjaXR5O1xuICAgIH1cbiAgfVxuICBpZiAodHlwZSA9PT0gJ2xvY2FsaXR5Jykge1xuICAgIHJldHVybiBuYW1lO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hcChmKSB7XG4gIGNvbnN0IHBsYWNlID0ge1xuICAgIGxsOiBbZi5sb25naXR1ZGUsIGYubGF0aXR1ZGVdLFxuICAgIHR5cGU6IGYudHlwZSxcbiAgICBob3VzZTogZi5udW1iZXIsXG4gICAgc3RyZWV0OiBmLnN0cmVldCxcbiAgICB0b3duOiBndWVzc0NpdHkoZiksXG4gICAgcHJvdmluY2U6IG5vcm1hbGl6ZS5zdGF0ZShmLnJlZ2lvbikgfHwgZi5yZWdpb25fY29kZSxcbiAgICBjb3VudHJ5OiBub3JtYWxpemUuY291bnRyeShmLmNvdW50cnkpXG4gIH07XG4gIGlmIChmLnR5cGUgIT09ICdhZGRyZXNzJykge1xuICAgIHBsYWNlLnBsYWNlID0gZi5uYW1lO1xuICB9XG5cbiAgLy8gcmVtb3ZlIGVtcHRpZXNcbiAgcmV0dXJuIHV0aWwucmVtb3ZlRW1wdGllcyhwbGFjZSk7XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NSZXNwb25zZShyZXNwb25zZSwgcXVlcnksIHJlc3VsdCkge1xuICBjb25zdCB7IGRhdGEgfSA9IHJlc3BvbnNlO1xuICByZXN1bHQucGxhY2VzID0gZGF0YS5tYXAobWFwKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG4gIGNvbnN0IHVybCA9IG9wdGlvbnMucG9zaXRpb25zdGFja191cmwgfHwgJ2h0dHA6Ly9hcGkucG9zaXRpb25zdGFjay5jb20vdjEnO1xuICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCB7XG4gICAgZm9yd2FyZDogdHJ1ZSxcbiAgICByZXZlcnNlOiB0cnVlLFxuICAgIHVybDogZ2V0VXJsLmJpbmQodW5kZWZpbmVkLFxuICAgICAgdXJsLFxuICAgICAgb3B0aW9ucy5wb3NpdGlvbnN0YWNrX2tleSxcbiAgICAgIHVybC5zdGFydHNXaXRoKCdodHRwczonKSksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3QsXG4gICAgcHJvY2Vzc1Jlc3BvbnNlXG4gIH0pO1xuICBpZiAob3B0aW9ucy5wb3NpdGlvbnN0YWNrX3BhcmFtZXRlcnMpIHtcbiAgICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCBvcHRpb25zLnBvc2l0aW9uc3RhY2tfcGFyYW1ldGVycyk7XG4gIH1cbiAgcmV0dXJuIHJlcXVpcmUoJy4uJykob3B0aW9ucyk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgc3VjY2VzczogJ3N1Y2Nlc3MnLCAvLyBzdWNjZXNzXG4gIGZhaWx1cmU6ICdmYWlsdXJlJywgLy8gdWx0aW1hdGUgZmFpbHVyZVxuICBlcnJvcjogJ2Vycm9yJywgLy8gdGVtcG9yYXJ5IGVycm9yXG4gIGVtcHR5OiAnZW1wdHknIC8vIG5vIHJlc3VsdFxufTtcbiIsImNvbnN0IHN0YXR1cyA9IHJlcXVpcmUoJy4uL3N0YXR1cycpO1xuY29uc3QgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG5mdW5jdGlvbiByZXF1ZXN0KHVybCwgcmVxLCBmbikge1xuICBmbigpO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwoKSB7fVxuXG5mdW5jdGlvbiBwcmVwYXJlUmVxdWVzdCgpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdldFN0YXR1cygpIHtcbiAgcmV0dXJuIHN0YXR1cy5zdWNjZXNzO1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcmV2ZXJzZTogdHJ1ZSxcbiAgICByZXF1ZXN0LFxuICAgIHVybDogZ2V0VXJsLFxuICAgIHN0YXR1czogZ2V0U3RhdHVzLFxuICAgIHByZXBhcmVSZXF1ZXN0LFxuICAgIHByb2Nlc3NSZXNwb25zZShyZXNwb25zZSwgcXVlcnksIHJlc3VsdCkge1xuICAgICAgcmVzdWx0LnBsYWNlcyA9IG9wdGlvbnMucmVzcG9uc2UocXVlcnkpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH0pO1xuICBpZiAob3B0aW9ucy5zeW5jaHJvbm91c19wYXJhbWV0ZXJzKSB7XG4gICAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywgb3B0aW9ucy5zeW5jaHJvbm91c19wYXJhbWV0ZXJzKTtcbiAgfVxuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cbiIsImNvbnN0IHsgcHJldHRpZnksIHN0cmluZ2lmeSB9ID0gcmVxdWlyZSgnQGZ1cmtvdC9hZGRyZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBkZWZhdWx0cyxcbiAgcHJldHRpZnksXG4gIHJlbW92ZUVtcHRpZXMsXG4gIHN0cmluZ2lmeSxcbiAgdG9PYmplY3QsXG4gIHdpdGhUaW1lb3V0XG59O1xuXG5mdW5jdGlvbiBkZWZhdWx0cyhvYmosIHNvdXJjZSkge1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgc291cmNlLCBvYmopO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFbXB0aWVzKHBsYWNlKSB7XG4gIE9iamVjdC5rZXlzKHBsYWNlKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAoIXBsYWNlW2tleV0pIHtcbiAgICAgIGRlbGV0ZSBwbGFjZVtrZXldO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBwbGFjZTtcbn1cblxuZnVuY3Rpb24gdG9PYmplY3QoYXJyYXkpIHtcbiAgcmV0dXJuIGFycmF5LnJlZHVjZShmdW5jdGlvbiAob2JqLCBlKSB7XG4gICAgb2JqW2VdID0gZTtcbiAgICByZXR1cm4gb2JqO1xuICB9LCB7fSk7XG59XG5cbmZ1bmN0aW9uIHdpdGhUaW1lb3V0KHByb21pc2UsIHRpbWVvdXQpIHtcbiAgbGV0IGlkO1xuICByZXR1cm4gUHJvbWlzZVxuICAgIC5yYWNlKFtwcm9taXNlLCBuZXcgUHJvbWlzZSh0aW1lb3V0UHJvbWlzZSldKVxuICAgIC5maW5hbGx5KCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuXG4gIGZ1bmN0aW9uIHRpbWVvdXRQcm9taXNlKF8sIHJlamVjdCkge1xuICAgIGlkID0gc2V0VGltZW91dChcbiAgICAgICgpID0+IHJlamVjdChFcnJvcigndGltZW91dCcsIHsgY2F1c2U6IFN5bWJvbC5mb3IoJ3RpbWVvdXQnKSB9KSksXG4gICAgICB0aW1lb3V0XG4gICAgKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBTaW1wbGUsIGxpZ2h0d2VpZ2h0LCB1c2FibGUgbG9jYWwgYXV0b2NvbXBsZXRlIGxpYnJhcnkgZm9yIG1vZGVybiBicm93c2Vyc1xuICogQmVjYXVzZSB0aGVyZSB3ZXJlbuKAmXQgZW5vdWdoIGF1dG9jb21wbGV0ZSBzY3JpcHRzIGluIHRoZSB3b3JsZD8gQmVjYXVzZSBJ4oCZbSBjb21wbGV0ZWx5IGluc2FuZSBhbmQgaGF2ZSBOSUggc3luZHJvbWU/IFByb2JhYmx5IGJvdGguIDpQXG4gKiBAYXV0aG9yIExlYSBWZXJvdSBodHRwOi8vbGVhdmVyb3UuZ2l0aHViLmlvL2F3ZXNvbXBsZXRlXG4gKiBNSVQgbGljZW5zZVxuICovXG5cbihmdW5jdGlvbiAoKSB7XG5cbnZhciBfID0gZnVuY3Rpb24gKGlucHV0LCBvKSB7XG5cdHZhciBtZSA9IHRoaXM7XG4gICAgXG4gICAgLy8gS2VlcCB0cmFjayBvZiBudW1iZXIgb2YgaW5zdGFuY2VzIGZvciB1bmlxdWUgSURzXG4gICAgXy5jb3VudCA9IChfLmNvdW50IHx8IDApICsgMTtcbiAgICB0aGlzLmNvdW50ID0gXy5jb3VudDtcblxuXHQvLyBTZXR1cFxuXG5cdHRoaXMuaXNPcGVuZWQgPSBmYWxzZTtcblxuXHR0aGlzLmlucHV0ID0gJChpbnB1dCk7XG5cdHRoaXMuaW5wdXQuc2V0QXR0cmlidXRlKFwiYXV0b2NvbXBsZXRlXCIsIFwib2ZmXCIpO1xuXHR0aGlzLmlucHV0LnNldEF0dHJpYnV0ZShcImFyaWEtb3duc1wiLCBcImF3ZXNvbXBsZXRlX2xpc3RfXCIgKyB0aGlzLmNvdW50KTtcblx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoXCJyb2xlXCIsIFwiY29tYm9ib3hcIik7XG5cblx0byA9IG8gfHwge307XG5cblx0Y29uZmlndXJlKHRoaXMsIHtcblx0XHRtaW5DaGFyczogMixcblx0XHRtYXhJdGVtczogMTAsXG5cdFx0YXV0b0ZpcnN0OiBmYWxzZSxcblx0XHRkYXRhOiBfLkRBVEEsXG5cdFx0ZmlsdGVyOiBfLkZJTFRFUl9DT05UQUlOUyxcblx0XHRzb3J0OiBvLnNvcnQgPT09IGZhbHNlID8gZmFsc2UgOiBfLlNPUlRfQllMRU5HVEgsXG5cdFx0Y29udGFpbmVyOiBfLkNPTlRBSU5FUixcblx0XHRpdGVtOiBfLklURU0sXG5cdFx0cmVwbGFjZTogXy5SRVBMQUNFXG5cdH0sIG8pO1xuXG5cdHRoaXMuaW5kZXggPSAtMTtcblxuXHQvLyBDcmVhdGUgbmVjZXNzYXJ5IGVsZW1lbnRzXG5cblx0dGhpcy5jb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcihpbnB1dCk7XG5cblx0dGhpcy51bCA9ICQuY3JlYXRlKFwidWxcIiwge1xuXHRcdGhpZGRlbjogXCJoaWRkZW5cIixcbiAgICAgICAgcm9sZTogXCJsaXN0Ym94XCIsXG4gICAgICAgIGlkOiBcImF3ZXNvbXBsZXRlX2xpc3RfXCIgKyB0aGlzLmNvdW50LFxuXHRcdGluc2lkZTogdGhpcy5jb250YWluZXJcblx0fSk7XG5cblx0dGhpcy5zdGF0dXMgPSAkLmNyZWF0ZShcInNwYW5cIiwge1xuXHRcdGNsYXNzTmFtZTogXCJ2aXN1YWxseS1oaWRkZW5cIixcblx0XHRyb2xlOiBcInN0YXR1c1wiLFxuXHRcdFwiYXJpYS1saXZlXCI6IFwiYXNzZXJ0aXZlXCIsXG4gICAgICAgIFwiYXJpYS1hdG9taWNcIjogdHJ1ZSxcbiAgICAgICAgaW5zaWRlOiB0aGlzLmNvbnRhaW5lcixcbiAgICAgICAgdGV4dENvbnRlbnQ6IHRoaXMubWluQ2hhcnMgIT0gMCA/IChcIlR5cGUgXCIgKyB0aGlzLm1pbkNoYXJzICsgXCIgb3IgbW9yZSBjaGFyYWN0ZXJzIGZvciByZXN1bHRzLlwiKSA6IFwiQmVnaW4gdHlwaW5nIGZvciByZXN1bHRzLlwiXG5cdH0pO1xuXG5cdC8vIEJpbmQgZXZlbnRzXG5cblx0dGhpcy5fZXZlbnRzID0ge1xuXHRcdGlucHV0OiB7XG5cdFx0XHRcImlucHV0XCI6IHRoaXMuZXZhbHVhdGUuYmluZCh0aGlzKSxcblx0XHRcdFwiYmx1clwiOiB0aGlzLmNsb3NlLmJpbmQodGhpcywgeyByZWFzb246IFwiYmx1clwiIH0pLFxuXHRcdFx0XCJrZXlkb3duXCI6IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHR2YXIgYyA9IGV2dC5rZXlDb2RlO1xuXG5cdFx0XHRcdC8vIElmIHRoZSBkcm9wZG93biBgdWxgIGlzIGluIHZpZXcsIHRoZW4gYWN0IG9uIGtleWRvd24gZm9yIHRoZSBmb2xsb3dpbmcga2V5czpcblx0XHRcdFx0Ly8gRW50ZXIgLyBFc2MgLyBVcCAvIERvd25cblx0XHRcdFx0aWYobWUub3BlbmVkKSB7XG5cdFx0XHRcdFx0aWYgKGMgPT09IDEzICYmIG1lLnNlbGVjdGVkKSB7IC8vIEVudGVyXG5cdFx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdG1lLnNlbGVjdCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChjID09PSAyNykgeyAvLyBFc2Ncblx0XHRcdFx0XHRcdG1lLmNsb3NlKHsgcmVhc29uOiBcImVzY1wiIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChjID09PSAzOCB8fCBjID09PSA0MCkgeyAvLyBEb3duL1VwIGFycm93XG5cdFx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdG1lW2MgPT09IDM4PyBcInByZXZpb3VzXCIgOiBcIm5leHRcIl0oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdGZvcm06IHtcblx0XHRcdFwic3VibWl0XCI6IHRoaXMuY2xvc2UuYmluZCh0aGlzLCB7IHJlYXNvbjogXCJzdWJtaXRcIiB9KVxuXHRcdH0sXG5cdFx0dWw6IHtcblx0XHRcdC8vIFByZXZlbnQgdGhlIGRlZmF1bHQgbW91c2Vkb3dtLCB3aGljaCBlbnN1cmVzIHRoZSBpbnB1dCBpcyBub3QgYmx1cnJlZC5cblx0XHRcdC8vIFRoZSBhY3R1YWwgc2VsZWN0aW9uIHdpbGwgaGFwcGVuIG9uIGNsaWNrLiBUaGlzIGFsc28gZW5zdXJlcyBkcmFnZ2luZyB0aGVcblx0XHRcdC8vIGN1cnNvciBhd2F5IGZyb20gdGhlIGxpc3QgaXRlbSB3aWxsIGNhbmNlbCB0aGUgc2VsZWN0aW9uXG5cdFx0XHRcIm1vdXNlZG93blwiOiBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gVGhlIGNsaWNrIGV2ZW50IGlzIGZpcmVkIGV2ZW4gaWYgdGhlIGNvcnJlc3BvbmRpbmcgbW91c2Vkb3duIGV2ZW50IGhhcyBjYWxsZWQgcHJldmVudERlZmF1bHRcblx0XHRcdFwiY2xpY2tcIjogZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdHZhciBsaSA9IGV2dC50YXJnZXQ7XG5cblx0XHRcdFx0aWYgKGxpICE9PSB0aGlzKSB7XG5cblx0XHRcdFx0XHR3aGlsZSAobGkgJiYgIS9saS9pLnRlc3QobGkubm9kZU5hbWUpKSB7XG5cdFx0XHRcdFx0XHRsaSA9IGxpLnBhcmVudE5vZGU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGxpICYmIGV2dC5idXR0b24gPT09IDApIHsgIC8vIE9ubHkgc2VsZWN0IG9uIGxlZnQgY2xpY2tcblx0XHRcdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0bWUuc2VsZWN0KGxpLCBldnQudGFyZ2V0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0JC5iaW5kKHRoaXMuaW5wdXQsIHRoaXMuX2V2ZW50cy5pbnB1dCk7XG5cdCQuYmluZCh0aGlzLmlucHV0LmZvcm0sIHRoaXMuX2V2ZW50cy5mb3JtKTtcblx0JC5iaW5kKHRoaXMudWwsIHRoaXMuX2V2ZW50cy51bCk7XG5cblx0aWYgKHRoaXMuaW5wdXQuaGFzQXR0cmlidXRlKFwibGlzdFwiKSkge1xuXHRcdHRoaXMubGlzdCA9IFwiI1wiICsgdGhpcy5pbnB1dC5nZXRBdHRyaWJ1dGUoXCJsaXN0XCIpO1xuXHRcdHRoaXMuaW5wdXQucmVtb3ZlQXR0cmlidXRlKFwibGlzdFwiKTtcblx0fVxuXHRlbHNlIHtcblx0XHR0aGlzLmxpc3QgPSB0aGlzLmlucHV0LmdldEF0dHJpYnV0ZShcImRhdGEtbGlzdFwiKSB8fCBvLmxpc3QgfHwgW107XG5cdH1cblxuXHRfLmFsbC5wdXNoKHRoaXMpO1xufTtcblxuXy5wcm90b3R5cGUgPSB7XG5cdHNldCBsaXN0KGxpc3QpIHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShsaXN0KSkge1xuXHRcdFx0dGhpcy5fbGlzdCA9IGxpc3Q7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiBsaXN0ID09PSBcInN0cmluZ1wiICYmIGxpc3QuaW5kZXhPZihcIixcIikgPiAtMSkge1xuXHRcdFx0XHR0aGlzLl9saXN0ID0gbGlzdC5zcGxpdCgvXFxzKixcXHMqLyk7XG5cdFx0fVxuXHRcdGVsc2UgeyAvLyBFbGVtZW50IG9yIENTUyBzZWxlY3RvclxuXHRcdFx0bGlzdCA9ICQobGlzdCk7XG5cblx0XHRcdGlmIChsaXN0ICYmIGxpc3QuY2hpbGRyZW4pIHtcblx0XHRcdFx0dmFyIGl0ZW1zID0gW107XG5cdFx0XHRcdHNsaWNlLmFwcGx5KGxpc3QuY2hpbGRyZW4pLmZvckVhY2goZnVuY3Rpb24gKGVsKSB7XG5cdFx0XHRcdFx0aWYgKCFlbC5kaXNhYmxlZCkge1xuXHRcdFx0XHRcdFx0dmFyIHRleHQgPSBlbC50ZXh0Q29udGVudC50cmltKCk7XG5cdFx0XHRcdFx0XHR2YXIgdmFsdWUgPSBlbC52YWx1ZSB8fCB0ZXh0O1xuXHRcdFx0XHRcdFx0dmFyIGxhYmVsID0gZWwubGFiZWwgfHwgdGV4dDtcblx0XHRcdFx0XHRcdGlmICh2YWx1ZSAhPT0gXCJcIikge1xuXHRcdFx0XHRcdFx0XHRpdGVtcy5wdXNoKHsgbGFiZWw6IGxhYmVsLCB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5fbGlzdCA9IGl0ZW1zO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSB0aGlzLmlucHV0KSB7XG5cdFx0XHR0aGlzLmV2YWx1YXRlKCk7XG5cdFx0fVxuXHR9LFxuXG5cdGdldCBzZWxlY3RlZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5pbmRleCA+IC0xO1xuXHR9LFxuXG5cdGdldCBvcGVuZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXNPcGVuZWQ7XG5cdH0sXG5cblx0Y2xvc2U6IGZ1bmN0aW9uIChvKSB7XG5cdFx0aWYgKCF0aGlzLm9wZW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudWwuc2V0QXR0cmlidXRlKFwiaGlkZGVuXCIsIFwiXCIpO1xuXHRcdHRoaXMuaXNPcGVuZWQgPSBmYWxzZTtcblx0XHR0aGlzLmluZGV4ID0gLTE7XG4gICAgXG5cdFx0dGhpcy5zdGF0dXMuc2V0QXR0cmlidXRlKFwiaGlkZGVuXCIsIFwiXCIpO1xuXG5cdFx0JC5maXJlKHRoaXMuaW5wdXQsIFwiYXdlc29tcGxldGUtY2xvc2VcIiwgbyB8fCB7fSk7XG5cdH0sXG5cblx0b3BlbjogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudWwucmVtb3ZlQXR0cmlidXRlKFwiaGlkZGVuXCIpO1xuXHRcdHRoaXMuaXNPcGVuZWQgPSB0cnVlO1xuICAgICAgICBcblx0XHR0aGlzLnN0YXR1cy5yZW1vdmVBdHRyaWJ1dGUoXCJoaWRkZW5cIik7XG5cblx0XHRpZiAodGhpcy5hdXRvRmlyc3QgJiYgdGhpcy5pbmRleCA9PT0gLTEpIHtcblx0XHRcdHRoaXMuZ290bygwKTtcblx0XHR9XG5cblx0XHQkLmZpcmUodGhpcy5pbnB1dCwgXCJhd2Vzb21wbGV0ZS1vcGVuXCIpO1xuXHR9LFxuXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdC8vcmVtb3ZlIGV2ZW50cyBmcm9tIHRoZSBpbnB1dCBhbmQgaXRzIGZvcm1cblx0XHQkLnVuYmluZCh0aGlzLmlucHV0LCB0aGlzLl9ldmVudHMuaW5wdXQpO1xuXHRcdCQudW5iaW5kKHRoaXMuaW5wdXQuZm9ybSwgdGhpcy5fZXZlbnRzLmZvcm0pO1xuXG5cdFx0aWYgKHRoaXMuaW5wdXQucGFyZW50Tm9kZSA9PT0gdGhpcy5jb250YWluZXIpIHtcblx0XHRcdC8vbW92ZSB0aGUgaW5wdXQgb3V0IG9mIHRoZSBhd2Vzb21wbGV0ZSBjb250YWluZXIgYW5kIHJlbW92ZSB0aGUgY29udGFpbmVyIGFuZCBpdHMgY2hpbGRyZW5cblx0XHRcdHZhciBwYXJlbnROb2RlID0gdGhpcy5jb250YWluZXIucGFyZW50Tm9kZTtcblxuXHRcdFx0cGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGhpcy5pbnB1dCwgdGhpcy5jb250YWluZXIpO1xuXHRcdFx0cGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmNvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0Ly9yZW1vdmUgYXV0b2NvbXBsZXRlIGFuZCBhcmlhLWF1dG9jb21wbGV0ZSBhdHRyaWJ1dGVzXG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJhdXRvY29tcGxldGVcIik7XG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJhcmlhLWF1dG9jb21wbGV0ZVwiKTtcblxuXHRcdC8vcmVtb3ZlIHRoaXMgYXdlc29tZXBsZXRlIGluc3RhbmNlIGZyb20gdGhlIGdsb2JhbCBhcnJheSBvZiBpbnN0YW5jZXNcblx0XHR2YXIgaW5kZXhPZkF3ZXNvbXBsZXRlID0gXy5hbGwuaW5kZXhPZih0aGlzKTtcblxuXHRcdGlmIChpbmRleE9mQXdlc29tcGxldGUgIT09IC0xKSB7XG5cdFx0XHRfLmFsbC5zcGxpY2UoaW5kZXhPZkF3ZXNvbXBsZXRlLCAxKTtcblx0XHR9XG5cdH0sXG5cblx0bmV4dDogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBjb3VudCA9IHRoaXMudWwuY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdHRoaXMuZ290byh0aGlzLmluZGV4IDwgY291bnQgLSAxID8gdGhpcy5pbmRleCArIDEgOiAoY291bnQgPyAwIDogLTEpICk7XG5cdH0sXG5cblx0cHJldmlvdXM6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgY291bnQgPSB0aGlzLnVsLmNoaWxkcmVuLmxlbmd0aDtcblx0XHR2YXIgcG9zID0gdGhpcy5pbmRleCAtIDE7XG5cblx0XHR0aGlzLmdvdG8odGhpcy5zZWxlY3RlZCAmJiBwb3MgIT09IC0xID8gcG9zIDogY291bnQgLSAxKTtcblx0fSxcblxuXHQvLyBTaG91bGQgbm90IGJlIHVzZWQsIGhpZ2hsaWdodHMgc3BlY2lmaWMgaXRlbSB3aXRob3V0IGFueSBjaGVja3MhXG5cdGdvdG86IGZ1bmN0aW9uIChpKSB7XG5cdFx0dmFyIGxpcyA9IHRoaXMudWwuY2hpbGRyZW47XG5cblx0XHRpZiAodGhpcy5zZWxlY3RlZCkge1xuXHRcdFx0bGlzW3RoaXMuaW5kZXhdLnNldEF0dHJpYnV0ZShcImFyaWEtc2VsZWN0ZWRcIiwgXCJmYWxzZVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLmluZGV4ID0gaTtcblxuXHRcdGlmIChpID4gLTEgJiYgbGlzLmxlbmd0aCA+IDApIHtcblx0XHRcdGxpc1tpXS5zZXRBdHRyaWJ1dGUoXCJhcmlhLXNlbGVjdGVkXCIsIFwidHJ1ZVwiKTtcbiAgICAgICAgICAgIFxuXHRcdFx0dGhpcy5zdGF0dXMudGV4dENvbnRlbnQgPSBsaXNbaV0udGV4dENvbnRlbnQgKyBcIiwgbGlzdCBpdGVtIFwiICsgKGkgKyAxKSArIFwiIG9mIFwiICsgbGlzLmxlbmd0aDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoXCJhcmlhLWFjdGl2ZWRlc2NlbmRhbnRcIiwgdGhpcy51bC5pZCArIFwiX2l0ZW1fXCIgKyB0aGlzLmluZGV4KTtcblxuXHRcdFx0Ly8gc2Nyb2xsIHRvIGhpZ2hsaWdodGVkIGVsZW1lbnQgaW4gY2FzZSBwYXJlbnQncyBoZWlnaHQgaXMgZml4ZWRcblx0XHRcdHRoaXMudWwuc2Nyb2xsVG9wID0gbGlzW2ldLm9mZnNldFRvcCAtIHRoaXMudWwuY2xpZW50SGVpZ2h0ICsgbGlzW2ldLmNsaWVudEhlaWdodDtcblxuXHRcdFx0JC5maXJlKHRoaXMuaW5wdXQsIFwiYXdlc29tcGxldGUtaGlnaGxpZ2h0XCIsIHtcblx0XHRcdFx0dGV4dDogdGhpcy5zdWdnZXN0aW9uc1t0aGlzLmluZGV4XVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9LFxuXG5cdHNlbGVjdDogZnVuY3Rpb24gKHNlbGVjdGVkLCBvcmlnaW4pIHtcblx0XHRpZiAoc2VsZWN0ZWQpIHtcblx0XHRcdHRoaXMuaW5kZXggPSAkLnNpYmxpbmdJbmRleChzZWxlY3RlZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlbGVjdGVkID0gdGhpcy51bC5jaGlsZHJlblt0aGlzLmluZGV4XTtcblx0XHR9XG5cblx0XHRpZiAoc2VsZWN0ZWQpIHtcblx0XHRcdHZhciBzdWdnZXN0aW9uID0gdGhpcy5zdWdnZXN0aW9uc1t0aGlzLmluZGV4XTtcblxuXHRcdFx0dmFyIGFsbG93ZWQgPSAkLmZpcmUodGhpcy5pbnB1dCwgXCJhd2Vzb21wbGV0ZS1zZWxlY3RcIiwge1xuXHRcdFx0XHR0ZXh0OiBzdWdnZXN0aW9uLFxuXHRcdFx0XHRvcmlnaW46IG9yaWdpbiB8fCBzZWxlY3RlZFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChhbGxvd2VkKSB7XG5cdFx0XHRcdHRoaXMucmVwbGFjZShzdWdnZXN0aW9uKTtcblx0XHRcdFx0dGhpcy5jbG9zZSh7IHJlYXNvbjogXCJzZWxlY3RcIiB9KTtcblx0XHRcdFx0JC5maXJlKHRoaXMuaW5wdXQsIFwiYXdlc29tcGxldGUtc2VsZWN0Y29tcGxldGVcIiwge1xuXHRcdFx0XHRcdHRleHQ6IHN1Z2dlc3Rpb25cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdGV2YWx1YXRlOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgbWUgPSB0aGlzO1xuXHRcdHZhciB2YWx1ZSA9IHRoaXMuaW5wdXQudmFsdWU7XG5cblx0XHRpZiAodmFsdWUubGVuZ3RoID49IHRoaXMubWluQ2hhcnMgJiYgdGhpcy5fbGlzdCAmJiB0aGlzLl9saXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuaW5kZXggPSAtMTtcblx0XHRcdC8vIFBvcHVsYXRlIGxpc3Qgd2l0aCBvcHRpb25zIHRoYXQgbWF0Y2hcblx0XHRcdHRoaXMudWwuaW5uZXJIVE1MID0gXCJcIjtcblxuXHRcdFx0dGhpcy5zdWdnZXN0aW9ucyA9IHRoaXMuX2xpc3Rcblx0XHRcdFx0Lm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBTdWdnZXN0aW9uKG1lLmRhdGEoaXRlbSwgdmFsdWUpKTtcblx0XHRcdFx0fSlcblx0XHRcdFx0LmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG1lLmZpbHRlcihpdGVtLCB2YWx1ZSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy5zb3J0ICE9PSBmYWxzZSkge1xuXHRcdFx0XHR0aGlzLnN1Z2dlc3Rpb25zID0gdGhpcy5zdWdnZXN0aW9ucy5zb3J0KHRoaXMuc29ydCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc3VnZ2VzdGlvbnMgPSB0aGlzLnN1Z2dlc3Rpb25zLnNsaWNlKDAsIHRoaXMubWF4SXRlbXMpO1xuXG5cdFx0XHR0aGlzLnN1Z2dlc3Rpb25zLmZvckVhY2goZnVuY3Rpb24odGV4dCwgaW5kZXgpIHtcblx0XHRcdFx0XHRtZS51bC5hcHBlbmRDaGlsZChtZS5pdGVtKHRleHQsIHZhbHVlLCBpbmRleCkpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0aWYgKHRoaXMudWwuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMudGV4dENvbnRlbnQgPSBcIk5vIHJlc3VsdHMgZm91bmRcIjtcbiAgICAgICAgICAgICAgICBcblx0XHRcdFx0dGhpcy5jbG9zZSh7IHJlYXNvbjogXCJub21hdGNoZXNcIiB9KTtcbiAgICAgICAgXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm9wZW4oKTtcbiAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMudGV4dENvbnRlbnQgPSB0aGlzLnVsLmNoaWxkcmVuLmxlbmd0aCArIFwiIHJlc3VsdHMgZm91bmRcIjtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmNsb3NlKHsgcmVhc29uOiBcIm5vbWF0Y2hlc1wiIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMudGV4dENvbnRlbnQgPSBcIk5vIHJlc3VsdHMgZm91bmRcIjtcblx0XHR9XG5cdH1cbn07XG5cbi8vIFN0YXRpYyBtZXRob2RzL3Byb3BlcnRpZXNcblxuXy5hbGwgPSBbXTtcblxuXy5GSUxURVJfQ09OVEFJTlMgPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0cmV0dXJuIFJlZ0V4cCgkLnJlZ0V4cEVzY2FwZShpbnB1dC50cmltKCkpLCBcImlcIikudGVzdCh0ZXh0KTtcbn07XG5cbl8uRklMVEVSX1NUQVJUU1dJVEggPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0cmV0dXJuIFJlZ0V4cChcIl5cIiArICQucmVnRXhwRXNjYXBlKGlucHV0LnRyaW0oKSksIFwiaVwiKS50ZXN0KHRleHQpO1xufTtcblxuXy5TT1JUX0JZTEVOR1RIID0gZnVuY3Rpb24gKGEsIGIpIHtcblx0aWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuXHRcdHJldHVybiBhLmxlbmd0aCAtIGIubGVuZ3RoO1xuXHR9XG5cblx0cmV0dXJuIGEgPCBiPyAtMSA6IDE7XG59O1xuXG5fLkNPTlRBSU5FUiA9IGZ1bmN0aW9uIChpbnB1dCkge1xuXHRyZXR1cm4gJC5jcmVhdGUoXCJkaXZcIiwge1xuXHRcdGNsYXNzTmFtZTogXCJhd2Vzb21wbGV0ZVwiLFxuXHRcdGFyb3VuZDogaW5wdXRcblx0fSk7XG59XG5cbl8uSVRFTSA9IGZ1bmN0aW9uICh0ZXh0LCBpbnB1dCwgaXRlbV9pZCkge1xuXHR2YXIgaHRtbCA9IGlucHV0LnRyaW0oKSA9PT0gXCJcIiA/IHRleHQgOiB0ZXh0LnJlcGxhY2UoUmVnRXhwKCQucmVnRXhwRXNjYXBlKGlucHV0LnRyaW0oKSksIFwiZ2lcIiksIFwiPG1hcms+JCY8L21hcms+XCIpO1xuXHRyZXR1cm4gJC5jcmVhdGUoXCJsaVwiLCB7XG5cdFx0aW5uZXJIVE1MOiBodG1sLFxuXHRcdFwiYXJpYS1zZWxlY3RlZFwiOiBcImZhbHNlXCIsXG4gICAgICAgIFwiaWRcIjogXCJhd2Vzb21wbGV0ZV9saXN0X1wiICsgdGhpcy5jb3VudCArIFwiX2l0ZW1fXCIgKyBpdGVtX2lkXG5cdH0pO1xufTtcblxuXy5SRVBMQUNFID0gZnVuY3Rpb24gKHRleHQpIHtcblx0dGhpcy5pbnB1dC52YWx1ZSA9IHRleHQudmFsdWU7XG59O1xuXG5fLkRBVEEgPSBmdW5jdGlvbiAoaXRlbS8qLCBpbnB1dCovKSB7IHJldHVybiBpdGVtOyB9O1xuXG4vLyBQcml2YXRlIGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBTdWdnZXN0aW9uKGRhdGEpIHtcblx0dmFyIG8gPSBBcnJheS5pc0FycmF5KGRhdGEpXG5cdCAgPyB7IGxhYmVsOiBkYXRhWzBdLCB2YWx1ZTogZGF0YVsxXSB9XG5cdCAgOiB0eXBlb2YgZGF0YSA9PT0gXCJvYmplY3RcIiAmJiBcImxhYmVsXCIgaW4gZGF0YSAmJiBcInZhbHVlXCIgaW4gZGF0YSA/IGRhdGEgOiB7IGxhYmVsOiBkYXRhLCB2YWx1ZTogZGF0YSB9O1xuXG5cdHRoaXMubGFiZWwgPSBvLmxhYmVsIHx8IG8udmFsdWU7XG5cdHRoaXMudmFsdWUgPSBvLnZhbHVlO1xufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFN1Z2dlc3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdHJpbmcucHJvdG90eXBlKSwgXCJsZW5ndGhcIiwge1xuXHRnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5sYWJlbC5sZW5ndGg7IH1cbn0pO1xuU3VnZ2VzdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPSBTdWdnZXN0aW9uLnByb3RvdHlwZS52YWx1ZU9mID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gXCJcIiArIHRoaXMubGFiZWw7XG59O1xuXG5mdW5jdGlvbiBjb25maWd1cmUoaW5zdGFuY2UsIHByb3BlcnRpZXMsIG8pIHtcblx0Zm9yICh2YXIgaSBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0dmFyIGluaXRpYWwgPSBwcm9wZXJ0aWVzW2ldLFxuXHRcdCAgICBhdHRyVmFsdWUgPSBpbnN0YW5jZS5pbnB1dC5nZXRBdHRyaWJ1dGUoXCJkYXRhLVwiICsgaS50b0xvd2VyQ2FzZSgpKTtcblxuXHRcdGlmICh0eXBlb2YgaW5pdGlhbCA9PT0gXCJudW1iZXJcIikge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSBwYXJzZUludChhdHRyVmFsdWUpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChpbml0aWFsID09PSBmYWxzZSkgeyAvLyBCb29sZWFuIG9wdGlvbnMgbXVzdCBiZSBmYWxzZSBieSBkZWZhdWx0IGFueXdheVxuXHRcdFx0aW5zdGFuY2VbaV0gPSBhdHRyVmFsdWUgIT09IG51bGw7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGluaXRpYWwgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSBudWxsO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGluc3RhbmNlW2ldID0gYXR0clZhbHVlO1xuXHRcdH1cblxuXHRcdGlmICghaW5zdGFuY2VbaV0gJiYgaW5zdGFuY2VbaV0gIT09IDApIHtcblx0XHRcdGluc3RhbmNlW2ldID0gKGkgaW4gbyk/IG9baV0gOiBpbml0aWFsO1xuXHRcdH1cblx0fVxufVxuXG4vLyBIZWxwZXJzXG5cbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuZnVuY3Rpb24gJChleHByLCBjb24pIHtcblx0cmV0dXJuIHR5cGVvZiBleHByID09PSBcInN0cmluZ1wiPyAoY29uIHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yKGV4cHIpIDogZXhwciB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiAkJChleHByLCBjb24pIHtcblx0cmV0dXJuIHNsaWNlLmNhbGwoKGNvbiB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChleHByKSk7XG59XG5cbiQuY3JlYXRlID0gZnVuY3Rpb24odGFnLCBvKSB7XG5cdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXG5cdGZvciAodmFyIGkgaW4gbykge1xuXHRcdHZhciB2YWwgPSBvW2ldO1xuXG5cdFx0aWYgKGkgPT09IFwiaW5zaWRlXCIpIHtcblx0XHRcdCQodmFsKS5hcHBlbmRDaGlsZChlbGVtZW50KTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoaSA9PT0gXCJhcm91bmRcIikge1xuXHRcdFx0dmFyIHJlZiA9ICQodmFsKTtcblx0XHRcdHJlZi5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlbGVtZW50LCByZWYpO1xuXHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChyZWYpO1xuXHRcdFx0XG5cdFx0XHRpZiAocmVmLmdldEF0dHJpYnV0ZShcImF1dG9mb2N1c1wiKSAhPSBudWxsKSB7XG5cdFx0XHRcdHJlZi5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGlmIChpIGluIGVsZW1lbnQpIHtcblx0XHRcdGVsZW1lbnRbaV0gPSB2YWw7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoaSwgdmFsKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbiQuYmluZCA9IGZ1bmN0aW9uKGVsZW1lbnQsIG8pIHtcblx0aWYgKGVsZW1lbnQpIHtcblx0XHRmb3IgKHZhciBldmVudCBpbiBvKSB7XG5cdFx0XHR2YXIgY2FsbGJhY2sgPSBvW2V2ZW50XTtcblxuXHRcdFx0ZXZlbnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGNhbGxiYWNrKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufTtcblxuJC51bmJpbmQgPSBmdW5jdGlvbihlbGVtZW50LCBvKSB7XG5cdGlmIChlbGVtZW50KSB7XG5cdFx0Zm9yICh2YXIgZXZlbnQgaW4gbykge1xuXHRcdFx0dmFyIGNhbGxiYWNrID0gb1tldmVudF07XG5cblx0XHRcdGV2ZW50LnNwbGl0KC9cXHMrLykuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGNhbGxiYWNrKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufTtcblxuJC5maXJlID0gZnVuY3Rpb24odGFyZ2V0LCB0eXBlLCBwcm9wZXJ0aWVzKSB7XG5cdHZhciBldnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudChcIkhUTUxFdmVudHNcIik7XG5cblx0ZXZ0LmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlICk7XG5cblx0Zm9yICh2YXIgaiBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0ZXZ0W2pdID0gcHJvcGVydGllc1tqXTtcblx0fVxuXG5cdHJldHVybiB0YXJnZXQuZGlzcGF0Y2hFdmVudChldnQpO1xufTtcblxuJC5yZWdFeHBFc2NhcGUgPSBmdW5jdGlvbiAocykge1xuXHRyZXR1cm4gcy5yZXBsYWNlKC9bLVxcXFxeJCorPy4oKXxbXFxde31dL2csIFwiXFxcXCQmXCIpO1xufTtcblxuJC5zaWJsaW5nSW5kZXggPSBmdW5jdGlvbiAoZWwpIHtcblx0LyogZXNsaW50LWRpc2FibGUgbm8tY29uZC1hc3NpZ24gKi9cblx0Zm9yICh2YXIgaSA9IDA7IGVsID0gZWwucHJldmlvdXNFbGVtZW50U2libGluZzsgaSsrKTtcblx0cmV0dXJuIGk7XG59O1xuXG4vLyBJbml0aWFsaXphdGlvblxuXG5mdW5jdGlvbiBpbml0KCkge1xuXHQkJChcImlucHV0LmF3ZXNvbXBsZXRlXCIpLmZvckVhY2goZnVuY3Rpb24gKGlucHV0KSB7XG5cdFx0bmV3IF8oaW5wdXQpO1xuXHR9KTtcbn1cblxuLy8gTWFrZSBzdXJlIHRvIGV4cG9ydCBBd2Vzb21wbGV0ZSBvbiBzZWxmIHdoZW4gaW4gYSBicm93c2VyXG5pZiAodHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0c2VsZi5Bd2Vzb21wbGV0ZSA9IF87XG59XG5cbi8vIEFyZSB3ZSBpbiBhIGJyb3dzZXI/IENoZWNrIGZvciBEb2N1bWVudCBjb25zdHJ1Y3RvclxuaWYgKHR5cGVvZiBEb2N1bWVudCAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHQvLyBET00gYWxyZWFkeSBsb2FkZWQ/XG5cdGlmIChkb2N1bWVudC5yZWFkeVN0YXRlICE9PSBcImxvYWRpbmdcIikge1xuXHRcdGluaXQoKTtcblx0fVxuXHRlbHNlIHtcblx0XHQvLyBXYWl0IGZvciBpdFxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIGluaXQpO1xuXHR9XG59XG5cbl8uJCA9ICQ7XG5fLiQkID0gJCQ7XG5cbi8vIEV4cG9zZSBBd2Vzb21wbGV0ZSBhcyBhIENKUyBtb2R1bGVcbmlmICh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gXztcbn1cblxucmV0dXJuIF87XG5cbn0oKSk7XG4iLCJmdW5jdGlvbiBkZWJvdW5jZShmdW5jdGlvbl8sIHdhaXQgPSAxMDAsIG9wdGlvbnMgPSB7fSkge1xuXHRpZiAodHlwZW9mIGZ1bmN0aW9uXyAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoYEV4cGVjdGVkIHRoZSBmaXJzdCBwYXJhbWV0ZXIgdG8gYmUgYSBmdW5jdGlvbiwgZ290IFxcYCR7dHlwZW9mIGZ1bmN0aW9uX31cXGAuYCk7XG5cdH1cblxuXHRpZiAod2FpdCA8IDApIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcignYHdhaXRgIG11c3Qgbm90IGJlIG5lZ2F0aXZlLicpO1xuXHR9XG5cblx0Ly8gVE9ETzogRGVwcmVjYXRlIHRoZSBib29sZWFuIHBhcmFtZXRlciBhdCBzb21lIHBvaW50LlxuXHRjb25zdCB7aW1tZWRpYXRlfSA9IHR5cGVvZiBvcHRpb25zID09PSAnYm9vbGVhbicgPyB7aW1tZWRpYXRlOiBvcHRpb25zfSA6IG9wdGlvbnM7XG5cblx0bGV0IHN0b3JlZENvbnRleHQ7XG5cdGxldCBzdG9yZWRBcmd1bWVudHM7XG5cdGxldCB0aW1lb3V0SWQ7XG5cdGxldCB0aW1lc3RhbXA7XG5cdGxldCByZXN1bHQ7XG5cblx0ZnVuY3Rpb24gcnVuKCkge1xuXHRcdGNvbnN0IGNhbGxDb250ZXh0ID0gc3RvcmVkQ29udGV4dDtcblx0XHRjb25zdCBjYWxsQXJndW1lbnRzID0gc3RvcmVkQXJndW1lbnRzO1xuXHRcdHN0b3JlZENvbnRleHQgPSB1bmRlZmluZWQ7XG5cdFx0c3RvcmVkQXJndW1lbnRzID0gdW5kZWZpbmVkO1xuXHRcdHJlc3VsdCA9IGZ1bmN0aW9uXy5hcHBseShjYWxsQ29udGV4dCwgY2FsbEFyZ3VtZW50cyk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGxhdGVyKCkge1xuXHRcdGNvbnN0IGxhc3QgPSBEYXRlLm5vdygpIC0gdGltZXN0YW1wO1xuXG5cdFx0aWYgKGxhc3QgPCB3YWl0ICYmIGxhc3QgPj0gMCkge1xuXHRcdFx0dGltZW91dElkID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aW1lb3V0SWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdGlmICghaW1tZWRpYXRlKSB7XG5cdFx0XHRcdHJlc3VsdCA9IHJ1bigpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGRlYm91bmNlZCA9IGZ1bmN0aW9uICguLi5hcmd1bWVudHNfKSB7XG5cdFx0aWYgKFxuXHRcdFx0c3RvcmVkQ29udGV4dFxuXHRcdFx0JiYgdGhpcyAhPT0gc3RvcmVkQ29udGV4dFxuXHRcdFx0JiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHRoaXMpID09PSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yoc3RvcmVkQ29udGV4dClcblx0XHQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRGVib3VuY2VkIG1ldGhvZCBjYWxsZWQgd2l0aCBkaWZmZXJlbnQgY29udGV4dHMgb2YgdGhlIHNhbWUgcHJvdG90eXBlLicpO1xuXHRcdH1cblxuXHRcdHN0b3JlZENvbnRleHQgPSB0aGlzOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHVuaWNvcm4vbm8tdGhpcy1hc3NpZ25tZW50XG5cdFx0c3RvcmVkQXJndW1lbnRzID0gYXJndW1lbnRzXztcblx0XHR0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXG5cdFx0Y29uc3QgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dElkO1xuXG5cdFx0aWYgKCF0aW1lb3V0SWQpIHtcblx0XHRcdHRpbWVvdXRJZCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuXHRcdH1cblxuXHRcdGlmIChjYWxsTm93KSB7XG5cdFx0XHRyZXN1bHQgPSBydW4oKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9O1xuXG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkZWJvdW5jZWQsICdpc1BlbmRpbmcnLCB7XG5cdFx0Z2V0KCkge1xuXHRcdFx0cmV0dXJuIHRpbWVvdXRJZCAhPT0gdW5kZWZpbmVkO1xuXHRcdH0sXG5cdH0pO1xuXG5cdGRlYm91bmNlZC5jbGVhciA9ICgpID0+IHtcblx0XHRpZiAoIXRpbWVvdXRJZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXHRcdHRpbWVvdXRJZCA9IHVuZGVmaW5lZDtcblx0fTtcblxuXHRkZWJvdW5jZWQuZmx1c2ggPSAoKSA9PiB7XG5cdFx0aWYgKCF0aW1lb3V0SWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRkZWJvdW5jZWQudHJpZ2dlcigpO1xuXHR9O1xuXG5cdGRlYm91bmNlZC50cmlnZ2VyID0gKCkgPT4ge1xuXHRcdHJlc3VsdCA9IHJ1bigpO1xuXG5cdFx0ZGVib3VuY2VkLmNsZWFyKCk7XG5cdH07XG5cblx0cmV0dXJuIGRlYm91bmNlZDtcbn1cblxuLy8gQWRkcyBjb21wYXRpYmlsaXR5IGZvciBFUyBtb2R1bGVzXG5tb2R1bGUuZXhwb3J0cy5kZWJvdW5jZSA9IGRlYm91bmNlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlYm91bmNlO1xuIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbi8qKlxuICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuICovXG5cbmV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5leHBvcnRzLnNhdmUgPSBzYXZlO1xuZXhwb3J0cy5sb2FkID0gbG9hZDtcbmV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuZXhwb3J0cy5zdG9yYWdlID0gbG9jYWxzdG9yYWdlKCk7XG5leHBvcnRzLmRlc3Ryb3kgPSAoKCkgPT4ge1xuXHRsZXQgd2FybmVkID0gZmFsc2U7XG5cblx0cmV0dXJuICgpID0+IHtcblx0XHRpZiAoIXdhcm5lZCkge1xuXHRcdFx0d2FybmVkID0gdHJ1ZTtcblx0XHRcdGNvbnNvbGUud2FybignSW5zdGFuY2UgbWV0aG9kIGBkZWJ1Zy5kZXN0cm95KClgIGlzIGRlcHJlY2F0ZWQgYW5kIG5vIGxvbmdlciBkb2VzIGFueXRoaW5nLiBJdCB3aWxsIGJlIHJlbW92ZWQgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbiBvZiBgZGVidWdgLicpO1xuXHRcdH1cblx0fTtcbn0pKCk7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuXHQnIzAwMDBDQycsXG5cdCcjMDAwMEZGJyxcblx0JyMwMDMzQ0MnLFxuXHQnIzAwMzNGRicsXG5cdCcjMDA2NkNDJyxcblx0JyMwMDY2RkYnLFxuXHQnIzAwOTlDQycsXG5cdCcjMDA5OUZGJyxcblx0JyMwMENDMDAnLFxuXHQnIzAwQ0MzMycsXG5cdCcjMDBDQzY2Jyxcblx0JyMwMENDOTknLFxuXHQnIzAwQ0NDQycsXG5cdCcjMDBDQ0ZGJyxcblx0JyMzMzAwQ0MnLFxuXHQnIzMzMDBGRicsXG5cdCcjMzMzM0NDJyxcblx0JyMzMzMzRkYnLFxuXHQnIzMzNjZDQycsXG5cdCcjMzM2NkZGJyxcblx0JyMzMzk5Q0MnLFxuXHQnIzMzOTlGRicsXG5cdCcjMzNDQzAwJyxcblx0JyMzM0NDMzMnLFxuXHQnIzMzQ0M2NicsXG5cdCcjMzNDQzk5Jyxcblx0JyMzM0NDQ0MnLFxuXHQnIzMzQ0NGRicsXG5cdCcjNjYwMENDJyxcblx0JyM2NjAwRkYnLFxuXHQnIzY2MzNDQycsXG5cdCcjNjYzM0ZGJyxcblx0JyM2NkNDMDAnLFxuXHQnIzY2Q0MzMycsXG5cdCcjOTkwMENDJyxcblx0JyM5OTAwRkYnLFxuXHQnIzk5MzNDQycsXG5cdCcjOTkzM0ZGJyxcblx0JyM5OUNDMDAnLFxuXHQnIzk5Q0MzMycsXG5cdCcjQ0MwMDAwJyxcblx0JyNDQzAwMzMnLFxuXHQnI0NDMDA2NicsXG5cdCcjQ0MwMDk5Jyxcblx0JyNDQzAwQ0MnLFxuXHQnI0NDMDBGRicsXG5cdCcjQ0MzMzAwJyxcblx0JyNDQzMzMzMnLFxuXHQnI0NDMzM2NicsXG5cdCcjQ0MzMzk5Jyxcblx0JyNDQzMzQ0MnLFxuXHQnI0NDMzNGRicsXG5cdCcjQ0M2NjAwJyxcblx0JyNDQzY2MzMnLFxuXHQnI0NDOTkwMCcsXG5cdCcjQ0M5OTMzJyxcblx0JyNDQ0NDMDAnLFxuXHQnI0NDQ0MzMycsXG5cdCcjRkYwMDAwJyxcblx0JyNGRjAwMzMnLFxuXHQnI0ZGMDA2NicsXG5cdCcjRkYwMDk5Jyxcblx0JyNGRjAwQ0MnLFxuXHQnI0ZGMDBGRicsXG5cdCcjRkYzMzAwJyxcblx0JyNGRjMzMzMnLFxuXHQnI0ZGMzM2NicsXG5cdCcjRkYzMzk5Jyxcblx0JyNGRjMzQ0MnLFxuXHQnI0ZGMzNGRicsXG5cdCcjRkY2NjAwJyxcblx0JyNGRjY2MzMnLFxuXHQnI0ZGOTkwMCcsXG5cdCcjRkY5OTMzJyxcblx0JyNGRkNDMDAnLFxuXHQnI0ZGQ0MzMydcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGNvbXBsZXhpdHlcbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcblx0Ly8gTkI6IEluIGFuIEVsZWN0cm9uIHByZWxvYWQgc2NyaXB0LCBkb2N1bWVudCB3aWxsIGJlIGRlZmluZWQgYnV0IG5vdCBmdWxseVxuXHQvLyBpbml0aWFsaXplZC4gU2luY2Ugd2Uga25vdyB3ZSdyZSBpbiBDaHJvbWUsIHdlJ2xsIGp1c3QgZGV0ZWN0IHRoaXMgY2FzZVxuXHQvLyBleHBsaWNpdGx5XG5cdGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucHJvY2VzcyAmJiAod2luZG93LnByb2Nlc3MudHlwZSA9PT0gJ3JlbmRlcmVyJyB8fCB3aW5kb3cucHJvY2Vzcy5fX253anMpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvLyBJbnRlcm5ldCBFeHBsb3JlciBhbmQgRWRnZSBkbyBub3Qgc3VwcG9ydCBjb2xvcnMuXG5cdGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvKGVkZ2V8dHJpZGVudClcXC8oXFxkKykvKSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGxldCBtO1xuXG5cdC8vIElzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG5cdC8vIGRvY3VtZW50IGlzIHVuZGVmaW5lZCBpbiByZWFjdC1uYXRpdmU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC1uYXRpdmUvcHVsbC8xNjMyXG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXR1cm4tYXNzaWduXG5cdHJldHVybiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5XZWJraXRBcHBlYXJhbmNlKSB8fFxuXHRcdC8vIElzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcblx0XHQodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmNvbnNvbGUgJiYgKHdpbmRvdy5jb25zb2xlLmZpcmVidWcgfHwgKHdpbmRvdy5jb25zb2xlLmV4Y2VwdGlvbiAmJiB3aW5kb3cuY29uc29sZS50YWJsZSkpKSB8fFxuXHRcdC8vIElzIGZpcmVmb3ggPj0gdjMxP1xuXHRcdC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuXHRcdCh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIChtID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykpICYmIHBhcnNlSW50KG1bMV0sIDEwKSA+PSAzMSkgfHxcblx0XHQvLyBEb3VibGUgY2hlY2sgd2Via2l0IGluIHVzZXJBZ2VudCBqdXN0IGluIGNhc2Ugd2UgYXJlIGluIGEgd29ya2VyXG5cdFx0KHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pKTtcbn1cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKGFyZ3MpIHtcblx0YXJnc1swXSA9ICh0aGlzLnVzZUNvbG9ycyA/ICclYycgOiAnJykgK1xuXHRcdHRoaXMubmFtZXNwYWNlICtcblx0XHQodGhpcy51c2VDb2xvcnMgPyAnICVjJyA6ICcgJykgK1xuXHRcdGFyZ3NbMF0gK1xuXHRcdCh0aGlzLnVzZUNvbG9ycyA/ICclYyAnIDogJyAnKSArXG5cdFx0JysnICsgbW9kdWxlLmV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuXHRpZiAoIXRoaXMudXNlQ29sb3JzKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG5cdGFyZ3Muc3BsaWNlKDEsIDAsIGMsICdjb2xvcjogaW5oZXJpdCcpO1xuXG5cdC8vIFRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG5cdC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cblx0Ly8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG5cdGxldCBpbmRleCA9IDA7XG5cdGxldCBsYXN0QyA9IDA7XG5cdGFyZ3NbMF0ucmVwbGFjZSgvJVthLXpBLVolXS9nLCBtYXRjaCA9PiB7XG5cdFx0aWYgKG1hdGNoID09PSAnJSUnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGluZGV4Kys7XG5cdFx0aWYgKG1hdGNoID09PSAnJWMnKSB7XG5cdFx0XHQvLyBXZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcblx0XHRcdC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG5cdFx0XHRsYXN0QyA9IGluZGV4O1xuXHRcdH1cblx0fSk7XG5cblx0YXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUuZGVidWcoKWAgd2hlbiBhdmFpbGFibGUuXG4gKiBOby1vcCB3aGVuIGBjb25zb2xlLmRlYnVnYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKiBJZiBgY29uc29sZS5kZWJ1Z2AgaXMgbm90IGF2YWlsYWJsZSwgZmFsbHMgYmFja1xuICogdG8gYGNvbnNvbGUubG9nYC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5leHBvcnRzLmxvZyA9IGNvbnNvbGUuZGVidWcgfHwgY29uc29sZS5sb2cgfHwgKCgpID0+IHt9KTtcblxuLyoqXG4gKiBTYXZlIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuXHR0cnkge1xuXHRcdGlmIChuYW1lc3BhY2VzKSB7XG5cdFx0XHRleHBvcnRzLnN0b3JhZ2Uuc2V0SXRlbSgnZGVidWcnLCBuYW1lc3BhY2VzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZXhwb3J0cy5zdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG5cdFx0fVxuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdC8vIFN3YWxsb3dcblx0XHQvLyBYWFggKEBRaXgtKSBzaG91bGQgd2UgYmUgbG9nZ2luZyB0aGVzZT9cblx0fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBsb2FkKCkge1xuXHRsZXQgcjtcblx0dHJ5IHtcblx0XHRyID0gZXhwb3J0cy5zdG9yYWdlLmdldEl0ZW0oJ2RlYnVnJyk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0Ly8gU3dhbGxvd1xuXHRcdC8vIFhYWCAoQFFpeC0pIHNob3VsZCB3ZSBiZSBsb2dnaW5nIHRoZXNlP1xuXHR9XG5cblx0Ly8gSWYgZGVidWcgaXNuJ3Qgc2V0IGluIExTLCBhbmQgd2UncmUgaW4gRWxlY3Ryb24sIHRyeSB0byBsb2FkICRERUJVR1xuXHRpZiAoIXIgJiYgdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmICdlbnYnIGluIHByb2Nlc3MpIHtcblx0XHRyID0gcHJvY2Vzcy5lbnYuREVCVUc7XG5cdH1cblxuXHRyZXR1cm4gcjtcbn1cblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKSB7XG5cdHRyeSB7XG5cdFx0Ly8gVFZNTEtpdCAoQXBwbGUgVFYgSlMgUnVudGltZSkgZG9lcyBub3QgaGF2ZSBhIHdpbmRvdyBvYmplY3QsIGp1c3QgbG9jYWxTdG9yYWdlIGluIHRoZSBnbG9iYWwgY29udGV4dFxuXHRcdC8vIFRoZSBCcm93c2VyIGFsc28gaGFzIGxvY2FsU3RvcmFnZSBpbiB0aGUgZ2xvYmFsIGNvbnRleHQuXG5cdFx0cmV0dXJuIGxvY2FsU3RvcmFnZTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHQvLyBTd2FsbG93XG5cdFx0Ly8gWFhYIChAUWl4LSkgc2hvdWxkIHdlIGJlIGxvZ2dpbmcgdGhlc2U/XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2NvbW1vbicpKGV4cG9ydHMpO1xuXG5jb25zdCB7Zm9ybWF0dGVyc30gPSBtb2R1bGUuZXhwb3J0cztcblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24gKHYpIHtcblx0dHJ5IHtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0cmV0dXJuICdbVW5leHBlY3RlZEpTT05QYXJzZUVycm9yXTogJyArIGVycm9yLm1lc3NhZ2U7XG5cdH1cbn07XG4iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgY29tbW9uIGxvZ2ljIGZvciBib3RoIHRoZSBOb2RlLmpzIGFuZCB3ZWIgYnJvd3NlclxuICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cbiAqL1xuXG5mdW5jdGlvbiBzZXR1cChlbnYpIHtcblx0Y3JlYXRlRGVidWcuZGVidWcgPSBjcmVhdGVEZWJ1Zztcblx0Y3JlYXRlRGVidWcuZGVmYXVsdCA9IGNyZWF0ZURlYnVnO1xuXHRjcmVhdGVEZWJ1Zy5jb2VyY2UgPSBjb2VyY2U7XG5cdGNyZWF0ZURlYnVnLmRpc2FibGUgPSBkaXNhYmxlO1xuXHRjcmVhdGVEZWJ1Zy5lbmFibGUgPSBlbmFibGU7XG5cdGNyZWF0ZURlYnVnLmVuYWJsZWQgPSBlbmFibGVkO1xuXHRjcmVhdGVEZWJ1Zy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cdGNyZWF0ZURlYnVnLmRlc3Ryb3kgPSBkZXN0cm95O1xuXG5cdE9iamVjdC5rZXlzKGVudikuZm9yRWFjaChrZXkgPT4ge1xuXHRcdGNyZWF0ZURlYnVnW2tleV0gPSBlbnZba2V5XTtcblx0fSk7XG5cblx0LyoqXG5cdCogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG5cdCovXG5cblx0Y3JlYXRlRGVidWcubmFtZXMgPSBbXTtcblx0Y3JlYXRlRGVidWcuc2tpcHMgPSBbXTtcblxuXHQvKipcblx0KiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG5cdCpcblx0KiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlciBvciB1cHBlci1jYXNlIGxldHRlciwgaS5lLiBcIm5cIiBhbmQgXCJOXCIuXG5cdCovXG5cdGNyZWF0ZURlYnVnLmZvcm1hdHRlcnMgPSB7fTtcblxuXHQvKipcblx0KiBTZWxlY3RzIGEgY29sb3IgZm9yIGEgZGVidWcgbmFtZXNwYWNlXG5cdCogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZSBUaGUgbmFtZXNwYWNlIHN0cmluZyBmb3IgdGhlIGRlYnVnIGluc3RhbmNlIHRvIGJlIGNvbG9yZWRcblx0KiBAcmV0dXJuIHtOdW1iZXJ8U3RyaW5nfSBBbiBBTlNJIGNvbG9yIGNvZGUgZm9yIHRoZSBnaXZlbiBuYW1lc3BhY2Vcblx0KiBAYXBpIHByaXZhdGVcblx0Ki9cblx0ZnVuY3Rpb24gc2VsZWN0Q29sb3IobmFtZXNwYWNlKSB7XG5cdFx0bGV0IGhhc2ggPSAwO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lc3BhY2UubGVuZ3RoOyBpKyspIHtcblx0XHRcdGhhc2ggPSAoKGhhc2ggPDwgNSkgLSBoYXNoKSArIG5hbWVzcGFjZS5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0aGFzaCB8PSAwOyAvLyBDb252ZXJ0IHRvIDMyYml0IGludGVnZXJcblx0XHR9XG5cblx0XHRyZXR1cm4gY3JlYXRlRGVidWcuY29sb3JzW01hdGguYWJzKGhhc2gpICUgY3JlYXRlRGVidWcuY29sb3JzLmxlbmd0aF07XG5cdH1cblx0Y3JlYXRlRGVidWcuc2VsZWN0Q29sb3IgPSBzZWxlY3RDb2xvcjtcblxuXHQvKipcblx0KiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cblx0KlxuXHQqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2Vcblx0KiBAcmV0dXJuIHtGdW5jdGlvbn1cblx0KiBAYXBpIHB1YmxpY1xuXHQqL1xuXHRmdW5jdGlvbiBjcmVhdGVEZWJ1ZyhuYW1lc3BhY2UpIHtcblx0XHRsZXQgcHJldlRpbWU7XG5cdFx0bGV0IGVuYWJsZU92ZXJyaWRlID0gbnVsbDtcblx0XHRsZXQgbmFtZXNwYWNlc0NhY2hlO1xuXHRcdGxldCBlbmFibGVkQ2FjaGU7XG5cblx0XHRmdW5jdGlvbiBkZWJ1ZyguLi5hcmdzKSB7XG5cdFx0XHQvLyBEaXNhYmxlZD9cblx0XHRcdGlmICghZGVidWcuZW5hYmxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNlbGYgPSBkZWJ1ZztcblxuXHRcdFx0Ly8gU2V0IGBkaWZmYCB0aW1lc3RhbXBcblx0XHRcdGNvbnN0IGN1cnIgPSBOdW1iZXIobmV3IERhdGUoKSk7XG5cdFx0XHRjb25zdCBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG5cdFx0XHRzZWxmLmRpZmYgPSBtcztcblx0XHRcdHNlbGYucHJldiA9IHByZXZUaW1lO1xuXHRcdFx0c2VsZi5jdXJyID0gY3Vycjtcblx0XHRcdHByZXZUaW1lID0gY3VycjtcblxuXHRcdFx0YXJnc1swXSA9IGNyZWF0ZURlYnVnLmNvZXJjZShhcmdzWzBdKTtcblxuXHRcdFx0aWYgKHR5cGVvZiBhcmdzWzBdICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHQvLyBBbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlT1xuXHRcdFx0XHRhcmdzLnVuc2hpZnQoJyVPJyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG5cdFx0XHRsZXQgaW5kZXggPSAwO1xuXHRcdFx0YXJnc1swXSA9IGFyZ3NbMF0ucmVwbGFjZSgvJShbYS16QS1aJV0pL2csIChtYXRjaCwgZm9ybWF0KSA9PiB7XG5cdFx0XHRcdC8vIElmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcblx0XHRcdFx0aWYgKG1hdGNoID09PSAnJSUnKSB7XG5cdFx0XHRcdFx0cmV0dXJuICclJztcblx0XHRcdFx0fVxuXHRcdFx0XHRpbmRleCsrO1xuXHRcdFx0XHRjb25zdCBmb3JtYXR0ZXIgPSBjcmVhdGVEZWJ1Zy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG5cdFx0XHRcdGlmICh0eXBlb2YgZm9ybWF0dGVyID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0Y29uc3QgdmFsID0gYXJnc1tpbmRleF07XG5cdFx0XHRcdFx0bWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG5cdFx0XHRcdFx0Ly8gTm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuXHRcdFx0XHRcdGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0XHRpbmRleC0tO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBtYXRjaDtcblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBBcHBseSBlbnYtc3BlY2lmaWMgZm9ybWF0dGluZyAoY29sb3JzLCBldGMuKVxuXHRcdFx0Y3JlYXRlRGVidWcuZm9ybWF0QXJncy5jYWxsKHNlbGYsIGFyZ3MpO1xuXG5cdFx0XHRjb25zdCBsb2dGbiA9IHNlbGYubG9nIHx8IGNyZWF0ZURlYnVnLmxvZztcblx0XHRcdGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuXHRcdH1cblxuXHRcdGRlYnVnLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblx0XHRkZWJ1Zy51c2VDb2xvcnMgPSBjcmVhdGVEZWJ1Zy51c2VDb2xvcnMoKTtcblx0XHRkZWJ1Zy5jb2xvciA9IGNyZWF0ZURlYnVnLnNlbGVjdENvbG9yKG5hbWVzcGFjZSk7XG5cdFx0ZGVidWcuZXh0ZW5kID0gZXh0ZW5kO1xuXHRcdGRlYnVnLmRlc3Ryb3kgPSBjcmVhdGVEZWJ1Zy5kZXN0cm95OyAvLyBYWFggVGVtcG9yYXJ5LiBXaWxsIGJlIHJlbW92ZWQgaW4gdGhlIG5leHQgbWFqb3IgcmVsZWFzZS5cblxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkZWJ1ZywgJ2VuYWJsZWQnLCB7XG5cdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcblx0XHRcdGdldDogKCkgPT4ge1xuXHRcdFx0XHRpZiAoZW5hYmxlT3ZlcnJpZGUgIT09IG51bGwpIHtcblx0XHRcdFx0XHRyZXR1cm4gZW5hYmxlT3ZlcnJpZGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG5hbWVzcGFjZXNDYWNoZSAhPT0gY3JlYXRlRGVidWcubmFtZXNwYWNlcykge1xuXHRcdFx0XHRcdG5hbWVzcGFjZXNDYWNoZSA9IGNyZWF0ZURlYnVnLm5hbWVzcGFjZXM7XG5cdFx0XHRcdFx0ZW5hYmxlZENhY2hlID0gY3JlYXRlRGVidWcuZW5hYmxlZChuYW1lc3BhY2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGVuYWJsZWRDYWNoZTtcblx0XHRcdH0sXG5cdFx0XHRzZXQ6IHYgPT4ge1xuXHRcdFx0XHRlbmFibGVPdmVycmlkZSA9IHY7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBFbnYtc3BlY2lmaWMgaW5pdGlhbGl6YXRpb24gbG9naWMgZm9yIGRlYnVnIGluc3RhbmNlc1xuXHRcdGlmICh0eXBlb2YgY3JlYXRlRGVidWcuaW5pdCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Y3JlYXRlRGVidWcuaW5pdChkZWJ1Zyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRlYnVnO1xuXHR9XG5cblx0ZnVuY3Rpb24gZXh0ZW5kKG5hbWVzcGFjZSwgZGVsaW1pdGVyKSB7XG5cdFx0Y29uc3QgbmV3RGVidWcgPSBjcmVhdGVEZWJ1Zyh0aGlzLm5hbWVzcGFjZSArICh0eXBlb2YgZGVsaW1pdGVyID09PSAndW5kZWZpbmVkJyA/ICc6JyA6IGRlbGltaXRlcikgKyBuYW1lc3BhY2UpO1xuXHRcdG5ld0RlYnVnLmxvZyA9IHRoaXMubG9nO1xuXHRcdHJldHVybiBuZXdEZWJ1Zztcblx0fVxuXG5cdC8qKlxuXHQqIEVuYWJsZXMgYSBkZWJ1ZyBtb2RlIGJ5IG5hbWVzcGFjZXMuIFRoaXMgY2FuIGluY2x1ZGUgbW9kZXNcblx0KiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuXHQqXG5cdCogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcblx0KiBAYXBpIHB1YmxpY1xuXHQqL1xuXHRmdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuXHRcdGNyZWF0ZURlYnVnLnNhdmUobmFtZXNwYWNlcyk7XG5cdFx0Y3JlYXRlRGVidWcubmFtZXNwYWNlcyA9IG5hbWVzcGFjZXM7XG5cblx0XHRjcmVhdGVEZWJ1Zy5uYW1lcyA9IFtdO1xuXHRcdGNyZWF0ZURlYnVnLnNraXBzID0gW107XG5cblx0XHRjb25zdCBzcGxpdCA9ICh0eXBlb2YgbmFtZXNwYWNlcyA9PT0gJ3N0cmluZycgPyBuYW1lc3BhY2VzIDogJycpXG5cdFx0XHQudHJpbSgpXG5cdFx0XHQucmVwbGFjZSgnICcsICcsJylcblx0XHRcdC5zcGxpdCgnLCcpXG5cdFx0XHQuZmlsdGVyKEJvb2xlYW4pO1xuXG5cdFx0Zm9yIChjb25zdCBucyBvZiBzcGxpdCkge1xuXHRcdFx0aWYgKG5zWzBdID09PSAnLScpIHtcblx0XHRcdFx0Y3JlYXRlRGVidWcuc2tpcHMucHVzaChucy5zbGljZSgxKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjcmVhdGVEZWJ1Zy5uYW1lcy5wdXNoKG5zKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBzdHJpbmcgbWF0Y2hlcyBhIG5hbWVzcGFjZSB0ZW1wbGF0ZSwgaG9ub3Jpbmdcblx0ICogYXN0ZXJpc2tzIGFzIHdpbGRjYXJkcy5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHNlYXJjaFxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdGVtcGxhdGVcblx0ICogQHJldHVybiB7Qm9vbGVhbn1cblx0ICovXG5cdGZ1bmN0aW9uIG1hdGNoZXNUZW1wbGF0ZShzZWFyY2gsIHRlbXBsYXRlKSB7XG5cdFx0bGV0IHNlYXJjaEluZGV4ID0gMDtcblx0XHRsZXQgdGVtcGxhdGVJbmRleCA9IDA7XG5cdFx0bGV0IHN0YXJJbmRleCA9IC0xO1xuXHRcdGxldCBtYXRjaEluZGV4ID0gMDtcblxuXHRcdHdoaWxlIChzZWFyY2hJbmRleCA8IHNlYXJjaC5sZW5ndGgpIHtcblx0XHRcdGlmICh0ZW1wbGF0ZUluZGV4IDwgdGVtcGxhdGUubGVuZ3RoICYmICh0ZW1wbGF0ZVt0ZW1wbGF0ZUluZGV4XSA9PT0gc2VhcmNoW3NlYXJjaEluZGV4XSB8fCB0ZW1wbGF0ZVt0ZW1wbGF0ZUluZGV4XSA9PT0gJyonKSkge1xuXHRcdFx0XHQvLyBNYXRjaCBjaGFyYWN0ZXIgb3IgcHJvY2VlZCB3aXRoIHdpbGRjYXJkXG5cdFx0XHRcdGlmICh0ZW1wbGF0ZVt0ZW1wbGF0ZUluZGV4XSA9PT0gJyonKSB7XG5cdFx0XHRcdFx0c3RhckluZGV4ID0gdGVtcGxhdGVJbmRleDtcblx0XHRcdFx0XHRtYXRjaEluZGV4ID0gc2VhcmNoSW5kZXg7XG5cdFx0XHRcdFx0dGVtcGxhdGVJbmRleCsrOyAvLyBTa2lwIHRoZSAnKidcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZWFyY2hJbmRleCsrO1xuXHRcdFx0XHRcdHRlbXBsYXRlSW5kZXgrKztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChzdGFySW5kZXggIT09IC0xKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmVnYXRlZC1jb25kaXRpb25cblx0XHRcdFx0Ly8gQmFja3RyYWNrIHRvIHRoZSBsYXN0ICcqJyBhbmQgdHJ5IHRvIG1hdGNoIG1vcmUgY2hhcmFjdGVyc1xuXHRcdFx0XHR0ZW1wbGF0ZUluZGV4ID0gc3RhckluZGV4ICsgMTtcblx0XHRcdFx0bWF0Y2hJbmRleCsrO1xuXHRcdFx0XHRzZWFyY2hJbmRleCA9IG1hdGNoSW5kZXg7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIE5vIG1hdGNoXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIHRyYWlsaW5nICcqJyBpbiB0ZW1wbGF0ZVxuXHRcdHdoaWxlICh0ZW1wbGF0ZUluZGV4IDwgdGVtcGxhdGUubGVuZ3RoICYmIHRlbXBsYXRlW3RlbXBsYXRlSW5kZXhdID09PSAnKicpIHtcblx0XHRcdHRlbXBsYXRlSW5kZXgrKztcblx0XHR9XG5cblx0XHRyZXR1cm4gdGVtcGxhdGVJbmRleCA9PT0gdGVtcGxhdGUubGVuZ3RoO1xuXHR9XG5cblx0LyoqXG5cdCogRGlzYWJsZSBkZWJ1ZyBvdXRwdXQuXG5cdCpcblx0KiBAcmV0dXJuIHtTdHJpbmd9IG5hbWVzcGFjZXNcblx0KiBAYXBpIHB1YmxpY1xuXHQqL1xuXHRmdW5jdGlvbiBkaXNhYmxlKCkge1xuXHRcdGNvbnN0IG5hbWVzcGFjZXMgPSBbXG5cdFx0XHQuLi5jcmVhdGVEZWJ1Zy5uYW1lcyxcblx0XHRcdC4uLmNyZWF0ZURlYnVnLnNraXBzLm1hcChuYW1lc3BhY2UgPT4gJy0nICsgbmFtZXNwYWNlKVxuXHRcdF0uam9pbignLCcpO1xuXHRcdGNyZWF0ZURlYnVnLmVuYWJsZSgnJyk7XG5cdFx0cmV0dXJuIG5hbWVzcGFjZXM7XG5cdH1cblxuXHQvKipcblx0KiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG5cdCpcblx0KiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuXHQqIEByZXR1cm4ge0Jvb2xlYW59XG5cdCogQGFwaSBwdWJsaWNcblx0Ki9cblx0ZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG5cdFx0Zm9yIChjb25zdCBza2lwIG9mIGNyZWF0ZURlYnVnLnNraXBzKSB7XG5cdFx0XHRpZiAobWF0Y2hlc1RlbXBsYXRlKG5hbWUsIHNraXApKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IG5zIG9mIGNyZWF0ZURlYnVnLm5hbWVzKSB7XG5cdFx0XHRpZiAobWF0Y2hlc1RlbXBsYXRlKG5hbWUsIG5zKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvKipcblx0KiBDb2VyY2UgYHZhbGAuXG5cdCpcblx0KiBAcGFyYW0ge01peGVkfSB2YWxcblx0KiBAcmV0dXJuIHtNaXhlZH1cblx0KiBAYXBpIHByaXZhdGVcblx0Ki9cblx0ZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuXHRcdGlmICh2YWwgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0cmV0dXJuIHZhbC5zdGFjayB8fCB2YWwubWVzc2FnZTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbDtcblx0fVxuXG5cdC8qKlxuXHQqIFhYWCBETyBOT1QgVVNFLiBUaGlzIGlzIGEgdGVtcG9yYXJ5IHN0dWIgZnVuY3Rpb24uXG5cdCogWFhYIEl0IFdJTEwgYmUgcmVtb3ZlZCBpbiB0aGUgbmV4dCBtYWpvciByZWxlYXNlLlxuXHQqL1xuXHRmdW5jdGlvbiBkZXN0cm95KCkge1xuXHRcdGNvbnNvbGUud2FybignSW5zdGFuY2UgbWV0aG9kIGBkZWJ1Zy5kZXN0cm95KClgIGlzIGRlcHJlY2F0ZWQgYW5kIG5vIGxvbmdlciBkb2VzIGFueXRoaW5nLiBJdCB3aWxsIGJlIHJlbW92ZWQgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbiBvZiBgZGVidWdgLicpO1xuXHR9XG5cblx0Y3JlYXRlRGVidWcuZW5hYmxlKGNyZWF0ZURlYnVnLmxvYWQoKSk7XG5cblx0cmV0dXJuIGNyZWF0ZURlYnVnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNldHVwO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9mZXRjaGFnZW50Jyk7XG4iLCIvKiBnbG9iYWwgSGVhZGVycyAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZldGNoYWdlbnQ7XG5cblsnZ2V0JywgJ3B1dCcsICdwb3N0JywgJ2RlbGV0ZSddLmZvckVhY2gobWV0aG9kID0+IHtcbiAgZmV0Y2hhZ2VudFttZXRob2RdID0gdXJsID0+IGZldGNoYWdlbnQobWV0aG9kLnRvVXBwZXJDYXNlKCksIHVybCk7XG59KTtcblxuZmV0Y2hhZ2VudC5kZWwgPSBmZXRjaGFnZW50LmRlbGV0ZTtcblxuZnVuY3Rpb24gc2V0QWxsKGRlc3RpbmF0aW9uLCBzb3VyY2UpIHtcbiAgT2JqZWN0LmtleXMoc291cmNlKS5mb3JFYWNoKHAgPT4gZGVzdGluYXRpb24uc2V0KHAsIHNvdXJjZVtwXSkpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRVcmwocHJlZml4LCBxdWVyeSkge1xuICBmdW5jdGlvbiBlbmNvZGUodikge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHYpXG4gICAgICA/IHYubWFwKGVuY29kZVVSSUNvbXBvbmVudCkuam9pbignLCcpXG4gICAgICA6IGVuY29kZVVSSUNvbXBvbmVudCh2KTtcbiAgfVxuXG4gIGlmICghcXVlcnkpIHtcbiAgICByZXR1cm4gcHJlZml4O1xuICB9XG4gIGNvbnN0IHFzID0gT2JqZWN0XG4gICAgLmtleXMocXVlcnkpXG4gICAgLm1hcChuYW1lID0+IGAke25hbWV9PSR7ZW5jb2RlKHF1ZXJ5W25hbWVdKX1gKVxuICAgIC5qb2luKCcmJyk7XG4gIGlmICghcXMpIHtcbiAgICByZXR1cm4gcHJlZml4O1xuICB9XG4gIHJldHVybiBgJHtwcmVmaXh9PyR7cXN9YDtcbn1cblxuZnVuY3Rpb24gZGVmYXVsdENvbnRlbnRQYXJzZXIoY29udGVudFR5cGUpIHtcbiAgcmV0dXJuIGNvbnRlbnRUeXBlICYmIGNvbnRlbnRUeXBlLmluY2x1ZGVzKCdqc29uJykgPyAnanNvbic6ICd0ZXh0Jztcbn1cblxuZnVuY3Rpb24gZmV0Y2hhZ2VudChtZXRob2QsIHVybCkge1xuICBjb25zdCByZXEgPSB7XG4gICAgdXJsLFxuICAgIHF1ZXJ5OiB1bmRlZmluZWRcbiAgfTtcbiAgY29uc3QgaW5pdCA9IHtcbiAgICBtZXRob2QsXG4gICAgcmVkaXJlY3Q6ICdtYW51YWwnLFxuICAgIGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nXG4gIH07XG4gIGNvbnN0IHNlbGYgPSB7XG4gICAgZW5kLFxuICAgIGpzb24sXG4gICAgcGFyc2VyLFxuICAgIHF1ZXJ5LFxuICAgIHJlZGlyZWN0LFxuICAgIHNpZ25hbCxcbiAgICBzZW5kLFxuICAgIHNldCxcbiAgICB0ZXh0XG4gIH07XG5cbiAgbGV0IGVycm9yO1xuICBsZXQgY29udGVudFBhcnNlciA9IGRlZmF1bHRDb250ZW50UGFyc2VyO1xuXG4gIGZ1bmN0aW9uIGVuZChmbikge1xuICAgIGNvbnN0IGZldGNoZWQgPSBmZXRjaChmb3JtYXRVcmwocmVxLnVybCwgcmVxLnF1ZXJ5KSwgaW5pdCk7XG5cbiAgICBpZiAoIWZuKSB7XG4gICAgICByZXR1cm4gZmV0Y2hlZDtcbiAgICB9XG5cbiAgICBmZXRjaGVkXG4gICAgICAudGhlbihyZXMgPT4ge1xuICAgICAgICBpZiAoIXJlcy5vaykge1xuICAgICAgICAgIGVycm9yID0ge1xuICAgICAgICAgICAgc3RhdHVzOiByZXMuc3RhdHVzLFxuICAgICAgICAgICAgcmVzcG9uc2U6IHJlc1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyc2VyID0gY29udGVudFBhcnNlcihyZXMuaGVhZGVycy5nZXQoJ0NvbnRlbnQtVHlwZScpKTtcbiAgICAgICAgaWYgKHBhcnNlcikge1xuICAgICAgICAgIHJldHVybiByZXNbcGFyc2VyXSgpO1xuICAgICAgICB9IGVsc2UgaWYgKCFlcnJvcikge1xuICAgICAgICAgIGVycm9yID0ge1xuICAgICAgICAgICAgc3RhdHVzOiAndW5rbm93biBDb250ZW50LVR5cGUnLFxuICAgICAgICAgICAgcmVzcG9uc2U6IHJlc1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGhlbihcbiAgICAgICAgYm9keSA9PiBmbihlcnJvciwgYm9keSksXG4gICAgICAgIGUgPT4ge1xuICAgICAgICAgIGVycm9yID0gZXJyb3IgfHwge307XG4gICAgICAgICAgZXJyb3IuZXJyb3IgPSBlO1xuICAgICAgICAgIHJldHVybiBmbihlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICk7XG4gIH1cblxuICBmdW5jdGlvbiBqc29uKCkge1xuICAgIHJldHVybiBlbmQoKS50aGVuKHJlcyA9PiByZXMuanNvbigpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRleHQoKSB7XG4gICAgcmV0dXJuIGVuZCgpLnRoZW4ocmVzID0+IHJlcy50ZXh0KCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VuZChib2R5KSB7XG4gICAgaWYgKF9pbnN0YW5jZW9mKGJvZHksICdCbG9iJykgfHwgX2luc3RhbmNlb2YoYm9keSwgJ0Zvcm1EYXRhJykgfHwgdHlwZW9mIGJvZHkgIT09ICdvYmplY3QnKSB7XG4gICAgICBpbml0LmJvZHkgPSBib2R5O1xuICAgIH0gZWxzZSB7XG4gICAgICBpbml0LmJvZHkgPSBKU09OLnN0cmluZ2lmeShib2R5KTtcbiAgICAgIHNldCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBxdWVyeShxKSB7XG4gICAgcmVxLnF1ZXJ5ID0gcTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNpZ25hbChzKSB7XG4gICAgaW5pdC5zaWduYWwgPSBzO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0KGhlYWRlciwgdmFsdWUpIHtcbiAgICBpZiAoIWluaXQuaGVhZGVycykge1xuICAgICAgaW5pdC5oZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGluaXQuaGVhZGVycy5zZXQoaGVhZGVyLCB2YWx1ZSk7XG4gICAgfVxuICAgIGVsc2UgIHtcbiAgICAgIHNldEFsbChpbml0LmhlYWRlcnMsIGhlYWRlcik7XG4gICAgfVxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVkaXJlY3QoZm9sbG93KSB7XG4gICAgaW5pdC5yZWRpcmVjdCA9IGZvbGxvdyA/ICdmb2xsb3cnIDogJ21hbnVhbCc7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZXIoZm4pIHtcbiAgICBjb250ZW50UGFyc2VyID0gZm47XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICByZXR1cm4gc2VsZjtcbn1cblxuZnVuY3Rpb24gX2luc3RhbmNlb2Yob2JqZWN0LCBjb25zdHJ1Y3Rvck5hbWUpIHtcbiAgaWYgKHR5cGVvZiBnbG9iYWxUaGlzID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBjb25zdHJ1Y3RvciA9IGdsb2JhbFRoaXNbY29uc3RydWN0b3JOYW1lXTtcbiAgcmV0dXJuIHR5cGVvZiBjb25zdHJ1Y3RvciA9PT0gJ2Z1bmN0aW9uJyAmJiBvYmplY3QgaW5zdGFuY2VvZiBjb25zdHJ1Y3Rvcjtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gbGltaXRlcjtcblxuZnVuY3Rpb24gbGltaXRlcihpbnRlcnZhbCwgcGVuYWx0eUludGVydmFsID0gNSAqIGludGVydmFsKSB7XG4gIGxldCBxdWV1ZSA9IFtdO1xuICBsZXQgbGFzdFRyaWdnZXIgPSAwO1xuICBsZXQgcGVuYWx0eUNvdW50ZXIgPSAwO1xuICBsZXQgc2tpcENvdW50ZXIgPSAwO1xuICBsZXQgdGltZXI7XG5cbiAgcmV0dXJuIHtcbiAgICB0cmlnZ2VyLFxuICAgIHBlbmFsdHksXG4gICAgc2tpcCxcbiAgICBjYW5jZWxcbiAgfTtcblxuICBmdW5jdGlvbiB0cmlnZ2VyKGZuKSB7XG4gICAgY29uc3QgcCA9IHByb21pc2VkKGZuKTtcbiAgICBpZiAoc2luY2UoKSA+PSBjdXJyZW50SW50ZXJ2YWwoKSAmJiAhcXVldWUubGVuZ3RoKSB7XG4gICAgICBydW5Ob3cocCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHF1ZXVlLnB1c2gocCk7XG4gICAgICBzY2hlZHVsZSgpO1xuICAgIH1cbiAgICByZXR1cm4gcC5wcm9taXNlO1xuICB9XG5cbiAgZnVuY3Rpb24gcGVuYWx0eSgpIHtcbiAgICBwZW5hbHR5Q291bnRlciArPSAxO1xuICB9XG5cbiAgZnVuY3Rpb24gc2tpcCgpIHtcbiAgICBza2lwQ291bnRlciArPSAxO1xuICB9XG5cbiAgZnVuY3Rpb24gY2FuY2VsKCkge1xuICAgIGlmICh0aW1lcikge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICB9XG4gICAgcXVldWUuZm9yRWFjaChwID0+IHAucmVqZWN0KCkpO1xuICAgIHF1ZXVlID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBzaW5jZSgpIHtcbiAgICByZXR1cm4gRGF0ZS5ub3coKSAtIGxhc3RUcmlnZ2VyO1xuICB9XG5cbiAgZnVuY3Rpb24gY3VycmVudEludGVydmFsKCkge1xuICAgIHJldHVybiBwZW5hbHR5Q291bnRlciA+IDAgPyBwZW5hbHR5SW50ZXJ2YWwgOiBpbnRlcnZhbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJ1bk5vdyhwKSB7XG4gICAgcGVuYWx0eUNvdW50ZXIgPSAwO1xuICAgIHAucmVzb2x2ZSgpO1xuICAgIC8vIHdhaXQgdG8gdGhlIG5leHQgaW50ZXJ2YWwgdW5sZXNzIHRvbGQgdG8gc2tpcFxuICAgIC8vIHRvIHRoZSBuZXh0IG9wZXJhdGlvbiBpbW1lZGlhdGVseVxuICAgIGlmIChza2lwQ291bnRlciA+IDApIHtcbiAgICAgIHNraXBDb3VudGVyID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGFzdFRyaWdnZXIgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlcXVlKCkge1xuICAgIHRpbWVyID0gdW5kZWZpbmVkO1xuICAgIGlmIChzaW5jZSgpID49IGN1cnJlbnRJbnRlcnZhbCgpKSB7XG4gICAgICBydW5Ob3cocXVldWUuc2hpZnQoKSk7XG4gICAgfVxuICAgIHNjaGVkdWxlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBzY2hlZHVsZSgpIHtcbiAgICBpZiAoIXRpbWVyICYmIHF1ZXVlLmxlbmd0aCkge1xuICAgICAgY29uc3QgZGVsYXkgPSBjdXJyZW50SW50ZXJ2YWwoKSAtIHNpbmNlKCk7XG4gICAgICBpZiAoZGVsYXkgPCAwKSB7XG4gICAgICAgIHJldHVybiBkZXF1ZSgpO1xuICAgICAgfVxuICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGRlcXVlLCBkZWxheSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHByb21pc2VkKGZuKSB7XG4gIGxldCBfID0ge307XG4gIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiBfID0geyByZXNvbHZlLCByZWplY3QgfSk7XG4gIHJldHVybiB7XG4gICAgcHJvbWlzZSxcbiAgICByZXNvbHZlLFxuICAgIHJlamVjdFxuICB9O1xuXG4gIGZ1bmN0aW9uIHJlc29sdmUoKSB7XG4gICAgaWYgKGZuKSB7IGZuKCk7IH1cbiAgICBfLnJlc29sdmUoKTtcbiAgfVxuICBmdW5jdGlvbiByZWplY3QoKSB7XG4gICAgXy5yZWplY3QoKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB3ID0gZCAqIDc7XG52YXIgeSA9IGQgKiAzNjUuMjU7XG5cbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHZhbCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsO1xuICBpZiAodHlwZSA9PT0gJ3N0cmluZycgJiYgdmFsLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gcGFyc2UodmFsKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiBpc0Zpbml0ZSh2YWwpKSB7XG4gICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICd2YWwgaXMgbm90IGEgbm9uLWVtcHR5IHN0cmluZyBvciBhIHZhbGlkIG51bWJlci4gdmFsPScgK1xuICAgICAgSlNPTi5zdHJpbmdpZnkodmFsKVxuICApO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHN0ciA9IFN0cmluZyhzdHIpO1xuICBpZiAoc3RyLmxlbmd0aCA+IDEwMCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbWF0Y2ggPSAvXigtPyg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8d2Vla3M/fHd8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWMoXG4gICAgc3RyXG4gICk7XG4gIGlmICghbWF0Y2gpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3lycyc6XG4gICAgY2FzZSAneXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ3dlZWtzJzpcbiAgICBjYXNlICd3ZWVrJzpcbiAgICBjYXNlICd3JzpcbiAgICAgIHJldHVybiBuICogdztcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdocnMnOlxuICAgIGNhc2UgJ2hyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ21pbnMnOlxuICAgIGNhc2UgJ21pbic6XG4gICAgY2FzZSAnbSc6XG4gICAgICByZXR1cm4gbiAqIG07XG4gICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgY2FzZSAnc2Vjb25kJzpcbiAgICBjYXNlICdzZWNzJzpcbiAgICBjYXNlICdzZWMnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21pbGxpc2Vjb25kcyc6XG4gICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgIGNhc2UgJ21zZWNzJzpcbiAgICBjYXNlICdtc2VjJzpcbiAgICBjYXNlICdtcyc6XG4gICAgICByZXR1cm4gbjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG4vKipcbiAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGZtdFNob3J0KG1zKSB7XG4gIHZhciBtc0FicyA9IE1hdGguYWJzKG1zKTtcbiAgaWYgKG1zQWJzID49IGQpIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICB9XG4gIGlmIChtc0FicyA+PSBoKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBoKSArICdoJztcbiAgfVxuICBpZiAobXNBYnMgPj0gbSkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbSkgKyAnbSc7XG4gIH1cbiAgaWYgKG1zQWJzID49IHMpIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICB9XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBmbXRMb25nKG1zKSB7XG4gIHZhciBtc0FicyA9IE1hdGguYWJzKG1zKTtcbiAgaWYgKG1zQWJzID49IGQpIHtcbiAgICByZXR1cm4gcGx1cmFsKG1zLCBtc0FicywgZCwgJ2RheScpO1xuICB9XG4gIGlmIChtc0FicyA+PSBoKSB7XG4gICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGgsICdob3VyJyk7XG4gIH1cbiAgaWYgKG1zQWJzID49IG0pIHtcbiAgICByZXR1cm4gcGx1cmFsKG1zLCBtc0FicywgbSwgJ21pbnV0ZScpO1xuICB9XG4gIGlmIChtc0FicyA+PSBzKSB7XG4gICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIHMsICdzZWNvbmQnKTtcbiAgfVxuICByZXR1cm4gbXMgKyAnIG1zJztcbn1cblxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqL1xuXG5mdW5jdGlvbiBwbHVyYWwobXMsIG1zQWJzLCBuLCBuYW1lKSB7XG4gIHZhciBpc1BsdXJhbCA9IG1zQWJzID49IG4gKiAxLjU7XG4gIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbikgKyAnICcgKyBuYW1lICsgKGlzUGx1cmFsID8gJ3MnIDogJycpO1xufVxuIiwiY29uc3QgZ2VvcGxldGUgPSByZXF1aXJlKCcuLicpO1xuXG5jb25zdCBrZXlzID0ge1xuICBnZW9jb2RpbzogXCJcIixcbiAgZ3JhcGhob3BwZXI6IFwiXCIsXG4gIGxvY2F0aW9uaXE6IFwiXCIsXG4gIG1hcHRpbGVyOiBcIlpuUVVSWGZRZ3VKWURQVEQ1eld3XCIsXG4gIG9wZW5jYWdlOiBcIlwiLFxuICBwZWxpYXM6IFwiXCIsXG4gIHBvc2l0aW9uc3RhY2s6IFwiXCJcbn07XG5cbmZ1bmN0aW9uIGdlb2NvZGVyKG5hbWUpIHtcbiAgY29uc3QgZyA9IHtcbiAgICBvcmRlcjogW25hbWVdXG4gIH07XG4gIGdbbmFtZSArICdfa2V5J10gPSBrZXlzW25hbWVdO1xuICBnW25hbWUgKyAnX3BhcmFtZXRlcnMnXSA9IHsgaW50ZXJ2YWwgOiAxMDAwIH07XG4gIGdbbmFtZSArICdfZW5hYmxlJ10gPSAoKSA9PiB0cnVlO1xuICByZXR1cm4gZztcbn1cblxuY29uc3QgZ2VvY29kZXJBZGRyZXNzID0gW1xuICAnZ2VvY29kaW8nLFxuICAnZ3JhcGhob3BwZXInLFxuICAnbG9jYXRpb25pcScsXG4gICdvcGVuY2FnZScsXG4gICdwZWxpYXMnLFxuICAncG9zaXRpb25zdGFjaydcbl0uZmluZChuYW1lID0+IGtleXNbbmFtZV0pO1xuXG5jb25zdCBnZW9jb2RlclBsYWNlID0gW1xuICAnbWFwdGlsZXInLFxuICAnZ3JhcGhob3BwZXInLFxuICAnbG9jYXRpb25pcScsXG4gICdvcGVuY2FnZScsXG4gICdwZWxpYXMnLFxuICAncG9zaXRpb25zdGFjaydcbl0uZmluZChuYW1lID0+IGtleXNbbmFtZV0pO1xuXG5jb25zdCByZXN1bHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdWx0Jyk7XG5mdW5jdGlvbiBvbmNoYW5nZShldmVudCkge1xuICByZXN1bHQudmFsdWUgPSBKU09OLnN0cmluZ2lmeShldmVudC5kZXRhaWwsIG51bGwsIDIpO1xufVxuXG5jb25zdCBwbGFjZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGFjZScpO1xucGxhY2UuYWRkRXZlbnRMaXN0ZW5lcignZ2VvcGxldGUtY2hhbmdlJywgb25jaGFuZ2UpO1xuZ2VvcGxldGUocGxhY2UsIHsgdHlwZTogJ3BsYWNlJywgaXRlbSwgZ2VvY29kZXI6IGdlb2NvZGVyKGdlb2NvZGVyUGxhY2UpIH0pO1xuXG5jb25zdCBhZGRyZXNzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FkZHJlc3MnKTtcbmFkZHJlc3MuYWRkRXZlbnRMaXN0ZW5lcignZ2VvcGxldGUtY2hhbmdlJywgb25jaGFuZ2UpO1xuZ2VvcGxldGUoYWRkcmVzcywgeyB0eXBlOiAnYWRkcmVzcycsIGdlb2NvZGVyOiBnZW9jb2RlcihnZW9jb2RlckFkZHJlc3MpIH0pO1xuXG4vLyBleGFtcGxlIG9mIGhvdyB0byBjdXN0b21pemUgb3V0cHV0XG5mdW5jdGlvbiBpdGVtKHRleHQpIHtcbiAgY29uc3QgdiA9IHRleHQudmFsdWU7XG4gIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgbGkuaW5uZXJIVE1MID0gJzxtYXJrPicgKyAodi5wbGFjZSB8fCAnJykgKyAnPC9tYXJrPiA8ZW0+JyArIHYuYWRkcmVzcyArICc8L2VtPic7XG4gIHJldHVybiBsaTtcbn1cbiJdfQ==
