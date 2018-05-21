require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = require('./lib/geocode');

},{"./lib/geocode":2}],2:[function(require,module,exports){
var strategy = require('./strategy');
var util = require('./service/util');

module.exports = furkotGeocode;

function skip(options, query, result) {
  // some other service already returned result
  // or service is disabled
  return (result && result.places && result.places.length) || !options.enable(query, result);
}

var services = {
  algolia: {
    init: require('./service/algolia')
  },
  opencage: {
    init: require('./service/opencage')
  },
  tilehosting: {
    init: require('./service/tilehosting')
  }
};

//default timeout to complete operation
var defaultTimeout = 20 * 1000;
var id = 0;

function furkotGeocode(options) {
  var operations;

  function geocode(query, fn) {
    var timeoutId, queryId, op, aborted;

    function abort() {
      aborted = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      // cancel outstanding requests
      operations.abort.forEach(function (abort) {
        abort(queryId);
      });
    }

    if (!query) {
      fn();
      return;
    }
    op = query.ll ? 'reverse' : 'forward';
    if (!(operations[op] && operations[op].length)) {
      fn();
      return;
    }

    id += 1;
    queryId = id;
    timeoutId = setTimeout(abort, options.timeout);
    strategy(operations[op], queryId, query, {}, function (err, queryId, query, result) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (err || aborted) {
        return fn();
      }
      fn(result);
    });
    return {
      abort: abort
    };
  }

  options = util.defaults(options, {
    timeout: defaultTimeout,
    order: ['opencage'],
    skip: skip
  });
  operations = util.defaults(options, {
    abort: []
  });
  ['forward', 'reverse'].reduce(function (options, op) {
    if (!operations[op]) {
      operations[op] = options.order.reduce(function (result, name) {
        var service = services[name];
        if (service && options[(name + '_enable')]) {
          if (!service.service) {
            service.service = service.init(util.defaults({
              name: name,
              limiter: options[(name + '_limiter')],
              enable: options[(name + '_enable')],
              skip: service.skip
            }, options));
            operations.abort.push(service.service.abort);
          }
          if (service.service[op] && service.service.geocode) {
            result.push(service.service.geocode.bind(undefined, op));
          }
        }
        return result;
      }, []);
    }
    return options;
  }, options);

  geocode.options = operations;
  return geocode;
}

},{"./service/algolia":3,"./service/opencage":5,"./service/tilehosting":8,"./service/util":9,"./strategy":10}],3:[function(require,module,exports){
var states = require('../states');
var status = require('../status');
var util = require('../util');

module.exports = init;

function getUrl(url, key, id) {
  if (key && id) {
    url += '?x-algolia-api-key=' + key + '&x-algolia-application-id=' + id;
  }
  return url;
}

function prepareRequest(op, query) {
  var req = {
    query: query.address || query.place,
    language: query.lang ? query.lang.split('_').pop() : 'en',
    aroundLatLngViaIP: false
  };
  if (query.bounds) {
    req.aroundLatLng = mid(query.bounds[0][1], query.bounds[1][1]) +
      ',' + mid(query.bounds[0][0], query.bounds[0][1]);
  }
  if (query.address) {
    req.type = 'address';
  }
  return req;
}

function getStatus(err, response) {
  if (!(response && response.nbHits)) {
    return status.empty;
  }
  return status.success;
}

function processResponse(response, query, result) {
  if (!(response && response.hits && response.hits.length)) {
    return;
  }
  result.places = response.hits.map(function (result) {
    var geom = result._geoloc, res = {
      ll: [ geom.lng, geom.lat ]
    }, addr = [];
    if (result.is_highway) {
      res.type = 'road';
    }
    else if (result._tags && result._tags.length){
      res.type = result._tags[0];
    }
    if (result.locale_names && result.locale_names.length) {
      if (res.type === 'road') {
        res.street = result.locale_names[0];
        addr.push(res.street);
      }
      else {
        res.place = result.locale_names[0];
      }
    }
    if (result.city && result.city.length) {
      res.town = result.city[0];
      addr.push(res.town);
    }
    if (result.county && result.county.length) {
      res.county = result.county[0];
      if (!res.town) {
        addr.push(res.county);
      }
    }
    if (result.administrative && result.administrative.length) {
      res.province = states[result.administrative[0]] || result.administrative[0];
      addr.push(res.province);
    }
    if (result.country) {
      res.country = result.country;
      if (res.country === 'United States of America') {
        res.country = 'USA';
      }
      addr.push(res.country);
    }
    res.address = addr.join(', ');
    return res;
  });
  return result;
}

function init(options) {

  if (options.algolia_parameters) {
    options = util.defaults(options, options.algolia_parameters);
  }
  options = util.defaults(options, {
    forward: true,
    post: true,
    url: getUrl(options.algolia_url || 'https://places-dsn.algolia.net/1/places/query',
      options.algolia_key,
      options.algolia_app_id),
    status: getStatus,
    prepareRequest: prepareRequest,
    processResponse: processResponse
  });
  return require('..')(options);
}

function mid(v1, v2) {
  return (v1 + v2) / 2;
}
},{"..":4,"../states":6,"../status":7,"../util":9}],4:[function(require,module,exports){
var fetchagent = require('fetchagent');
var status = require('./status');
var util = require('./util');
var debug = require('debug')('furkot:geocode:service');

module.exports = init;

var limiters = {};

var ERROR = 'input error';

function request(url, req, fn) {
  var options = this, fa = fetchagent;
  if (options.post) {
    fa = fa.post(url).send(req);
  }
  else {
    fa = fa.get(url).query(req);
  }
  return fa
    .set('accept', 'application/json')
    .end(fn);
}

function initUrl(url) {
  if (typeof url === 'function') {
    return url;
  }
  return function () {
    return url;
  };
}

function init(options) {
  var limiter, holdRequests, outstanding = {};

  function abort(queryId) {
    debug('abort', queryId);
    if (!outstanding[queryId]) {
      return;
    }
    // cancel later request if scheduled
    if (outstanding[queryId].laterTimeoutId) {
      clearTimeout(outstanding[queryId].laterTimeoutId);
    }
    // cancel request in progress
    if (outstanding[queryId].reqInProgress) {
      outstanding[queryId].reqInProgress.abort();
    }
    outstanding[queryId].callback(ERROR);
  }

  function geocode(op, queryId, query, result, fn) {

    function requestLater() {
      outstanding[queryId].laterTimeoutId = setTimeout(function () {
        if (outstanding[queryId]) {
          delete outstanding[queryId].laterTimeoutId;
        }
        executeQuery();
      }, options.penaltyTimeout);
    }

    function executeQuery(callback) {
      var req;

      if (!outstanding[queryId]) {
        // query has been aborted
        return;
      }
      if (holdRequests) {
        return callback();
      }
      req = options.prepareRequest(op, query);
      if (!req) {
        return callback();
      }
      if (req === true) {
        req = undefined;
      }

      limiter.trigger(function () {
        if (!outstanding[queryId]) {
          // query has been aborted
          limiter.skip(); // immediately process the next request in the queue
          return;
        }
        query.stats = query.stats || [];
        query.stats.push(options.name);
        outstanding[queryId].reqInProgress = options.request(options.url(op, query), req, function (err, response) {
          var st, res;
          if (!outstanding[queryId]) {
            // query has been aborted
            return;
          }
          delete outstanding[queryId].reqInProgress;
          st = options.status(err, response);
          if (st === undefined) {
            // shouldn't happen (bug or unexpected response format)
            // treat it as no result
            st = status.empty;
          }
          if (st === status.failure) {
            // don't ever ask again
            holdRequests = true;
            return callback();
          }
          if (st === status.error) {
            // try again later
            limiter.penalty();
            return requestLater();
          }

          if (st === status.success) {
            res = options.processResponse(response, query, result || {});
          }
          callback(undefined, res);
        });
      });
    }

    outstanding[queryId] = {
      callback: function (err, result) {
        var finished = Boolean(result);
        delete outstanding[queryId];
        result = result || {};
        result.stats = query.stats;
        result.provider = options.name;
        fn(err, finished, queryId, query, result);
      }
    };
    executeQuery(outstanding[queryId].callback);
  }

  options = util.defaults(options, {
    interval: 340,
    penaltyInterval: 2000,
    limiter: limiters[options.name],
    request: request,
    abort: abort
  });
  options.url = initUrl(options.url);
  limiters[options.name] = options.limiter || require('limiter-component')(options.interval, options.penaltyInterval);
  limiter = limiters[options.name];
  
  return {
    forward: options.forward,
    reverse: options.reverse,
    geocode: geocode,
    abort: options.abort
  };
}

},{"./status":7,"./util":9,"debug":11,"fetchagent":13,"limiter-component":15}],5:[function(require,module,exports){
var status = require('../status');
var util = require('../util');

var code2status = {
  200: status.success, // OK (zero or more results will be returned)
  400: status.empty,   // Invalid request (bad request; a required parameter is missing; invalid coordinates)
  402: status.failure, // Valid request but quota exceeded (payment required)
  403: status.failure, // Invalid or missing api key (forbidden)
  404: status.failure, // Invalid API endpoint
  408: status.error,   // Timeout; you can try again
  410: status.empty,   // Request too long
  429: status.error,   // Too many requests (too quickly, rate limiting)
  503: status.empty    // Internal server error
};

var geotypes = [
  'road',
  'neighbourhood',
  'suburb',
  'town',
  'city',
  'county',
  'state',
  'country'
].reduce(function (result, type) {
  result[type] = type;
  return result;
}, {});

module.exports = init;

// response codes: https://geocoder.opencagedata.com/api#codes
function getStatus(err, response) {
  var code = response && response.status && response.status.code;
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
  var q;
  if (op === 'forward') {
    q = (query.address || query.place).replace(/ /g, '+').replace(/,/g, '%2C');
  }
  else {
    q = query.ll[1] + '+' + query.ll[0];
  }
  url += '?q=' + q;
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
      var components = result.components, geom = result.geometry, res = {
          ll: [ geom.lng, geom.lat ]
      }, addr;
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
        res.province = components.state_code;
      }
      if (components.country) {
        res.country = components.country;
        if (res.country === 'United States of America') {
          res.country = 'USA';
        }
      }
      if (result.formatted) {
        res.address = result.formatted;
        if (!geotypes[res.type]) {
          addr = res.address.split(', ');
          if (addr.length > 1 && addr[0] === res.place) {
            addr.shift();
            res.address = addr.join(', ');
          }
        }
        if (res.country === 'USA') {
          res.address = res.address.replace('United States of America', 'USA');
        }
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
    prepareRequest: prepareRequest,
    processResponse: processResponse
  });
  if (options.opencage_parameters) {
    options = util.defaults(options, options.opencage_parameters);
  }
  return require('..')(options);
}

function join(ll) {
  return ll.join(',');
}

},{"..":4,"../status":7,"../util":9}],6:[function(require,module,exports){
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
    "Wyoming": "WY",

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

},{}],7:[function(require,module,exports){
module.exports = {
  success: 'success', // success
  failure: 'failure', // ultimate failure
  error: 'error', // temporary error
  empty: 'empty' // no result
};

},{}],8:[function(require,module,exports){
/*
 * https://cloud.maptiler.com/geocoding/
 */
var states = require('../states');
var status = require('../status');
var util = require('../util');

module.exports = init;

// response codes: https://geocoder.opencagedata.com/api#codes
function getStatus(err, response) {
  if (!response) {
    return;
  }
  if (err) {
    return err.status ? status.error : status.failure;
  }
  if (!(response.results && response.results.length)) {
    return status.empty;
  }
  return status.success;
}

function getUrl(url, key, op, query) {
  var q;
  if (op === 'forward') {
    q = 'q/' + encodeURIComponent(query.address || query.place);
  }
  else {
    q = 'r/' + query.ll.join('/');
  }
  return url + q + '.js?key=' + key;
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
      var res = {
          ll: [ result.lon, result.lat ]
      }, addr;
      if (result.type) {
        res.type = result.type;
      }
      if (result.name) {
        res.place = result.name;
      }
      if (result.housenumbers) {
        res.house = result.housenumbers.split(', ').shift();
      }
      if (result.street) {
        res.street = result.street;
      }
      if (result.city) {
        res.town = result.city;
      }
      if (result.county) {
        res.county = result.county;
      }
      if (result.state) {
        res.province = states[result.state] || result.state;
      }
      if (result.country) {
        res.country = result.country;
        if (res.country === 'United States of America') {
          res.country = 'USA';
        }
      }
      if (result.display_name) {
        res.address = result.display_name;
        if (res.street !== res.place) {
          addr = res.address.split(', ');
          if (addr.length > 1 && addr[0] === res.place) {
            addr.shift();
            res.address = addr.join(', ');
          }
        }
        if (res.country === 'USA') {
          res.address = res.address.replace('United States of America', 'USA');
        }
        if (res.country === 'USA' || res.coutry === 'Canada') {
          res.address = res.address.replace(result.state, res.province);
        }
      }
      return res;
    });
    return result;
  }

  options = util.defaults(options, {
    forward: true,
    reverse: true,
    url: getUrl.bind(undefined,
        options.tilehosting_url || 'https://geocoder.tilehosting.com/',
        options.tilehosting_key),
    status: getStatus,
    prepareRequest: prepareRequest,
    processResponse: processResponse
  });
  return require('..')(options);
}

},{"..":4,"../states":6,"../status":7,"../util":9}],9:[function(require,module,exports){
module.exports = {
  defaults: defaults
};

function defaults(obj, source) {
  return Object.assign({}, source, obj);
}

},{}],10:[function(require,module,exports){
var waterfall = require('run-waterfall');

module.exports = strategy;

var END = 'end processing';

/**
 * Process the list of tasks one by one,ending processing as soon as one task says so.
 * The next task is invoked with parameters set by the previous task.
 * It is a cross between async operations: waterfall and some
 * @param tasks list of tasks
 * @param ... any number of parameters to be passed to the first task
 * @param callback the last argument is an optional callback called after tasks have been processed;
 *   called with error followed by the parameters passed from the last invoked task
 */
function strategy(tasks) {
  var callback = arguments[arguments.length - 1],
    parameters = Array.prototype.slice.call(arguments, 0, -1);
  parameters[0] = undefined;

  tasks = tasks.reduce(function (result, task) {
    result.push(function () {
      var callback = arguments[arguments.length - 1];
        parameters = Array.prototype.slice.call(arguments, 0, -1);
      parameters.push(function (err, trueValue) {
        var parameters = [err].concat(Array.prototype.slice.call(arguments, 2));
        if (!err && trueValue) {
          // jump out of processing
          parameters[0] = END;
        }
        callback.apply(undefined, parameters);
      });
      task.apply(undefined, parameters);
    });
    return result;
  }, [
    function (fn) {
      fn.apply(undefined, parameters);
    }
  ]);
  waterfall(tasks, function (err) {
    var parameters = [err].concat(Array.prototype.slice.call(arguments, 1));
    if (err === END) {
      parameters[0] = undefined;
    }
    callback.apply(undefined, parameters);
  });
}

},{"run-waterfall":17}],11:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // Internet Explorer and Edge do not support colors.
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    return false;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

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
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))

},{"./debug":12,"_process":21}],12:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * Active `debug` instances.
 */
exports.instances = [];

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  var prevTime;

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);
  debug.destroy = destroy;

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  exports.instances.push(debug);

  return debug;
}

function destroy () {
  var index = exports.instances.indexOf(this);
  if (index !== -1) {
    exports.instances.splice(index, 1);
    return true;
  } else {
    return false;
  }
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var i;
  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }

  for (i = 0; i < exports.instances.length; i++) {
    var instance = exports.instances[i];
    instance.enabled = exports.enabled(instance.namespace);
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  if (name[name.length - 1] === '*') {
    return true;
  }
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
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
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":16}],13:[function(require,module,exports){
module.exports = require('./lib/fetchagent');

},{"./lib/fetchagent":14}],14:[function(require,module,exports){
/* global Headers */

module.exports = fetchagent;

['get', 'put', 'post', 'delete'].forEach(function(method) {
  fetchagent[method] = function(url) {
    return fetchagent(method.toUpperCase(), url);
  };
});

fetchagent.del = fetchagent.delete;

function setAll(destination, source) {
  Object.keys(source).forEach(function(p) {
    destination.set(p, source[p]);
  });
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
  var qs = Object
    .keys(query)
    .map(function(name) { return name + '=' + encode(query[name]); })
    .join('&');
  if (!qs) {
    return prefix;
  }
  return prefix + '?' + qs;
}

function defaultContentParser(contentType) {
  return contentType && contentType.indexOf('json') !== -1
    ? 'json'
    : 'text';
}

function fetchagent(method, url) {
  var req = {
    url: url,
    query: undefined
  };
  var init = {
    method: method,
    redirect: 'manual',
    credentials: 'same-origin'
  };
  var self = {
    end: end,
    json: json,
    parser: parser,
    query: query,
    redirect: redirect,
    send: send,
    set: set,
    text: text
  };
  var error;
  var contentParser = defaultContentParser;

  function end(fn) {
    var fetched = fetch(formatUrl(req.url, req.query), init);

    if (!fn) {
      return fetched;
    }

    fetched
      .then(function(res) {
        if (!res.ok) {
          error = {
            status: res.status,
            response: res
          };
        }
        var parser = contentParser(res.headers.get('Content-Type'));
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
        function(body) { return fn(error, body); },
        function(e) {
          error = error || {};
          error.error = e;
          return fn(error);
        }
      );
  }

  function json() {
    return end().then(function(res) { return res.json(); });
  }

  function text() {
    return end().then(function(res) { return res.text(); });
  }

  function send(body) {
    if (body instanceof Blob || body instanceof FormData || typeof body !== 'object') {
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

},{}],15:[function(require,module,exports){

module.exports = limiter;

/*global setTimeout, clearTimeout */

function limiter(interval, penaltyInterval) {

  var queue = [],
    lastTrigger = 0,
    penaltyCounter = 0,
    skipCounter = 0,
    timer;

  function now() {
    return Date.now();
  }

  function since() {
    return now() - lastTrigger;
  }

  function currentInterval() {
    return penaltyCounter > 0 ? penaltyInterval : interval;
  }

  function runNow(fn) {
    penaltyCounter = 0;
    fn();
    // wait to the next interval unless told to skip
    // to the next operation immediately
    if (skipCounter > 0) {
      skipCounter = 0;
    }
    else {
      lastTrigger = now();
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
    var delay;
    if (!timer && queue.length) {
      delay = currentInterval() - since();
      if (delay < 0) {
        return deque();
      }
      timer = setTimeout(deque, delay);
    }
  }

  function trigger(fn) {
    if (since() >= currentInterval() && !queue.length) {
      runNow(fn);
    } else {
      queue.push(fn);
      schedule();
    }
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
    queue = [];
  }

  penaltyInterval = penaltyInterval || 5 * interval;
  return {
    trigger: trigger,
    penalty: penalty,
    skip: skip,
    cancel: cancel
  };
}

},{}],16:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
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

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
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
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
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
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
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
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],17:[function(require,module,exports){
(function (process){
module.exports = runWaterfall

function runWaterfall (tasks, cb) {
  var current = 0
  var isSync = true

  function done (err, args) {
    function end () {
      args = args ? [].concat(err, args) : [ err ]
      if (cb) cb.apply(undefined, args)
    }
    if (isSync) process.nextTick(end)
    else end()
  }

  function each (err) {
    var args = Array.prototype.slice.call(arguments, 1)
    if (++current >= tasks.length || err) {
      done(err, args)
    } else {
      tasks[current].apply(undefined, [].concat(args, each))
    }
  }

  if (tasks.length) {
    tasks[0](each)
  } else {
    done(null)
  }

  isSync = false
}

}).call(this,require('_process'))

},{"_process":21}],18:[function(require,module,exports){
var Awesomplete = require('awesomplete');
var furkotGeocode = require('furkot-geocode');
var debounce = require('debounce');

module.exports = geoplete;

var defaultGeocoder = {
  order: ['algolia'],
  algolia_parameters: { interval : 1000 },
  algolia_enable: function() { return true; }
};

var Suggestions = {
  'address': {
    toString: function() { return this.address || this.place; }
  },
  'place': {
    toString: function() { return this.place || this.address; }
  }
};

function displayAll() {
  return true;
}

function geoplete(el, options) {
  options = options || {};
  options.type = Suggestions[options.type] ? options.type : 'address';
  var acOptions = {
    minChars: options.minChars || 4,
    filter: displayAll
  };


  var geoOptions = options.geocoder || defaultGeocoder;

  var lastValue;
  var outstandingRequest;
  var geocode = furkotGeocode(geoOptions);
  var ac = new Awesomplete(el, acOptions);

  var oninput = debounce(function() {
    if (el.value.length < acOptions.minChars) {
      return;
    }
    query(el.value);
  }, 300);

  function onchange(event) {
    var value = event.text.value;
    lastValue = value.toString();
    var changeEvent = new CustomEvent('geoplete-change', { detail: value });
    el.dispatchEvent(changeEvent);
  }

  function fromPlace(place) {
    return Object.assign(Object.create(Suggestions[options.type]), place);
  }

  function query(value) {
    if (lastValue === value) {
      // do not requery for the same value
      return;
    }
    if (outstandingRequest) {
      outstandingRequest.abort();
    }
    var params = {
      partial: true,
      bounds: options.bounds,
      lang: options.lang || document.lang || 'en'
    };
    params[options.type] = value;
    lastValue = value;
    el.classList.add('geoplete-in-progress');
    outstandingRequest = geocode(params, function(result) {
      el.classList.remove('geoplete-in-progress');
      if (!result || !result.places) {
        // no results
        return;
      }
      ac.list = result.places.map(fromPlace);
      ac.evaluate();
    });
  }

  function destroy() {
    el.removeEventListener('input', oninput);
    el.removeEventListener('awesomplete-selectcomplete', onchange);
    ac.destroy();
  }

  el.addEventListener('input', oninput);
  el.addEventListener('awesomplete-selectcomplete', onchange);

  return {
    destroy: destroy
  };
}

},{"awesomplete":19,"debounce":20,"furkot-geocode":1}],19:[function(require,module,exports){
/**
 * Simple, lightweight, usable local autocomplete library for modern browsers
 * Because there weren’t enough autocomplete scripts in the world? Because I’m completely insane and have NIH syndrome? Probably both. :P
 * @author Lea Verou http://leaverou.github.io/awesomplete
 * MIT license
 */

(function () {

var _ = function (input, o) {
	var me = this;

	// Setup

	this.isOpened = false;

	this.input = $(input);
	this.input.setAttribute("autocomplete", "off");
	this.input.setAttribute("aria-autocomplete", "list");

	o = o || {};

	configure(this, {
		minChars: 2,
		maxItems: 10,
		autoFirst: false,
		data: _.DATA,
		filter: _.FILTER_CONTAINS,
		sort: o.sort === false ? false : _.SORT_BYLENGTH,
		item: _.ITEM,
		replace: _.REPLACE
	}, o);

	this.index = -1;

	// Create necessary elements

	this.container = $.create("div", {
		className: "awesomplete",
		around: input
	});

	this.ul = $.create("ul", {
		hidden: "hidden",
		inside: this.container
	});

	this.status = $.create("span", {
		className: "visually-hidden",
		role: "status",
		"aria-live": "assertive",
		"aria-relevant": "additions",
		inside: this.container
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
			"mousedown": function(evt) {
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

		$.fire(this.input, "awesomplete-close", o || {});
	},

	open: function () {
		this.ul.removeAttribute("hidden");
		this.isOpened = true;

		if (this.autoFirst && this.index === -1) {
			this.goto(0);
		}

		$.fire(this.input, "awesomplete-open");
	},

	destroy: function() {
		//remove events from the input and its form
		$.unbind(this.input, this._events.input);
		$.unbind(this.input.form, this._events.form);

		//move the input out of the awesomplete container and remove the container and its children
		var parentNode = this.container.parentNode;

		parentNode.insertBefore(this.input, this.container);
		parentNode.removeChild(this.container);

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
			this.status.textContent = lis[i].textContent;

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

		if (value.length >= this.minChars && this._list.length > 0) {
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

			this.suggestions.forEach(function(text) {
					me.ul.appendChild(me.item(text, value));
				});

			if (this.ul.children.length === 0) {
				this.close({ reason: "nomatches" });
			} else {
				this.open();
			}
		}
		else {
			this.close({ reason: "nomatches" });
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

_.ITEM = function (text, input) {
	var html = input.trim() === "" ? text : text.replace(RegExp($.regExpEscape(input.trim()), "gi"), "<mark>$&</mark>");
	return $.create("li", {
		innerHTML: html,
		"aria-selected": "false"
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

// Make sure to export Awesomplete on self when in a browser
if (typeof self !== "undefined") {
	self.Awesomplete = _;
}

// Expose Awesomplete as a CJS module
if (typeof module === "object" && module.exports) {
	module.exports = _;
}

return _;

}());

},{}],20:[function(require,module,exports){
/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing. The function also has a property 'clear' 
 * that is a function which will clear the timer to prevent previously scheduled executions. 
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} function to wrap
 * @param {Number} timeout in ms (`100`)
 * @param {Boolean} whether to execute at the beginning (`false`)
 * @api public
 */

module.exports = function debounce(func, wait, immediate){
  var timeout, args, context, timestamp, result;
  if (null == wait) wait = 100;

  function later() {
    var last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        context = args = null;
      }
    }
  };

  var debounced = function(){
    context = this;
    args = arguments;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };

  debounced.clear = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  debounced.flush = function() {
    if (timeout) {
      result = func.apply(context, args);
      context = args = null;
      
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
};

},{}],21:[function(require,module,exports){
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

},{}],"geoplete":[function(require,module,exports){
module.exports = require('./lib/geoplete');

},{"./lib/geoplete":18}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9mdXJrb3QvZ2VvY29kZS9pbmRleC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9nZW9jb2RlLmpzIiwiLi4vZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2UvYWxnb2xpYS9pbmRleC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2Uvb3BlbmNhZ2UvaW5kZXguanMiLCIuLi9mdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9zdGF0ZXMuanNvbiIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL3N0YXR1cy5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL3RpbGVob3N0aW5nL2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2UvdXRpbC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zdHJhdGVneS5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvYnJvd3Nlci5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvZGVidWcuanMiLCIuLi9mdXJrb3QvZ2VvY29kZS9ub2RlX21vZHVsZXMvZmV0Y2hhZ2VudC9pbmRleC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL25vZGVfbW9kdWxlcy9mZXRjaGFnZW50L2xpYi9mZXRjaGFnZW50LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbm9kZV9tb2R1bGVzL2xpbWl0ZXItY29tcG9uZW50L2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbm9kZV9tb2R1bGVzL3J1bi13YXRlcmZhbGwvaW5kZXguanMiLCJsaWIvZ2VvcGxldGUuanMiLCJub2RlX21vZHVsZXMvYXdlc29tcGxldGUvYXdlc29tcGxldGUuanMiLCJub2RlX21vZHVsZXMvZGVib3VuY2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pPQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZ2VvY29kZScpO1xuIiwidmFyIHN0cmF0ZWd5ID0gcmVxdWlyZSgnLi9zdHJhdGVneScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3NlcnZpY2UvdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1cmtvdEdlb2NvZGU7XG5cbmZ1bmN0aW9uIHNraXAob3B0aW9ucywgcXVlcnksIHJlc3VsdCkge1xuICAvLyBzb21lIG90aGVyIHNlcnZpY2UgYWxyZWFkeSByZXR1cm5lZCByZXN1bHRcbiAgLy8gb3Igc2VydmljZSBpcyBkaXNhYmxlZFxuICByZXR1cm4gKHJlc3VsdCAmJiByZXN1bHQucGxhY2VzICYmIHJlc3VsdC5wbGFjZXMubGVuZ3RoKSB8fCAhb3B0aW9ucy5lbmFibGUocXVlcnksIHJlc3VsdCk7XG59XG5cbnZhciBzZXJ2aWNlcyA9IHtcbiAgYWxnb2xpYToge1xuICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9hbGdvbGlhJylcbiAgfSxcbiAgb3BlbmNhZ2U6IHtcbiAgICBpbml0OiByZXF1aXJlKCcuL3NlcnZpY2Uvb3BlbmNhZ2UnKVxuICB9LFxuICB0aWxlaG9zdGluZzoge1xuICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS90aWxlaG9zdGluZycpXG4gIH1cbn07XG5cbi8vZGVmYXVsdCB0aW1lb3V0IHRvIGNvbXBsZXRlIG9wZXJhdGlvblxudmFyIGRlZmF1bHRUaW1lb3V0ID0gMjAgKiAxMDAwO1xudmFyIGlkID0gMDtcblxuZnVuY3Rpb24gZnVya290R2VvY29kZShvcHRpb25zKSB7XG4gIHZhciBvcGVyYXRpb25zO1xuXG4gIGZ1bmN0aW9uIGdlb2NvZGUocXVlcnksIGZuKSB7XG4gICAgdmFyIHRpbWVvdXRJZCwgcXVlcnlJZCwgb3AsIGFib3J0ZWQ7XG5cbiAgICBmdW5jdGlvbiBhYm9ydCgpIHtcbiAgICAgIGFib3J0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHRpbWVvdXRJZCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgdGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgLy8gY2FuY2VsIG91dHN0YW5kaW5nIHJlcXVlc3RzXG4gICAgICBvcGVyYXRpb25zLmFib3J0LmZvckVhY2goZnVuY3Rpb24gKGFib3J0KSB7XG4gICAgICAgIGFib3J0KHF1ZXJ5SWQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgZm4oKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgb3AgPSBxdWVyeS5sbCA/ICdyZXZlcnNlJyA6ICdmb3J3YXJkJztcbiAgICBpZiAoIShvcGVyYXRpb25zW29wXSAmJiBvcGVyYXRpb25zW29wXS5sZW5ndGgpKSB7XG4gICAgICBmbigpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlkICs9IDE7XG4gICAgcXVlcnlJZCA9IGlkO1xuICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoYWJvcnQsIG9wdGlvbnMudGltZW91dCk7XG4gICAgc3RyYXRlZ3kob3BlcmF0aW9uc1tvcF0sIHF1ZXJ5SWQsIHF1ZXJ5LCB7fSwgZnVuY3Rpb24gKGVyciwgcXVlcnlJZCwgcXVlcnksIHJlc3VsdCkge1xuICAgICAgaWYgKHRpbWVvdXRJZCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgdGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgaWYgKGVyciB8fCBhYm9ydGVkKSB7XG4gICAgICAgIHJldHVybiBmbigpO1xuICAgICAgfVxuICAgICAgZm4ocmVzdWx0KTtcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgYWJvcnQ6IGFib3J0XG4gICAgfTtcbiAgfVxuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICB0aW1lb3V0OiBkZWZhdWx0VGltZW91dCxcbiAgICBvcmRlcjogWydvcGVuY2FnZSddLFxuICAgIHNraXA6IHNraXBcbiAgfSk7XG4gIG9wZXJhdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBhYm9ydDogW11cbiAgfSk7XG4gIFsnZm9yd2FyZCcsICdyZXZlcnNlJ10ucmVkdWNlKGZ1bmN0aW9uIChvcHRpb25zLCBvcCkge1xuICAgIGlmICghb3BlcmF0aW9uc1tvcF0pIHtcbiAgICAgIG9wZXJhdGlvbnNbb3BdID0gb3B0aW9ucy5vcmRlci5yZWR1Y2UoZnVuY3Rpb24gKHJlc3VsdCwgbmFtZSkge1xuICAgICAgICB2YXIgc2VydmljZSA9IHNlcnZpY2VzW25hbWVdO1xuICAgICAgICBpZiAoc2VydmljZSAmJiBvcHRpb25zWyhuYW1lICsgJ19lbmFibGUnKV0pIHtcbiAgICAgICAgICBpZiAoIXNlcnZpY2Uuc2VydmljZSkge1xuICAgICAgICAgICAgc2VydmljZS5zZXJ2aWNlID0gc2VydmljZS5pbml0KHV0aWwuZGVmYXVsdHMoe1xuICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICBsaW1pdGVyOiBvcHRpb25zWyhuYW1lICsgJ19saW1pdGVyJyldLFxuICAgICAgICAgICAgICBlbmFibGU6IG9wdGlvbnNbKG5hbWUgKyAnX2VuYWJsZScpXSxcbiAgICAgICAgICAgICAgc2tpcDogc2VydmljZS5za2lwXG4gICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICBvcGVyYXRpb25zLmFib3J0LnB1c2goc2VydmljZS5zZXJ2aWNlLmFib3J0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcnZpY2Uuc2VydmljZVtvcF0gJiYgc2VydmljZS5zZXJ2aWNlLmdlb2NvZGUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHNlcnZpY2Uuc2VydmljZS5nZW9jb2RlLmJpbmQodW5kZWZpbmVkLCBvcCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfSwgb3B0aW9ucyk7XG5cbiAgZ2VvY29kZS5vcHRpb25zID0gb3BlcmF0aW9ucztcbiAgcmV0dXJuIGdlb2NvZGU7XG59XG4iLCJ2YXIgc3RhdGVzID0gcmVxdWlyZSgnLi4vc3RhdGVzJyk7XG52YXIgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIGlkKSB7XG4gIGlmIChrZXkgJiYgaWQpIHtcbiAgICB1cmwgKz0gJz94LWFsZ29saWEtYXBpLWtleT0nICsga2V5ICsgJyZ4LWFsZ29saWEtYXBwbGljYXRpb24taWQ9JyArIGlkO1xuICB9XG4gIHJldHVybiB1cmw7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KG9wLCBxdWVyeSkge1xuICB2YXIgcmVxID0ge1xuICAgIHF1ZXJ5OiBxdWVyeS5hZGRyZXNzIHx8IHF1ZXJ5LnBsYWNlLFxuICAgIGxhbmd1YWdlOiBxdWVyeS5sYW5nID8gcXVlcnkubGFuZy5zcGxpdCgnXycpLnBvcCgpIDogJ2VuJyxcbiAgICBhcm91bmRMYXRMbmdWaWFJUDogZmFsc2VcbiAgfTtcbiAgaWYgKHF1ZXJ5LmJvdW5kcykge1xuICAgIHJlcS5hcm91bmRMYXRMbmcgPSBtaWQocXVlcnkuYm91bmRzWzBdWzFdLCBxdWVyeS5ib3VuZHNbMV1bMV0pICtcbiAgICAgICcsJyArIG1pZChxdWVyeS5ib3VuZHNbMF1bMF0sIHF1ZXJ5LmJvdW5kc1swXVsxXSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmFkZHJlc3MpIHtcbiAgICByZXEudHlwZSA9ICdhZGRyZXNzJztcbiAgfVxuICByZXR1cm4gcmVxO1xufVxuXG5mdW5jdGlvbiBnZXRTdGF0dXMoZXJyLCByZXNwb25zZSkge1xuICBpZiAoIShyZXNwb25zZSAmJiByZXNwb25zZS5uYkhpdHMpKSB7XG4gICAgcmV0dXJuIHN0YXR1cy5lbXB0eTtcbiAgfVxuICByZXR1cm4gc3RhdHVzLnN1Y2Nlc3M7XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NSZXNwb25zZShyZXNwb25zZSwgcXVlcnksIHJlc3VsdCkge1xuICBpZiAoIShyZXNwb25zZSAmJiByZXNwb25zZS5oaXRzICYmIHJlc3BvbnNlLmhpdHMubGVuZ3RoKSkge1xuICAgIHJldHVybjtcbiAgfVxuICByZXN1bHQucGxhY2VzID0gcmVzcG9uc2UuaGl0cy5tYXAoZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgIHZhciBnZW9tID0gcmVzdWx0Ll9nZW9sb2MsIHJlcyA9IHtcbiAgICAgIGxsOiBbIGdlb20ubG5nLCBnZW9tLmxhdCBdXG4gICAgfSwgYWRkciA9IFtdO1xuICAgIGlmIChyZXN1bHQuaXNfaGlnaHdheSkge1xuICAgICAgcmVzLnR5cGUgPSAncm9hZCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKHJlc3VsdC5fdGFncyAmJiByZXN1bHQuX3RhZ3MubGVuZ3RoKXtcbiAgICAgIHJlcy50eXBlID0gcmVzdWx0Ll90YWdzWzBdO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LmxvY2FsZV9uYW1lcyAmJiByZXN1bHQubG9jYWxlX25hbWVzLmxlbmd0aCkge1xuICAgICAgaWYgKHJlcy50eXBlID09PSAncm9hZCcpIHtcbiAgICAgICAgcmVzLnN0cmVldCA9IHJlc3VsdC5sb2NhbGVfbmFtZXNbMF07XG4gICAgICAgIGFkZHIucHVzaChyZXMuc3RyZWV0KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICByZXMucGxhY2UgPSByZXN1bHQubG9jYWxlX25hbWVzWzBdO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocmVzdWx0LmNpdHkgJiYgcmVzdWx0LmNpdHkubGVuZ3RoKSB7XG4gICAgICByZXMudG93biA9IHJlc3VsdC5jaXR5WzBdO1xuICAgICAgYWRkci5wdXNoKHJlcy50b3duKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC5jb3VudHkgJiYgcmVzdWx0LmNvdW50eS5sZW5ndGgpIHtcbiAgICAgIHJlcy5jb3VudHkgPSByZXN1bHQuY291bnR5WzBdO1xuICAgICAgaWYgKCFyZXMudG93bikge1xuICAgICAgICBhZGRyLnB1c2gocmVzLmNvdW50eSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChyZXN1bHQuYWRtaW5pc3RyYXRpdmUgJiYgcmVzdWx0LmFkbWluaXN0cmF0aXZlLmxlbmd0aCkge1xuICAgICAgcmVzLnByb3ZpbmNlID0gc3RhdGVzW3Jlc3VsdC5hZG1pbmlzdHJhdGl2ZVswXV0gfHwgcmVzdWx0LmFkbWluaXN0cmF0aXZlWzBdO1xuICAgICAgYWRkci5wdXNoKHJlcy5wcm92aW5jZSk7XG4gICAgfVxuICAgIGlmIChyZXN1bHQuY291bnRyeSkge1xuICAgICAgcmVzLmNvdW50cnkgPSByZXN1bHQuY291bnRyeTtcbiAgICAgIGlmIChyZXMuY291bnRyeSA9PT0gJ1VuaXRlZCBTdGF0ZXMgb2YgQW1lcmljYScpIHtcbiAgICAgICAgcmVzLmNvdW50cnkgPSAnVVNBJztcbiAgICAgIH1cbiAgICAgIGFkZHIucHVzaChyZXMuY291bnRyeSk7XG4gICAgfVxuICAgIHJlcy5hZGRyZXNzID0gYWRkci5qb2luKCcsICcpO1xuICAgIHJldHVybiByZXM7XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcblxuICBpZiAob3B0aW9ucy5hbGdvbGlhX3BhcmFtZXRlcnMpIHtcbiAgICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCBvcHRpb25zLmFsZ29saWFfcGFyYW1ldGVycyk7XG4gIH1cbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcG9zdDogdHJ1ZSxcbiAgICB1cmw6IGdldFVybChvcHRpb25zLmFsZ29saWFfdXJsIHx8ICdodHRwczovL3BsYWNlcy1kc24uYWxnb2xpYS5uZXQvMS9wbGFjZXMvcXVlcnknLFxuICAgICAgb3B0aW9ucy5hbGdvbGlhX2tleSxcbiAgICAgIG9wdGlvbnMuYWxnb2xpYV9hcHBfaWQpLFxuICAgIHN0YXR1czogZ2V0U3RhdHVzLFxuICAgIHByZXBhcmVSZXF1ZXN0OiBwcmVwYXJlUmVxdWVzdCxcbiAgICBwcm9jZXNzUmVzcG9uc2U6IHByb2Nlc3NSZXNwb25zZVxuICB9KTtcbiAgcmV0dXJuIHJlcXVpcmUoJy4uJykob3B0aW9ucyk7XG59XG5cbmZ1bmN0aW9uIG1pZCh2MSwgdjIpIHtcbiAgcmV0dXJuICh2MSArIHYyKSAvIDI7XG59IiwidmFyIGZldGNoYWdlbnQgPSByZXF1aXJlKCdmZXRjaGFnZW50Jyk7XG52YXIgc3RhdHVzID0gcmVxdWlyZSgnLi9zdGF0dXMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpKCdmdXJrb3Q6Z2VvY29kZTpzZXJ2aWNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcblxudmFyIGxpbWl0ZXJzID0ge307XG5cbnZhciBFUlJPUiA9ICdpbnB1dCBlcnJvcic7XG5cbmZ1bmN0aW9uIHJlcXVlc3QodXJsLCByZXEsIGZuKSB7XG4gIHZhciBvcHRpb25zID0gdGhpcywgZmEgPSBmZXRjaGFnZW50O1xuICBpZiAob3B0aW9ucy5wb3N0KSB7XG4gICAgZmEgPSBmYS5wb3N0KHVybCkuc2VuZChyZXEpO1xuICB9XG4gIGVsc2Uge1xuICAgIGZhID0gZmEuZ2V0KHVybCkucXVlcnkocmVxKTtcbiAgfVxuICByZXR1cm4gZmFcbiAgICAuc2V0KCdhY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpXG4gICAgLmVuZChmbik7XG59XG5cbmZ1bmN0aW9uIGluaXRVcmwodXJsKSB7XG4gIGlmICh0eXBlb2YgdXJsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIHVybDtcbiAgfVxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB1cmw7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGluaXQob3B0aW9ucykge1xuICB2YXIgbGltaXRlciwgaG9sZFJlcXVlc3RzLCBvdXRzdGFuZGluZyA9IHt9O1xuXG4gIGZ1bmN0aW9uIGFib3J0KHF1ZXJ5SWQpIHtcbiAgICBkZWJ1ZygnYWJvcnQnLCBxdWVyeUlkKTtcbiAgICBpZiAoIW91dHN0YW5kaW5nW3F1ZXJ5SWRdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGNhbmNlbCBsYXRlciByZXF1ZXN0IGlmIHNjaGVkdWxlZFxuICAgIGlmIChvdXRzdGFuZGluZ1txdWVyeUlkXS5sYXRlclRpbWVvdXRJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmxhdGVyVGltZW91dElkKTtcbiAgICB9XG4gICAgLy8gY2FuY2VsIHJlcXVlc3QgaW4gcHJvZ3Jlc3NcbiAgICBpZiAob3V0c3RhbmRpbmdbcXVlcnlJZF0ucmVxSW5Qcm9ncmVzcykge1xuICAgICAgb3V0c3RhbmRpbmdbcXVlcnlJZF0ucmVxSW5Qcm9ncmVzcy5hYm9ydCgpO1xuICAgIH1cbiAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5jYWxsYmFjayhFUlJPUik7XG4gIH1cblxuICBmdW5jdGlvbiBnZW9jb2RlKG9wLCBxdWVyeUlkLCBxdWVyeSwgcmVzdWx0LCBmbikge1xuXG4gICAgZnVuY3Rpb24gcmVxdWVzdExhdGVyKCkge1xuICAgICAgb3V0c3RhbmRpbmdbcXVlcnlJZF0ubGF0ZXJUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKG91dHN0YW5kaW5nW3F1ZXJ5SWRdKSB7XG4gICAgICAgICAgZGVsZXRlIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmxhdGVyVGltZW91dElkO1xuICAgICAgICB9XG4gICAgICAgIGV4ZWN1dGVRdWVyeSgpO1xuICAgICAgfSwgb3B0aW9ucy5wZW5hbHR5VGltZW91dCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXhlY3V0ZVF1ZXJ5KGNhbGxiYWNrKSB7XG4gICAgICB2YXIgcmVxO1xuXG4gICAgICBpZiAoIW91dHN0YW5kaW5nW3F1ZXJ5SWRdKSB7XG4gICAgICAgIC8vIHF1ZXJ5IGhhcyBiZWVuIGFib3J0ZWRcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGhvbGRSZXF1ZXN0cykge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgIH1cbiAgICAgIHJlcSA9IG9wdGlvbnMucHJlcGFyZVJlcXVlc3Qob3AsIHF1ZXJ5KTtcbiAgICAgIGlmICghcmVxKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgICAgaWYgKHJlcSA9PT0gdHJ1ZSkge1xuICAgICAgICByZXEgPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGxpbWl0ZXIudHJpZ2dlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgICAvLyBxdWVyeSBoYXMgYmVlbiBhYm9ydGVkXG4gICAgICAgICAgbGltaXRlci5za2lwKCk7IC8vIGltbWVkaWF0ZWx5IHByb2Nlc3MgdGhlIG5leHQgcmVxdWVzdCBpbiB0aGUgcXVldWVcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcXVlcnkuc3RhdHMgPSBxdWVyeS5zdGF0cyB8fCBbXTtcbiAgICAgICAgcXVlcnkuc3RhdHMucHVzaChvcHRpb25zLm5hbWUpO1xuICAgICAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzID0gb3B0aW9ucy5yZXF1ZXN0KG9wdGlvbnMudXJsKG9wLCBxdWVyeSksIHJlcSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgICAgICB2YXIgc3QsIHJlcztcbiAgICAgICAgICBpZiAoIW91dHN0YW5kaW5nW3F1ZXJ5SWRdKSB7XG4gICAgICAgICAgICAvLyBxdWVyeSBoYXMgYmVlbiBhYm9ydGVkXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlbGV0ZSBvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzO1xuICAgICAgICAgIHN0ID0gb3B0aW9ucy5zdGF0dXMoZXJyLCByZXNwb25zZSk7XG4gICAgICAgICAgaWYgKHN0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHNob3VsZG4ndCBoYXBwZW4gKGJ1ZyBvciB1bmV4cGVjdGVkIHJlc3BvbnNlIGZvcm1hdClcbiAgICAgICAgICAgIC8vIHRyZWF0IGl0IGFzIG5vIHJlc3VsdFxuICAgICAgICAgICAgc3QgPSBzdGF0dXMuZW1wdHk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzdCA9PT0gc3RhdHVzLmZhaWx1cmUpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGV2ZXIgYXNrIGFnYWluXG4gICAgICAgICAgICBob2xkUmVxdWVzdHMgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzdCA9PT0gc3RhdHVzLmVycm9yKSB7XG4gICAgICAgICAgICAvLyB0cnkgYWdhaW4gbGF0ZXJcbiAgICAgICAgICAgIGxpbWl0ZXIucGVuYWx0eSgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3RMYXRlcigpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzdCA9PT0gc3RhdHVzLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHJlcyA9IG9wdGlvbnMucHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlLCBxdWVyeSwgcmVzdWx0IHx8IHt9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2FsbGJhY2sodW5kZWZpbmVkLCByZXMpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIG91dHN0YW5kaW5nW3F1ZXJ5SWRdID0ge1xuICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkge1xuICAgICAgICB2YXIgZmluaXNoZWQgPSBCb29sZWFuKHJlc3VsdCk7XG4gICAgICAgIGRlbGV0ZSBvdXRzdGFuZGluZ1txdWVyeUlkXTtcbiAgICAgICAgcmVzdWx0ID0gcmVzdWx0IHx8IHt9O1xuICAgICAgICByZXN1bHQuc3RhdHMgPSBxdWVyeS5zdGF0cztcbiAgICAgICAgcmVzdWx0LnByb3ZpZGVyID0gb3B0aW9ucy5uYW1lO1xuICAgICAgICBmbihlcnIsIGZpbmlzaGVkLCBxdWVyeUlkLCBxdWVyeSwgcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGV4ZWN1dGVRdWVyeShvdXRzdGFuZGluZ1txdWVyeUlkXS5jYWxsYmFjayk7XG4gIH1cblxuICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCB7XG4gICAgaW50ZXJ2YWw6IDM0MCxcbiAgICBwZW5hbHR5SW50ZXJ2YWw6IDIwMDAsXG4gICAgbGltaXRlcjogbGltaXRlcnNbb3B0aW9ucy5uYW1lXSxcbiAgICByZXF1ZXN0OiByZXF1ZXN0LFxuICAgIGFib3J0OiBhYm9ydFxuICB9KTtcbiAgb3B0aW9ucy51cmwgPSBpbml0VXJsKG9wdGlvbnMudXJsKTtcbiAgbGltaXRlcnNbb3B0aW9ucy5uYW1lXSA9IG9wdGlvbnMubGltaXRlciB8fCByZXF1aXJlKCdsaW1pdGVyLWNvbXBvbmVudCcpKG9wdGlvbnMuaW50ZXJ2YWwsIG9wdGlvbnMucGVuYWx0eUludGVydmFsKTtcbiAgbGltaXRlciA9IGxpbWl0ZXJzW29wdGlvbnMubmFtZV07XG4gIFxuICByZXR1cm4ge1xuICAgIGZvcndhcmQ6IG9wdGlvbnMuZm9yd2FyZCxcbiAgICByZXZlcnNlOiBvcHRpb25zLnJldmVyc2UsXG4gICAgZ2VvY29kZTogZ2VvY29kZSxcbiAgICBhYm9ydDogb3B0aW9ucy5hYm9ydFxuICB9O1xufVxuIiwidmFyIHN0YXR1cyA9IHJlcXVpcmUoJy4uL3N0YXR1cycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbnZhciBjb2RlMnN0YXR1cyA9IHtcbiAgMjAwOiBzdGF0dXMuc3VjY2VzcywgLy8gT0sgKHplcm8gb3IgbW9yZSByZXN1bHRzIHdpbGwgYmUgcmV0dXJuZWQpXG4gIDQwMDogc3RhdHVzLmVtcHR5LCAgIC8vIEludmFsaWQgcmVxdWVzdCAoYmFkIHJlcXVlc3Q7IGEgcmVxdWlyZWQgcGFyYW1ldGVyIGlzIG1pc3Npbmc7IGludmFsaWQgY29vcmRpbmF0ZXMpXG4gIDQwMjogc3RhdHVzLmZhaWx1cmUsIC8vIFZhbGlkIHJlcXVlc3QgYnV0IHF1b3RhIGV4Y2VlZGVkIChwYXltZW50IHJlcXVpcmVkKVxuICA0MDM6IHN0YXR1cy5mYWlsdXJlLCAvLyBJbnZhbGlkIG9yIG1pc3NpbmcgYXBpIGtleSAoZm9yYmlkZGVuKVxuICA0MDQ6IHN0YXR1cy5mYWlsdXJlLCAvLyBJbnZhbGlkIEFQSSBlbmRwb2ludFxuICA0MDg6IHN0YXR1cy5lcnJvciwgICAvLyBUaW1lb3V0OyB5b3UgY2FuIHRyeSBhZ2FpblxuICA0MTA6IHN0YXR1cy5lbXB0eSwgICAvLyBSZXF1ZXN0IHRvbyBsb25nXG4gIDQyOTogc3RhdHVzLmVycm9yLCAgIC8vIFRvbyBtYW55IHJlcXVlc3RzICh0b28gcXVpY2tseSwgcmF0ZSBsaW1pdGluZylcbiAgNTAzOiBzdGF0dXMuZW1wdHkgICAgLy8gSW50ZXJuYWwgc2VydmVyIGVycm9yXG59O1xuXG52YXIgZ2VvdHlwZXMgPSBbXG4gICdyb2FkJyxcbiAgJ25laWdoYm91cmhvb2QnLFxuICAnc3VidXJiJyxcbiAgJ3Rvd24nLFxuICAnY2l0eScsXG4gICdjb3VudHknLFxuICAnc3RhdGUnLFxuICAnY291bnRyeSdcbl0ucmVkdWNlKGZ1bmN0aW9uIChyZXN1bHQsIHR5cGUpIHtcbiAgcmVzdWx0W3R5cGVdID0gdHlwZTtcbiAgcmV0dXJuIHJlc3VsdDtcbn0sIHt9KTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG4vLyByZXNwb25zZSBjb2RlczogaHR0cHM6Ly9nZW9jb2Rlci5vcGVuY2FnZWRhdGEuY29tL2FwaSNjb2Rlc1xuZnVuY3Rpb24gZ2V0U3RhdHVzKGVyciwgcmVzcG9uc2UpIHtcbiAgdmFyIGNvZGUgPSByZXNwb25zZSAmJiByZXNwb25zZS5zdGF0dXMgJiYgcmVzcG9uc2Uuc3RhdHVzLmNvZGU7XG4gIGlmICghcmVzcG9uc2UpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgY29kZSA9IGNvZGUyc3RhdHVzW2NvZGVdO1xuICBpZiAoY29kZSA9PT0gc3RhdHVzLnN1Y2Nlc3MgJiYgIShyZXNwb25zZS5yZXN1bHRzICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoKSkge1xuICAgIGNvZGUgPSBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIGNvZGUgfHwgc3RhdHVzLmVycm9yO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIG9wLCBxdWVyeSkge1xuICB2YXIgcTtcbiAgaWYgKG9wID09PSAnZm9yd2FyZCcpIHtcbiAgICBxID0gKHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UpLnJlcGxhY2UoLyAvZywgJysnKS5yZXBsYWNlKC8sL2csICclMkMnKTtcbiAgfVxuICBlbHNlIHtcbiAgICBxID0gcXVlcnkubGxbMV0gKyAnKycgKyBxdWVyeS5sbFswXTtcbiAgfVxuICB1cmwgKz0gJz9xPScgKyBxO1xuICBpZiAocXVlcnkuYm91bmRzKSB7XG4gICAgdXJsICs9ICcmYm91bmRzPScgKyBxdWVyeS5ib3VuZHMubWFwKGpvaW4pLmpvaW4oJywnKTtcbiAgfVxuICBpZiAocXVlcnkubGFuZykge1xuICAgIHVybCArPSAnJmxhbmd1YWdlPScgKyBxdWVyeS5sYW5nO1xuICB9XG4gIHVybCArPSAnJm5vX2Fubm90YXRpb25zPTEnO1xuICByZXR1cm4gdXJsICsgJyZrZXk9JyArIGtleTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVJlcXVlc3QoKSB7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcblxuICBmdW5jdGlvbiBwcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQpIHtcbiAgICBpZiAoIShyZXNwb25zZSAmJiByZXNwb25zZS5yZXN1bHRzICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXN1bHQucGxhY2VzID0gcmVzcG9uc2UucmVzdWx0cy5tYXAoZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgdmFyIGNvbXBvbmVudHMgPSByZXN1bHQuY29tcG9uZW50cywgZ2VvbSA9IHJlc3VsdC5nZW9tZXRyeSwgcmVzID0ge1xuICAgICAgICAgIGxsOiBbIGdlb20ubG5nLCBnZW9tLmxhdCBdXG4gICAgICB9LCBhZGRyO1xuICAgICAgaWYgKGNvbXBvbmVudHMuX3R5cGUpIHtcbiAgICAgICAgcmVzLnR5cGUgPSBjb21wb25lbnRzLl90eXBlO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHNbY29tcG9uZW50cy5fdHlwZV0pIHtcbiAgICAgICAgcmVzLnBsYWNlID0gY29tcG9uZW50c1tjb21wb25lbnRzLl90eXBlXTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLmhvdXNlX251bWJlcikge1xuICAgICAgICByZXMuaG91c2UgPSBjb21wb25lbnRzLmhvdXNlX251bWJlcjtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLnJvYWQgfHwgY29tcG9uZW50cy5wZWRlc3RyaWFuKSB7XG4gICAgICAgIHJlcy5zdHJlZXQgPSBjb21wb25lbnRzLnJvYWQgfHwgY29tcG9uZW50cy5wZWRlc3RyaWFuO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMubmVpZ2hib3VyaG9vZCB8fCBjb21wb25lbnRzLnZpbGxhZ2UpIHtcbiAgICAgICAgcmVzLmNvbW11bml0eSA9IGNvbXBvbmVudHMubmVpZ2hib3VyaG9vZCB8fCBjb21wb25lbnRzLnZpbGxhZ2U7XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy50b3duIHx8IGNvbXBvbmVudHMuY2l0eSkge1xuICAgICAgICByZXMudG93biA9IGNvbXBvbmVudHMudG93biB8fCBjb21wb25lbnRzLmNpdHk7XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5jb3VudHkpIHtcbiAgICAgICAgcmVzLmNvdW50eSA9IGNvbXBvbmVudHMuY291bnR5O1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMuc3RhdGVfY29kZSkge1xuICAgICAgICByZXMucHJvdmluY2UgPSBjb21wb25lbnRzLnN0YXRlX2NvZGU7XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5jb3VudHJ5KSB7XG4gICAgICAgIHJlcy5jb3VudHJ5ID0gY29tcG9uZW50cy5jb3VudHJ5O1xuICAgICAgICBpZiAocmVzLmNvdW50cnkgPT09ICdVbml0ZWQgU3RhdGVzIG9mIEFtZXJpY2EnKSB7XG4gICAgICAgICAgcmVzLmNvdW50cnkgPSAnVVNBJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdC5mb3JtYXR0ZWQpIHtcbiAgICAgICAgcmVzLmFkZHJlc3MgPSByZXN1bHQuZm9ybWF0dGVkO1xuICAgICAgICBpZiAoIWdlb3R5cGVzW3Jlcy50eXBlXSkge1xuICAgICAgICAgIGFkZHIgPSByZXMuYWRkcmVzcy5zcGxpdCgnLCAnKTtcbiAgICAgICAgICBpZiAoYWRkci5sZW5ndGggPiAxICYmIGFkZHJbMF0gPT09IHJlcy5wbGFjZSkge1xuICAgICAgICAgICAgYWRkci5zaGlmdCgpO1xuICAgICAgICAgICAgcmVzLmFkZHJlc3MgPSBhZGRyLmpvaW4oJywgJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChyZXMuY291bnRyeSA9PT0gJ1VTQScpIHtcbiAgICAgICAgICByZXMuYWRkcmVzcyA9IHJlcy5hZGRyZXNzLnJlcGxhY2UoJ1VuaXRlZCBTdGF0ZXMgb2YgQW1lcmljYScsICdVU0EnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGZvcndhcmQ6IHRydWUsXG4gICAgcmV2ZXJzZTogdHJ1ZSxcbiAgICB1cmw6IGdldFVybC5iaW5kKHVuZGVmaW5lZCxcbiAgICAgICAgb3B0aW9ucy5vcGVuY2FnZV91cmwgfHwgJ2h0dHBzOi8vYXBpLm9wZW5jYWdlZGF0YS5jb20vZ2VvY29kZS92MS9qc29uJyxcbiAgICAgICAgb3B0aW9ucy5vcGVuY2FnZV9rZXkpLFxuICAgIHN0YXR1czogZ2V0U3RhdHVzLFxuICAgIHByZXBhcmVSZXF1ZXN0OiBwcmVwYXJlUmVxdWVzdCxcbiAgICBwcm9jZXNzUmVzcG9uc2U6IHByb2Nlc3NSZXNwb25zZVxuICB9KTtcbiAgaWYgKG9wdGlvbnMub3BlbmNhZ2VfcGFyYW1ldGVycykge1xuICAgIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIG9wdGlvbnMub3BlbmNhZ2VfcGFyYW1ldGVycyk7XG4gIH1cbiAgcmV0dXJuIHJlcXVpcmUoJy4uJykob3B0aW9ucyk7XG59XG5cbmZ1bmN0aW9uIGpvaW4obGwpIHtcbiAgcmV0dXJuIGxsLmpvaW4oJywnKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgICBcIkFsYWJhbWFcIjogXCJBTFwiLFxuICAgIFwiQWxhc2thXCI6IFwiQUtcIixcbiAgICBcIkFyaXpvbmFcIjogXCJBWlwiLFxuICAgIFwiQXJrYW5zYXNcIjogXCJBUlwiLFxuICAgIFwiQ2FsaWZvcm5pYVwiOiBcIkNBXCIsXG4gICAgXCJDb2xvcmFkb1wiOiBcIkNPXCIsXG4gICAgXCJDb25uZWN0aWN1dFwiOiBcIkNUXCIsXG4gICAgXCJEZWxhd2FyZVwiOiBcIkRFXCIsXG4gICAgXCJEaXN0cmljdCBvZiBDb2x1bWJpYVwiOiBcIkRDXCIsXG4gICAgXCJGbG9yaWRhXCI6IFwiRkxcIixcbiAgICBcIkdlb3JnaWFcIjogXCJHQVwiLFxuICAgIFwiSGF3YWlpXCI6IFwiSElcIixcbiAgICBcIklkYWhvXCI6IFwiSURcIixcbiAgICBcIklsbGlub2lzXCI6IFwiSUxcIixcbiAgICBcIkluZGlhbmFcIjogXCJJTlwiLFxuICAgIFwiSW93YVwiOiBcIklBXCIsXG4gICAgXCJLYW5zYXNcIjogXCJLU1wiLFxuICAgIFwiS2VudHVja3lcIjogXCJLWVwiLFxuICAgIFwiTG91aXNpYW5hXCI6IFwiTEFcIixcbiAgICBcIk1haW5lXCI6IFwiTUVcIixcbiAgICBcIk1vbnRhbmFcIjogXCJNVFwiLFxuICAgIFwiTmVicmFza2FcIjogXCJORVwiLFxuICAgIFwiTmV2YWRhXCI6IFwiTlZcIixcbiAgICBcIk5ldyBIYW1wc2hpcmVcIjogXCJOSFwiLFxuICAgIFwiTmV3IEplcnNleVwiOiBcIk5KXCIsXG4gICAgXCJOZXcgTWV4aWNvXCI6IFwiTk1cIixcbiAgICBcIk5ldyBZb3JrXCI6IFwiTllcIixcbiAgICBcIk5vcnRoIENhcm9saW5hXCI6IFwiTkNcIixcbiAgICBcIk5vcnRoIERha290YVwiOiBcIk5EXCIsXG4gICAgXCJPaGlvXCI6IFwiT0hcIixcbiAgICBcIk9rbGFob21hXCI6IFwiT0tcIixcbiAgICBcIk9yZWdvblwiOiBcIk9SXCIsXG4gICAgXCJNYXJ5bGFuZFwiOiBcIk1EXCIsXG4gICAgXCJNYXNzYWNodXNldHRzXCI6IFwiTUFcIixcbiAgICBcIk1pY2hpZ2FuXCI6IFwiTUlcIixcbiAgICBcIk1pbm5lc290YVwiOiBcIk1OXCIsXG4gICAgXCJNaXNzaXNzaXBwaVwiOiBcIk1TXCIsXG4gICAgXCJNaXNzb3VyaVwiOiBcIk1PXCIsXG4gICAgXCJQZW5uc3lsdmFuaWFcIjogXCJQQVwiLFxuICAgIFwiUmhvZGUgSXNsYW5kXCI6IFwiUklcIixcbiAgICBcIlNvdXRoIENhcm9saW5hXCI6IFwiU0NcIixcbiAgICBcIlNvdXRoIERha290YVwiOiBcIlNEXCIsXG4gICAgXCJUZW5uZXNzZWVcIjogXCJUTlwiLFxuICAgIFwiVGV4YXNcIjogXCJUWFwiLFxuICAgIFwiVXRhaFwiOiBcIlVUXCIsXG4gICAgXCJWZXJtb250XCI6IFwiVlRcIixcbiAgICBcIlZpcmdpbmlhXCI6IFwiVkFcIixcbiAgICBcIldhc2hpbmd0b25cIjogXCJXQVwiLFxuICAgIFwiV2VzdCBWaXJnaW5pYVwiOiBcIldWXCIsXG4gICAgXCJXaXNjb25zaW5cIjogXCJXSVwiLFxuICAgIFwiV3lvbWluZ1wiOiBcIldZXCIsXG5cbiAgICBcIkFsYmVydGFcIjogXCJBQlwiLFxuICAgIFwiQnJpdGlzaCBDb2x1bWJpYVwiOiBcIkJDXCIsXG4gICAgXCJNYW5pdG9iYVwiOiBcIk1CXCIsXG4gICAgXCJOZXcgQnJ1bnN3aWNrXCI6IFwiTkJcIixcbiAgICBcIk5ld2ZvdW5kbGFuZCBhbmQgTGFicmFkb3JcIjogXCJOTFwiLFxuICAgIFwiTm9ydGh3ZXN0IFRlcnJpdG9yaWVzXCI6IFwiTlRcIixcbiAgICBcIk5vdmEgU2NvdGlhXCI6IFwiTlNcIixcbiAgICBcIk51bmF2dXRcIjogXCJOVVwiLFxuICAgIFwiT250YXJpb1wiOiBcIk9OXCIsXG4gICAgXCJQcmluY2UgRWR3YXJkIElzbGFuZFwiOiBcIlBFXCIsXG4gICAgXCJRdWViZWNcIjogXCJRQ1wiLFxuICAgIFwiU2Fza2F0Y2hld2FuXCI6IFwiU0tcIixcbiAgICBcIll1a29uXCI6IFwiWVRcIlxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIHN1Y2Nlc3M6ICdzdWNjZXNzJywgLy8gc3VjY2Vzc1xuICBmYWlsdXJlOiAnZmFpbHVyZScsIC8vIHVsdGltYXRlIGZhaWx1cmVcbiAgZXJyb3I6ICdlcnJvcicsIC8vIHRlbXBvcmFyeSBlcnJvclxuICBlbXB0eTogJ2VtcHR5JyAvLyBubyByZXN1bHRcbn07XG4iLCIvKlxuICogaHR0cHM6Ly9jbG91ZC5tYXB0aWxlci5jb20vZ2VvY29kaW5nL1xuICovXG52YXIgc3RhdGVzID0gcmVxdWlyZSgnLi4vc3RhdGVzJyk7XG52YXIgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG4vLyByZXNwb25zZSBjb2RlczogaHR0cHM6Ly9nZW9jb2Rlci5vcGVuY2FnZWRhdGEuY29tL2FwaSNjb2Rlc1xuZnVuY3Rpb24gZ2V0U3RhdHVzKGVyciwgcmVzcG9uc2UpIHtcbiAgaWYgKCFyZXNwb25zZSkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoZXJyKSB7XG4gICAgcmV0dXJuIGVyci5zdGF0dXMgPyBzdGF0dXMuZXJyb3IgOiBzdGF0dXMuZmFpbHVyZTtcbiAgfVxuICBpZiAoIShyZXNwb25zZS5yZXN1bHRzICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoKSkge1xuICAgIHJldHVybiBzdGF0dXMuZW1wdHk7XG4gIH1cbiAgcmV0dXJuIHN0YXR1cy5zdWNjZXNzO1xufVxuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIG9wLCBxdWVyeSkge1xuICB2YXIgcTtcbiAgaWYgKG9wID09PSAnZm9yd2FyZCcpIHtcbiAgICBxID0gJ3EvJyArIGVuY29kZVVSSUNvbXBvbmVudChxdWVyeS5hZGRyZXNzIHx8IHF1ZXJ5LnBsYWNlKTtcbiAgfVxuICBlbHNlIHtcbiAgICBxID0gJ3IvJyArIHF1ZXJ5LmxsLmpvaW4oJy8nKTtcbiAgfVxuICByZXR1cm4gdXJsICsgcSArICcuanM/a2V5PScgKyBrZXk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG5cbiAgZnVuY3Rpb24gcHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlLCBxdWVyeSwgcmVzdWx0KSB7XG4gICAgaWYgKCEocmVzcG9uc2UgJiYgcmVzcG9uc2UucmVzdWx0cyAmJiByZXNwb25zZS5yZXN1bHRzLmxlbmd0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzdWx0LnBsYWNlcyA9IHJlc3BvbnNlLnJlc3VsdHMubWFwKGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgIHZhciByZXMgPSB7XG4gICAgICAgICAgbGw6IFsgcmVzdWx0LmxvbiwgcmVzdWx0LmxhdCBdXG4gICAgICB9LCBhZGRyO1xuICAgICAgaWYgKHJlc3VsdC50eXBlKSB7XG4gICAgICAgIHJlcy50eXBlID0gcmVzdWx0LnR5cGU7XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0Lm5hbWUpIHtcbiAgICAgICAgcmVzLnBsYWNlID0gcmVzdWx0Lm5hbWU7XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0LmhvdXNlbnVtYmVycykge1xuICAgICAgICByZXMuaG91c2UgPSByZXN1bHQuaG91c2VudW1iZXJzLnNwbGl0KCcsICcpLnNoaWZ0KCk7XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0LnN0cmVldCkge1xuICAgICAgICByZXMuc3RyZWV0ID0gcmVzdWx0LnN0cmVldDtcbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuY2l0eSkge1xuICAgICAgICByZXMudG93biA9IHJlc3VsdC5jaXR5O1xuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdC5jb3VudHkpIHtcbiAgICAgICAgcmVzLmNvdW50eSA9IHJlc3VsdC5jb3VudHk7XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0LnN0YXRlKSB7XG4gICAgICAgIHJlcy5wcm92aW5jZSA9IHN0YXRlc1tyZXN1bHQuc3RhdGVdIHx8IHJlc3VsdC5zdGF0ZTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuY291bnRyeSkge1xuICAgICAgICByZXMuY291bnRyeSA9IHJlc3VsdC5jb3VudHJ5O1xuICAgICAgICBpZiAocmVzLmNvdW50cnkgPT09ICdVbml0ZWQgU3RhdGVzIG9mIEFtZXJpY2EnKSB7XG4gICAgICAgICAgcmVzLmNvdW50cnkgPSAnVVNBJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdC5kaXNwbGF5X25hbWUpIHtcbiAgICAgICAgcmVzLmFkZHJlc3MgPSByZXN1bHQuZGlzcGxheV9uYW1lO1xuICAgICAgICBpZiAocmVzLnN0cmVldCAhPT0gcmVzLnBsYWNlKSB7XG4gICAgICAgICAgYWRkciA9IHJlcy5hZGRyZXNzLnNwbGl0KCcsICcpO1xuICAgICAgICAgIGlmIChhZGRyLmxlbmd0aCA+IDEgJiYgYWRkclswXSA9PT0gcmVzLnBsYWNlKSB7XG4gICAgICAgICAgICBhZGRyLnNoaWZ0KCk7XG4gICAgICAgICAgICByZXMuYWRkcmVzcyA9IGFkZHIuam9pbignLCAnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlcy5jb3VudHJ5ID09PSAnVVNBJykge1xuICAgICAgICAgIHJlcy5hZGRyZXNzID0gcmVzLmFkZHJlc3MucmVwbGFjZSgnVW5pdGVkIFN0YXRlcyBvZiBBbWVyaWNhJywgJ1VTQScpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXMuY291bnRyeSA9PT0gJ1VTQScgfHwgcmVzLmNvdXRyeSA9PT0gJ0NhbmFkYScpIHtcbiAgICAgICAgICByZXMuYWRkcmVzcyA9IHJlcy5hZGRyZXNzLnJlcGxhY2UocmVzdWx0LnN0YXRlLCByZXMucHJvdmluY2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCB7XG4gICAgZm9yd2FyZDogdHJ1ZSxcbiAgICByZXZlcnNlOiB0cnVlLFxuICAgIHVybDogZ2V0VXJsLmJpbmQodW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zLnRpbGVob3N0aW5nX3VybCB8fCAnaHR0cHM6Ly9nZW9jb2Rlci50aWxlaG9zdGluZy5jb20vJyxcbiAgICAgICAgb3B0aW9ucy50aWxlaG9zdGluZ19rZXkpLFxuICAgIHN0YXR1czogZ2V0U3RhdHVzLFxuICAgIHByZXBhcmVSZXF1ZXN0OiBwcmVwYXJlUmVxdWVzdCxcbiAgICBwcm9jZXNzUmVzcG9uc2U6IHByb2Nlc3NSZXNwb25zZVxuICB9KTtcbiAgcmV0dXJuIHJlcXVpcmUoJy4uJykob3B0aW9ucyk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgZGVmYXVsdHM6IGRlZmF1bHRzXG59O1xuXG5mdW5jdGlvbiBkZWZhdWx0cyhvYmosIHNvdXJjZSkge1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgc291cmNlLCBvYmopO1xufVxuIiwidmFyIHdhdGVyZmFsbCA9IHJlcXVpcmUoJ3J1bi13YXRlcmZhbGwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdHJhdGVneTtcblxudmFyIEVORCA9ICdlbmQgcHJvY2Vzc2luZyc7XG5cbi8qKlxuICogUHJvY2VzcyB0aGUgbGlzdCBvZiB0YXNrcyBvbmUgYnkgb25lLGVuZGluZyBwcm9jZXNzaW5nIGFzIHNvb24gYXMgb25lIHRhc2sgc2F5cyBzby5cbiAqIFRoZSBuZXh0IHRhc2sgaXMgaW52b2tlZCB3aXRoIHBhcmFtZXRlcnMgc2V0IGJ5IHRoZSBwcmV2aW91cyB0YXNrLlxuICogSXQgaXMgYSBjcm9zcyBiZXR3ZWVuIGFzeW5jIG9wZXJhdGlvbnM6IHdhdGVyZmFsbCBhbmQgc29tZVxuICogQHBhcmFtIHRhc2tzIGxpc3Qgb2YgdGFza3NcbiAqIEBwYXJhbSAuLi4gYW55IG51bWJlciBvZiBwYXJhbWV0ZXJzIHRvIGJlIHBhc3NlZCB0byB0aGUgZmlyc3QgdGFza1xuICogQHBhcmFtIGNhbGxiYWNrIHRoZSBsYXN0IGFyZ3VtZW50IGlzIGFuIG9wdGlvbmFsIGNhbGxiYWNrIGNhbGxlZCBhZnRlciB0YXNrcyBoYXZlIGJlZW4gcHJvY2Vzc2VkO1xuICogICBjYWxsZWQgd2l0aCBlcnJvciBmb2xsb3dlZCBieSB0aGUgcGFyYW1ldGVycyBwYXNzZWQgZnJvbSB0aGUgbGFzdCBpbnZva2VkIHRhc2tcbiAqL1xuZnVuY3Rpb24gc3RyYXRlZ3kodGFza3MpIHtcbiAgdmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXSxcbiAgICBwYXJhbWV0ZXJzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwLCAtMSk7XG4gIHBhcmFtZXRlcnNbMF0gPSB1bmRlZmluZWQ7XG5cbiAgdGFza3MgPSB0YXNrcy5yZWR1Y2UoZnVuY3Rpb24gKHJlc3VsdCwgdGFzaykge1xuICAgIHJlc3VsdC5wdXNoKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV07XG4gICAgICAgIHBhcmFtZXRlcnMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDAsIC0xKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChmdW5jdGlvbiAoZXJyLCB0cnVlVmFsdWUpIHtcbiAgICAgICAgdmFyIHBhcmFtZXRlcnMgPSBbZXJyXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSk7XG4gICAgICAgIGlmICghZXJyICYmIHRydWVWYWx1ZSkge1xuICAgICAgICAgIC8vIGp1bXAgb3V0IG9mIHByb2Nlc3NpbmdcbiAgICAgICAgICBwYXJhbWV0ZXJzWzBdID0gRU5EO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrLmFwcGx5KHVuZGVmaW5lZCwgcGFyYW1ldGVycyk7XG4gICAgICB9KTtcbiAgICAgIHRhc2suYXBwbHkodW5kZWZpbmVkLCBwYXJhbWV0ZXJzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LCBbXG4gICAgZnVuY3Rpb24gKGZuKSB7XG4gICAgICBmbi5hcHBseSh1bmRlZmluZWQsIHBhcmFtZXRlcnMpO1xuICAgIH1cbiAgXSk7XG4gIHdhdGVyZmFsbCh0YXNrcywgZnVuY3Rpb24gKGVycikge1xuICAgIHZhciBwYXJhbWV0ZXJzID0gW2Vycl0uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGlmIChlcnIgPT09IEVORCkge1xuICAgICAgcGFyYW1ldGVyc1swXSA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgY2FsbGJhY2suYXBwbHkodW5kZWZpbmVkLCBwYXJhbWV0ZXJzKTtcbiAgfSk7XG59XG4iLCIvKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcbmV4cG9ydHMuc3RvcmFnZSA9ICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWVcbiAgICAgICAgICAgICAgICYmICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWUuc3RvcmFnZVxuICAgICAgICAgICAgICAgICAgPyBjaHJvbWUuc3RvcmFnZS5sb2NhbFxuICAgICAgICAgICAgICAgICAgOiBsb2NhbHN0b3JhZ2UoKTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICcjMDAwMENDJywgJyMwMDAwRkYnLCAnIzAwMzNDQycsICcjMDAzM0ZGJywgJyMwMDY2Q0MnLCAnIzAwNjZGRicsICcjMDA5OUNDJyxcbiAgJyMwMDk5RkYnLCAnIzAwQ0MwMCcsICcjMDBDQzMzJywgJyMwMENDNjYnLCAnIzAwQ0M5OScsICcjMDBDQ0NDJywgJyMwMENDRkYnLFxuICAnIzMzMDBDQycsICcjMzMwMEZGJywgJyMzMzMzQ0MnLCAnIzMzMzNGRicsICcjMzM2NkNDJywgJyMzMzY2RkYnLCAnIzMzOTlDQycsXG4gICcjMzM5OUZGJywgJyMzM0NDMDAnLCAnIzMzQ0MzMycsICcjMzNDQzY2JywgJyMzM0NDOTknLCAnIzMzQ0NDQycsICcjMzNDQ0ZGJyxcbiAgJyM2NjAwQ0MnLCAnIzY2MDBGRicsICcjNjYzM0NDJywgJyM2NjMzRkYnLCAnIzY2Q0MwMCcsICcjNjZDQzMzJywgJyM5OTAwQ0MnLFxuICAnIzk5MDBGRicsICcjOTkzM0NDJywgJyM5OTMzRkYnLCAnIzk5Q0MwMCcsICcjOTlDQzMzJywgJyNDQzAwMDAnLCAnI0NDMDAzMycsXG4gICcjQ0MwMDY2JywgJyNDQzAwOTknLCAnI0NDMDBDQycsICcjQ0MwMEZGJywgJyNDQzMzMDAnLCAnI0NDMzMzMycsICcjQ0MzMzY2JyxcbiAgJyNDQzMzOTknLCAnI0NDMzNDQycsICcjQ0MzM0ZGJywgJyNDQzY2MDAnLCAnI0NDNjYzMycsICcjQ0M5OTAwJywgJyNDQzk5MzMnLFxuICAnI0NDQ0MwMCcsICcjQ0NDQzMzJywgJyNGRjAwMDAnLCAnI0ZGMDAzMycsICcjRkYwMDY2JywgJyNGRjAwOTknLCAnI0ZGMDBDQycsXG4gICcjRkYwMEZGJywgJyNGRjMzMDAnLCAnI0ZGMzMzMycsICcjRkYzMzY2JywgJyNGRjMzOTknLCAnI0ZGMzNDQycsICcjRkYzM0ZGJyxcbiAgJyNGRjY2MDAnLCAnI0ZGNjYzMycsICcjRkY5OTAwJywgJyNGRjk5MzMnLCAnI0ZGQ0MwMCcsICcjRkZDQzMzJ1xuXTtcblxuLyoqXG4gKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuICogYW5kIHRoZSBGaXJlYnVnIGV4dGVuc2lvbiAoYW55IEZpcmVmb3ggdmVyc2lvbikgYXJlIGtub3duXG4gKiB0byBzdXBwb3J0IFwiJWNcIiBDU1MgY3VzdG9taXphdGlvbnMuXG4gKlxuICogVE9ETzogYWRkIGEgYGxvY2FsU3RvcmFnZWAgdmFyaWFibGUgdG8gZXhwbGljaXRseSBlbmFibGUvZGlzYWJsZSBjb2xvcnNcbiAqL1xuXG5mdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG4gIC8vIE5COiBJbiBhbiBFbGVjdHJvbiBwcmVsb2FkIHNjcmlwdCwgZG9jdW1lbnQgd2lsbCBiZSBkZWZpbmVkIGJ1dCBub3QgZnVsbHlcbiAgLy8gaW5pdGlhbGl6ZWQuIFNpbmNlIHdlIGtub3cgd2UncmUgaW4gQ2hyb21lLCB3ZSdsbCBqdXN0IGRldGVjdCB0aGlzIGNhc2VcbiAgLy8gZXhwbGljaXRseVxuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnByb2Nlc3MgJiYgd2luZG93LnByb2Nlc3MudHlwZSA9PT0gJ3JlbmRlcmVyJykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gSW50ZXJuZXQgRXhwbG9yZXIgYW5kIEVkZ2UgZG8gbm90IHN1cHBvcnQgY29sb3JzLlxuICBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goLyhlZGdlfHRyaWRlbnQpXFwvKFxcZCspLykpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuICAvLyBkb2N1bWVudCBpcyB1bmRlZmluZWQgaW4gcmVhY3QtbmF0aXZlOiBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QtbmF0aXZlL3B1bGwvMTYzMlxuICByZXR1cm4gKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuV2Via2l0QXBwZWFyYW5jZSkgfHxcbiAgICAvLyBpcyBmaXJlYnVnPyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zOTgxMjAvMzc2NzczXG4gICAgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5jb25zb2xlICYmICh3aW5kb3cuY29uc29sZS5maXJlYnVnIHx8ICh3aW5kb3cuY29uc29sZS5leGNlcHRpb24gJiYgd2luZG93LmNvbnNvbGUudGFibGUpKSkgfHxcbiAgICAvLyBpcyBmaXJlZm94ID49IHYzMT9cbiAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcbiAgICAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSkgfHxcbiAgICAvLyBkb3VibGUgY2hlY2sgd2Via2l0IGluIHVzZXJBZ2VudCBqdXN0IGluIGNhc2Ugd2UgYXJlIGluIGEgd29ya2VyXG4gICAgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pKTtcbn1cblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbih2KSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gJ1tVbmV4cGVjdGVkSlNPTlBhcnNlRXJyb3JdOiAnICsgZXJyLm1lc3NhZ2U7XG4gIH1cbn07XG5cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKGFyZ3MpIHtcbiAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG4gIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKVxuICAgICsgdGhpcy5uYW1lc3BhY2VcbiAgICArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJylcbiAgICArIGFyZ3NbMF1cbiAgICArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJylcbiAgICArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncy5zcGxpY2UoMSwgMCwgYywgJ2NvbG9yOiBpbmhlcml0JylcblxuICAvLyB0aGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuICAvLyBhcmd1bWVudHMgcGFzc2VkIGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlICVjLCBzbyB3ZSBuZWVkIHRvXG4gIC8vIGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgaW5kZXggdG8gaW5zZXJ0IHRoZSBDU1MgaW50b1xuICB2YXIgaW5kZXggPSAwO1xuICB2YXIgbGFzdEMgPSAwO1xuICBhcmdzWzBdLnJlcGxhY2UoLyVbYS16QS1aJV0vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICBpZiAoJyUlJyA9PT0gbWF0Y2gpIHJldHVybjtcbiAgICBpbmRleCsrO1xuICAgIGlmICgnJWMnID09PSBtYXRjaCkge1xuICAgICAgLy8gd2Ugb25seSBhcmUgaW50ZXJlc3RlZCBpbiB0aGUgKmxhc3QqICVjXG4gICAgICAvLyAodGhlIHVzZXIgbWF5IGhhdmUgcHJvdmlkZWQgdGhlaXIgb3duKVxuICAgICAgbGFzdEMgPSBpbmRleDtcbiAgICB9XG4gIH0pO1xuXG4gIGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcbiAgICB9XG4gIH0gY2F0Y2goZSkge31cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2FkKCkge1xuICB2YXIgcjtcbiAgdHJ5IHtcbiAgICByID0gZXhwb3J0cy5zdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG5cbiAgLy8gSWYgZGVidWcgaXNuJ3Qgc2V0IGluIExTLCBhbmQgd2UncmUgaW4gRWxlY3Ryb24sIHRyeSB0byBsb2FkICRERUJVR1xuICBpZiAoIXIgJiYgdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmICdlbnYnIGluIHByb2Nlc3MpIHtcbiAgICByID0gcHJvY2Vzcy5lbnYuREVCVUc7XG4gIH1cblxuICByZXR1cm4gcjtcbn1cblxuLyoqXG4gKiBFbmFibGUgbmFtZXNwYWNlcyBsaXN0ZWQgaW4gYGxvY2FsU3RvcmFnZS5kZWJ1Z2AgaW5pdGlhbGx5LlxuICovXG5cbmV4cG9ydHMuZW5hYmxlKGxvYWQoKSk7XG5cbi8qKlxuICogTG9jYWxzdG9yYWdlIGF0dGVtcHRzIHRvIHJldHVybiB0aGUgbG9jYWxzdG9yYWdlLlxuICpcbiAqIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugc2FmYXJpIHRocm93c1xuICogd2hlbiBhIHVzZXIgZGlzYWJsZXMgY29va2llcy9sb2NhbHN0b3JhZ2VcbiAqIGFuZCB5b3UgYXR0ZW1wdCB0byBhY2Nlc3MgaXQuXG4gKlxuICogQHJldHVybiB7TG9jYWxTdG9yYWdlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9jYWxzdG9yYWdlKCkge1xuICB0cnkge1xuICAgIHJldHVybiB3aW5kb3cubG9jYWxTdG9yYWdlO1xuICB9IGNhdGNoIChlKSB7fVxufVxuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZURlYnVnLmRlYnVnID0gY3JlYXRlRGVidWdbJ2RlZmF1bHQnXSA9IGNyZWF0ZURlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogQWN0aXZlIGBkZWJ1Z2AgaW5zdGFuY2VzLlxuICovXG5leHBvcnRzLmluc3RhbmNlcyA9IFtdO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXIgb3IgdXBwZXItY2FzZSBsZXR0ZXIsIGkuZS4gXCJuXCIgYW5kIFwiTlwiLlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycyA9IHt9O1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2VsZWN0Q29sb3IobmFtZXNwYWNlKSB7XG4gIHZhciBoYXNoID0gMCwgaTtcblxuICBmb3IgKGkgaW4gbmFtZXNwYWNlKSB7XG4gICAgaGFzaCAgPSAoKGhhc2ggPDwgNSkgLSBoYXNoKSArIG5hbWVzcGFjZS5jaGFyQ29kZUF0KGkpO1xuICAgIGhhc2ggfD0gMDsgLy8gQ29udmVydCB0byAzMmJpdCBpbnRlZ2VyXG4gIH1cblxuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbTWF0aC5hYnMoaGFzaCkgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBjcmVhdGVEZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICB2YXIgcHJldlRpbWU7XG5cbiAgZnVuY3Rpb24gZGVidWcoKSB7XG4gICAgLy8gZGlzYWJsZWQ/XG4gICAgaWYgKCFkZWJ1Zy5lbmFibGVkKSByZXR1cm47XG5cbiAgICB2YXIgc2VsZiA9IGRlYnVnO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyB0dXJuIHRoZSBgYXJndW1lbnRzYCBpbnRvIGEgcHJvcGVyIEFycmF5XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgIH1cblxuICAgIGFyZ3NbMF0gPSBleHBvcnRzLmNvZXJjZShhcmdzWzBdKTtcblxuICAgIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIGFyZ3NbMF0pIHtcbiAgICAgIC8vIGFueXRoaW5nIGVsc2UgbGV0J3MgaW5zcGVjdCB3aXRoICVPXG4gICAgICBhcmdzLnVuc2hpZnQoJyVPJyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EtekEtWiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIC8vIGFwcGx5IGVudi1zcGVjaWZpYyBmb3JtYXR0aW5nIChjb2xvcnMsIGV0Yy4pXG4gICAgZXhwb3J0cy5mb3JtYXRBcmdzLmNhbGwoc2VsZiwgYXJncyk7XG5cbiAgICB2YXIgbG9nRm4gPSBkZWJ1Zy5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuXG4gIGRlYnVnLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcbiAgZGVidWcuZW5hYmxlZCA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpO1xuICBkZWJ1Zy51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICBkZWJ1Zy5jb2xvciA9IHNlbGVjdENvbG9yKG5hbWVzcGFjZSk7XG4gIGRlYnVnLmRlc3Ryb3kgPSBkZXN0cm95O1xuXG4gIC8vIGVudi1zcGVjaWZpYyBpbml0aWFsaXphdGlvbiBsb2dpYyBmb3IgZGVidWcgaW5zdGFuY2VzXG4gIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5pbml0KSB7XG4gICAgZXhwb3J0cy5pbml0KGRlYnVnKTtcbiAgfVxuXG4gIGV4cG9ydHMuaW5zdGFuY2VzLnB1c2goZGVidWcpO1xuXG4gIHJldHVybiBkZWJ1Zztcbn1cblxuZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gIHZhciBpbmRleCA9IGV4cG9ydHMuaW5zdGFuY2VzLmluZGV4T2YodGhpcyk7XG4gIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICBleHBvcnRzLmluc3RhbmNlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vKipcbiAqIEVuYWJsZXMgYSBkZWJ1ZyBtb2RlIGJ5IG5hbWVzcGFjZXMuIFRoaXMgY2FuIGluY2x1ZGUgbW9kZXNcbiAqIHNlcGFyYXRlZCBieSBhIGNvbG9uIGFuZCB3aWxkY2FyZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlKG5hbWVzcGFjZXMpIHtcbiAgZXhwb3J0cy5zYXZlKG5hbWVzcGFjZXMpO1xuXG4gIGV4cG9ydHMubmFtZXMgPSBbXTtcbiAgZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4gIHZhciBpO1xuICB2YXIgc3BsaXQgPSAodHlwZW9mIG5hbWVzcGFjZXMgPT09ICdzdHJpbmcnID8gbmFtZXNwYWNlcyA6ICcnKS5zcGxpdCgvW1xccyxdKy8pO1xuICB2YXIgbGVuID0gc3BsaXQubGVuZ3RoO1xuXG4gIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGkgPSAwOyBpIDwgZXhwb3J0cy5pbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBleHBvcnRzLmluc3RhbmNlc1tpXTtcbiAgICBpbnN0YW5jZS5lbmFibGVkID0gZXhwb3J0cy5lbmFibGVkKGluc3RhbmNlLm5hbWVzcGFjZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICBpZiAobmFtZVtuYW1lLmxlbmd0aCAtIDFdID09PSAnKicpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9mZXRjaGFnZW50Jyk7XG4iLCIvKiBnbG9iYWwgSGVhZGVycyAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZldGNoYWdlbnQ7XG5cblsnZ2V0JywgJ3B1dCcsICdwb3N0JywgJ2RlbGV0ZSddLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gIGZldGNoYWdlbnRbbWV0aG9kXSA9IGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiBmZXRjaGFnZW50KG1ldGhvZC50b1VwcGVyQ2FzZSgpLCB1cmwpO1xuICB9O1xufSk7XG5cbmZldGNoYWdlbnQuZGVsID0gZmV0Y2hhZ2VudC5kZWxldGU7XG5cbmZ1bmN0aW9uIHNldEFsbChkZXN0aW5hdGlvbiwgc291cmNlKSB7XG4gIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgZGVzdGluYXRpb24uc2V0KHAsIHNvdXJjZVtwXSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRVcmwocHJlZml4LCBxdWVyeSkge1xuICBmdW5jdGlvbiBlbmNvZGUodikge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHYpXG4gICAgICA/IHYubWFwKGVuY29kZVVSSUNvbXBvbmVudCkuam9pbignLCcpXG4gICAgICA6IGVuY29kZVVSSUNvbXBvbmVudCh2KTtcbiAgfVxuXG4gIGlmICghcXVlcnkpIHtcbiAgICByZXR1cm4gcHJlZml4O1xuICB9XG4gIHZhciBxcyA9IE9iamVjdFxuICAgIC5rZXlzKHF1ZXJ5KVxuICAgIC5tYXAoZnVuY3Rpb24obmFtZSkgeyByZXR1cm4gbmFtZSArICc9JyArIGVuY29kZShxdWVyeVtuYW1lXSk7IH0pXG4gICAgLmpvaW4oJyYnKTtcbiAgaWYgKCFxcykge1xuICAgIHJldHVybiBwcmVmaXg7XG4gIH1cbiAgcmV0dXJuIHByZWZpeCArICc/JyArIHFzO1xufVxuXG5mdW5jdGlvbiBkZWZhdWx0Q29udGVudFBhcnNlcihjb250ZW50VHlwZSkge1xuICByZXR1cm4gY29udGVudFR5cGUgJiYgY29udGVudFR5cGUuaW5kZXhPZignanNvbicpICE9PSAtMVxuICAgID8gJ2pzb24nXG4gICAgOiAndGV4dCc7XG59XG5cbmZ1bmN0aW9uIGZldGNoYWdlbnQobWV0aG9kLCB1cmwpIHtcbiAgdmFyIHJlcSA9IHtcbiAgICB1cmw6IHVybCxcbiAgICBxdWVyeTogdW5kZWZpbmVkXG4gIH07XG4gIHZhciBpbml0ID0ge1xuICAgIG1ldGhvZDogbWV0aG9kLFxuICAgIHJlZGlyZWN0OiAnbWFudWFsJyxcbiAgICBjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJ1xuICB9O1xuICB2YXIgc2VsZiA9IHtcbiAgICBlbmQ6IGVuZCxcbiAgICBqc29uOiBqc29uLFxuICAgIHBhcnNlcjogcGFyc2VyLFxuICAgIHF1ZXJ5OiBxdWVyeSxcbiAgICByZWRpcmVjdDogcmVkaXJlY3QsXG4gICAgc2VuZDogc2VuZCxcbiAgICBzZXQ6IHNldCxcbiAgICB0ZXh0OiB0ZXh0XG4gIH07XG4gIHZhciBlcnJvcjtcbiAgdmFyIGNvbnRlbnRQYXJzZXIgPSBkZWZhdWx0Q29udGVudFBhcnNlcjtcblxuICBmdW5jdGlvbiBlbmQoZm4pIHtcbiAgICB2YXIgZmV0Y2hlZCA9IGZldGNoKGZvcm1hdFVybChyZXEudXJsLCByZXEucXVlcnkpLCBpbml0KTtcblxuICAgIGlmICghZm4pIHtcbiAgICAgIHJldHVybiBmZXRjaGVkO1xuICAgIH1cblxuICAgIGZldGNoZWRcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICBpZiAoIXJlcy5vaykge1xuICAgICAgICAgIGVycm9yID0ge1xuICAgICAgICAgICAgc3RhdHVzOiByZXMuc3RhdHVzLFxuICAgICAgICAgICAgcmVzcG9uc2U6IHJlc1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHBhcnNlciA9IGNvbnRlbnRQYXJzZXIocmVzLmhlYWRlcnMuZ2V0KCdDb250ZW50LVR5cGUnKSk7XG4gICAgICAgIGlmIChwYXJzZXIpIHtcbiAgICAgICAgICByZXR1cm4gcmVzW3BhcnNlcl0oKTtcbiAgICAgICAgfSBlbHNlIGlmICghZXJyb3IpIHtcbiAgICAgICAgICBlcnJvciA9IHtcbiAgICAgICAgICAgIHN0YXR1czogJ3Vua25vd24gQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAgIHJlc3BvbnNlOiByZXNcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnRoZW4oXG4gICAgICAgIGZ1bmN0aW9uKGJvZHkpIHsgcmV0dXJuIGZuKGVycm9yLCBib2R5KTsgfSxcbiAgICAgICAgZnVuY3Rpb24oZSkge1xuICAgICAgICAgIGVycm9yID0gZXJyb3IgfHwge307XG4gICAgICAgICAgZXJyb3IuZXJyb3IgPSBlO1xuICAgICAgICAgIHJldHVybiBmbihlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICk7XG4gIH1cblxuICBmdW5jdGlvbiBqc29uKCkge1xuICAgIHJldHVybiBlbmQoKS50aGVuKGZ1bmN0aW9uKHJlcykgeyByZXR1cm4gcmVzLmpzb24oKTsgfSk7XG4gIH1cblxuICBmdW5jdGlvbiB0ZXh0KCkge1xuICAgIHJldHVybiBlbmQoKS50aGVuKGZ1bmN0aW9uKHJlcykgeyByZXR1cm4gcmVzLnRleHQoKTsgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzZW5kKGJvZHkpIHtcbiAgICBpZiAoYm9keSBpbnN0YW5jZW9mIEJsb2IgfHwgYm9keSBpbnN0YW5jZW9mIEZvcm1EYXRhIHx8IHR5cGVvZiBib2R5ICE9PSAnb2JqZWN0Jykge1xuICAgICAgaW5pdC5ib2R5ID0gYm9keTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5pdC5ib2R5ID0gSlNPTi5zdHJpbmdpZnkoYm9keSk7XG4gICAgICBzZXQoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgfVxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcXVlcnkocSkge1xuICAgIHJlcS5xdWVyeSA9IHE7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQoaGVhZGVyLCB2YWx1ZSkge1xuICAgIGlmICghaW5pdC5oZWFkZXJzKSB7XG4gICAgICBpbml0LmhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgaW5pdC5oZWFkZXJzLnNldChoZWFkZXIsIHZhbHVlKTtcbiAgICB9XG4gICAgZWxzZSAge1xuICAgICAgc2V0QWxsKGluaXQuaGVhZGVycywgaGVhZGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiByZWRpcmVjdChmb2xsb3cpIHtcbiAgICBpbml0LnJlZGlyZWN0ID0gZm9sbG93ID8gJ2ZvbGxvdycgOiAnbWFudWFsJztcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlcihmbikge1xuICAgIGNvbnRlbnRQYXJzZXIgPSBmbjtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIHJldHVybiBzZWxmO1xufVxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9IGxpbWl0ZXI7XG5cbi8qZ2xvYmFsIHNldFRpbWVvdXQsIGNsZWFyVGltZW91dCAqL1xuXG5mdW5jdGlvbiBsaW1pdGVyKGludGVydmFsLCBwZW5hbHR5SW50ZXJ2YWwpIHtcblxuICB2YXIgcXVldWUgPSBbXSxcbiAgICBsYXN0VHJpZ2dlciA9IDAsXG4gICAgcGVuYWx0eUNvdW50ZXIgPSAwLFxuICAgIHNraXBDb3VudGVyID0gMCxcbiAgICB0aW1lcjtcblxuICBmdW5jdGlvbiBub3coKSB7XG4gICAgcmV0dXJuIERhdGUubm93KCk7XG4gIH1cblxuICBmdW5jdGlvbiBzaW5jZSgpIHtcbiAgICByZXR1cm4gbm93KCkgLSBsYXN0VHJpZ2dlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGN1cnJlbnRJbnRlcnZhbCgpIHtcbiAgICByZXR1cm4gcGVuYWx0eUNvdW50ZXIgPiAwID8gcGVuYWx0eUludGVydmFsIDogaW50ZXJ2YWw7XG4gIH1cblxuICBmdW5jdGlvbiBydW5Ob3coZm4pIHtcbiAgICBwZW5hbHR5Q291bnRlciA9IDA7XG4gICAgZm4oKTtcbiAgICAvLyB3YWl0IHRvIHRoZSBuZXh0IGludGVydmFsIHVubGVzcyB0b2xkIHRvIHNraXBcbiAgICAvLyB0byB0aGUgbmV4dCBvcGVyYXRpb24gaW1tZWRpYXRlbHlcbiAgICBpZiAoc2tpcENvdW50ZXIgPiAwKSB7XG4gICAgICBza2lwQ291bnRlciA9IDA7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgbGFzdFRyaWdnZXIgPSBub3coKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXF1ZSgpIHtcbiAgICB0aW1lciA9IHVuZGVmaW5lZDtcbiAgICBpZiAoc2luY2UoKSA+PSBjdXJyZW50SW50ZXJ2YWwoKSkge1xuICAgICAgcnVuTm93KHF1ZXVlLnNoaWZ0KCkpO1xuICAgIH1cbiAgICBzY2hlZHVsZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2NoZWR1bGUoKSB7XG4gICAgdmFyIGRlbGF5O1xuICAgIGlmICghdGltZXIgJiYgcXVldWUubGVuZ3RoKSB7XG4gICAgICBkZWxheSA9IGN1cnJlbnRJbnRlcnZhbCgpIC0gc2luY2UoKTtcbiAgICAgIGlmIChkZWxheSA8IDApIHtcbiAgICAgICAgcmV0dXJuIGRlcXVlKCk7XG4gICAgICB9XG4gICAgICB0aW1lciA9IHNldFRpbWVvdXQoZGVxdWUsIGRlbGF5KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0cmlnZ2VyKGZuKSB7XG4gICAgaWYgKHNpbmNlKCkgPj0gY3VycmVudEludGVydmFsKCkgJiYgIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgcnVuTm93KGZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICBzY2hlZHVsZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBlbmFsdHkoKSB7XG4gICAgcGVuYWx0eUNvdW50ZXIgKz0gMTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNraXAoKSB7XG4gICAgc2tpcENvdW50ZXIgKz0gMTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNhbmNlbCgpIHtcbiAgICBpZiAodGltZXIpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgfVxuICAgIHF1ZXVlID0gW107XG4gIH1cblxuICBwZW5hbHR5SW50ZXJ2YWwgPSBwZW5hbHR5SW50ZXJ2YWwgfHwgNSAqIGludGVydmFsO1xuICByZXR1cm4ge1xuICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgcGVuYWx0eTogcGVuYWx0eSxcbiAgICBza2lwOiBza2lwLFxuICAgIGNhbmNlbDogY2FuY2VsXG4gIH07XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHRocm93cyB7RXJyb3J9IHRocm93IGFuIGVycm9yIGlmIHZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgbnVtYmVyXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsO1xuICBpZiAodHlwZSA9PT0gJ3N0cmluZycgJiYgdmFsLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gcGFyc2UodmFsKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiBpc05hTih2YWwpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBvcHRpb25zLmxvbmcgPyBmbXRMb25nKHZhbCkgOiBmbXRTaG9ydCh2YWwpO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICtcbiAgICAgIEpTT04uc3RyaW5naWZ5KHZhbClcbiAgKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSBTdHJpbmcoc3RyKTtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobWlsbGlzZWNvbmRzP3xtc2Vjcz98bXN8c2Vjb25kcz98c2Vjcz98c3xtaW51dGVzP3xtaW5zP3xtfGhvdXJzP3xocnM/fGh8ZGF5cz98ZHx5ZWFycz98eXJzP3x5KT8kL2kuZXhlYyhcbiAgICBzdHJcbiAgKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneXJzJzpcbiAgICBjYXNlICd5cic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaHJzJzpcbiAgICBjYXNlICdocic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtaW5zJzpcbiAgICBjYXNlICdtaW4nOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAnc2Vjcyc6XG4gICAgY2FzZSAnc2VjJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtaWxsaXNlY29uZHMnOlxuICAgIGNhc2UgJ21pbGxpc2Vjb25kJzpcbiAgICBjYXNlICdtc2Vjcyc6XG4gICAgY2FzZSAnbXNlYyc6XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBmbXRTaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIH1cbiAgaWYgKG1zID49IGgpIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICB9XG4gIGlmIChtcyA+PSBtKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgfVxuICBpZiAobXMgPj0gcykge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIH1cbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGZtdExvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpIHx8XG4gICAgcGx1cmFsKG1zLCBoLCAnaG91cicpIHx8XG4gICAgcGx1cmFsKG1zLCBtLCAnbWludXRlJykgfHxcbiAgICBwbHVyYWwobXMsIHMsICdzZWNvbmQnKSB8fFxuICAgIG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG1zIDwgbiAqIDEuNSkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICB9XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJ1bldhdGVyZmFsbFxuXG5mdW5jdGlvbiBydW5XYXRlcmZhbGwgKHRhc2tzLCBjYikge1xuICB2YXIgY3VycmVudCA9IDBcbiAgdmFyIGlzU3luYyA9IHRydWVcblxuICBmdW5jdGlvbiBkb25lIChlcnIsIGFyZ3MpIHtcbiAgICBmdW5jdGlvbiBlbmQgKCkge1xuICAgICAgYXJncyA9IGFyZ3MgPyBbXS5jb25jYXQoZXJyLCBhcmdzKSA6IFsgZXJyIF1cbiAgICAgIGlmIChjYikgY2IuYXBwbHkodW5kZWZpbmVkLCBhcmdzKVxuICAgIH1cbiAgICBpZiAoaXNTeW5jKSBwcm9jZXNzLm5leHRUaWNrKGVuZClcbiAgICBlbHNlIGVuZCgpXG4gIH1cblxuICBmdW5jdGlvbiBlYWNoIChlcnIpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcbiAgICBpZiAoKytjdXJyZW50ID49IHRhc2tzLmxlbmd0aCB8fCBlcnIpIHtcbiAgICAgIGRvbmUoZXJyLCBhcmdzKVxuICAgIH0gZWxzZSB7XG4gICAgICB0YXNrc1tjdXJyZW50XS5hcHBseSh1bmRlZmluZWQsIFtdLmNvbmNhdChhcmdzLCBlYWNoKSlcbiAgICB9XG4gIH1cblxuICBpZiAodGFza3MubGVuZ3RoKSB7XG4gICAgdGFza3NbMF0oZWFjaClcbiAgfSBlbHNlIHtcbiAgICBkb25lKG51bGwpXG4gIH1cblxuICBpc1N5bmMgPSBmYWxzZVxufVxuIiwidmFyIEF3ZXNvbXBsZXRlID0gcmVxdWlyZSgnYXdlc29tcGxldGUnKTtcbnZhciBmdXJrb3RHZW9jb2RlID0gcmVxdWlyZSgnZnVya290LWdlb2NvZGUnKTtcbnZhciBkZWJvdW5jZSA9IHJlcXVpcmUoJ2RlYm91bmNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZ2VvcGxldGU7XG5cbnZhciBkZWZhdWx0R2VvY29kZXIgPSB7XG4gIG9yZGVyOiBbJ2FsZ29saWEnXSxcbiAgYWxnb2xpYV9wYXJhbWV0ZXJzOiB7IGludGVydmFsIDogMTAwMCB9LFxuICBhbGdvbGlhX2VuYWJsZTogZnVuY3Rpb24oKSB7IHJldHVybiB0cnVlOyB9XG59O1xuXG52YXIgU3VnZ2VzdGlvbnMgPSB7XG4gICdhZGRyZXNzJzoge1xuICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuYWRkcmVzcyB8fCB0aGlzLnBsYWNlOyB9XG4gIH0sXG4gICdwbGFjZSc6IHtcbiAgICB0b1N0cmluZzogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLnBsYWNlIHx8IHRoaXMuYWRkcmVzczsgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBkaXNwbGF5QWxsKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2VvcGxldGUoZWwsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMudHlwZSA9IFN1Z2dlc3Rpb25zW29wdGlvbnMudHlwZV0gPyBvcHRpb25zLnR5cGUgOiAnYWRkcmVzcyc7XG4gIHZhciBhY09wdGlvbnMgPSB7XG4gICAgbWluQ2hhcnM6IG9wdGlvbnMubWluQ2hhcnMgfHwgNCxcbiAgICBmaWx0ZXI6IGRpc3BsYXlBbGxcbiAgfTtcblxuXG4gIHZhciBnZW9PcHRpb25zID0gb3B0aW9ucy5nZW9jb2RlciB8fCBkZWZhdWx0R2VvY29kZXI7XG5cbiAgdmFyIGxhc3RWYWx1ZTtcbiAgdmFyIG91dHN0YW5kaW5nUmVxdWVzdDtcbiAgdmFyIGdlb2NvZGUgPSBmdXJrb3RHZW9jb2RlKGdlb09wdGlvbnMpO1xuICB2YXIgYWMgPSBuZXcgQXdlc29tcGxldGUoZWwsIGFjT3B0aW9ucyk7XG5cbiAgdmFyIG9uaW5wdXQgPSBkZWJvdW5jZShmdW5jdGlvbigpIHtcbiAgICBpZiAoZWwudmFsdWUubGVuZ3RoIDwgYWNPcHRpb25zLm1pbkNoYXJzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHF1ZXJ5KGVsLnZhbHVlKTtcbiAgfSwgMzAwKTtcblxuICBmdW5jdGlvbiBvbmNoYW5nZShldmVudCkge1xuICAgIHZhciB2YWx1ZSA9IGV2ZW50LnRleHQudmFsdWU7XG4gICAgbGFzdFZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICB2YXIgY2hhbmdlRXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2dlb3BsZXRlLWNoYW5nZScsIHsgZGV0YWlsOiB2YWx1ZSB9KTtcbiAgICBlbC5kaXNwYXRjaEV2ZW50KGNoYW5nZUV2ZW50KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZyb21QbGFjZShwbGFjZSkge1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUoU3VnZ2VzdGlvbnNbb3B0aW9ucy50eXBlXSksIHBsYWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHF1ZXJ5KHZhbHVlKSB7XG4gICAgaWYgKGxhc3RWYWx1ZSA9PT0gdmFsdWUpIHtcbiAgICAgIC8vIGRvIG5vdCByZXF1ZXJ5IGZvciB0aGUgc2FtZSB2YWx1ZVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAob3V0c3RhbmRpbmdSZXF1ZXN0KSB7XG4gICAgICBvdXRzdGFuZGluZ1JlcXVlc3QuYWJvcnQoKTtcbiAgICB9XG4gICAgdmFyIHBhcmFtcyA9IHtcbiAgICAgIHBhcnRpYWw6IHRydWUsXG4gICAgICBib3VuZHM6IG9wdGlvbnMuYm91bmRzLFxuICAgICAgbGFuZzogb3B0aW9ucy5sYW5nIHx8IGRvY3VtZW50LmxhbmcgfHwgJ2VuJ1xuICAgIH07XG4gICAgcGFyYW1zW29wdGlvbnMudHlwZV0gPSB2YWx1ZTtcbiAgICBsYXN0VmFsdWUgPSB2YWx1ZTtcbiAgICBlbC5jbGFzc0xpc3QuYWRkKCdnZW9wbGV0ZS1pbi1wcm9ncmVzcycpO1xuICAgIG91dHN0YW5kaW5nUmVxdWVzdCA9IGdlb2NvZGUocGFyYW1zLCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2dlb3BsZXRlLWluLXByb2dyZXNzJyk7XG4gICAgICBpZiAoIXJlc3VsdCB8fCAhcmVzdWx0LnBsYWNlcykge1xuICAgICAgICAvLyBubyByZXN1bHRzXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGFjLmxpc3QgPSByZXN1bHQucGxhY2VzLm1hcChmcm9tUGxhY2UpO1xuICAgICAgYWMuZXZhbHVhdGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBvbmlucHV0KTtcbiAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCdhd2Vzb21wbGV0ZS1zZWxlY3Rjb21wbGV0ZScsIG9uY2hhbmdlKTtcbiAgICBhYy5kZXN0cm95KCk7XG4gIH1cblxuICBlbC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIG9uaW5wdXQpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdhd2Vzb21wbGV0ZS1zZWxlY3Rjb21wbGV0ZScsIG9uY2hhbmdlKTtcblxuICByZXR1cm4ge1xuICAgIGRlc3Ryb3k6IGRlc3Ryb3lcbiAgfTtcbn1cbiIsIi8qKlxuICogU2ltcGxlLCBsaWdodHdlaWdodCwgdXNhYmxlIGxvY2FsIGF1dG9jb21wbGV0ZSBsaWJyYXJ5IGZvciBtb2Rlcm4gYnJvd3NlcnNcbiAqIEJlY2F1c2UgdGhlcmUgd2VyZW7igJl0IGVub3VnaCBhdXRvY29tcGxldGUgc2NyaXB0cyBpbiB0aGUgd29ybGQ/IEJlY2F1c2UgSeKAmW0gY29tcGxldGVseSBpbnNhbmUgYW5kIGhhdmUgTklIIHN5bmRyb21lPyBQcm9iYWJseSBib3RoLiA6UFxuICogQGF1dGhvciBMZWEgVmVyb3UgaHR0cDovL2xlYXZlcm91LmdpdGh1Yi5pby9hd2Vzb21wbGV0ZVxuICogTUlUIGxpY2Vuc2VcbiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuXG52YXIgXyA9IGZ1bmN0aW9uIChpbnB1dCwgbykge1xuXHR2YXIgbWUgPSB0aGlzO1xuXG5cdC8vIFNldHVwXG5cblx0dGhpcy5pc09wZW5lZCA9IGZhbHNlO1xuXG5cdHRoaXMuaW5wdXQgPSAkKGlucHV0KTtcblx0dGhpcy5pbnB1dC5zZXRBdHRyaWJ1dGUoXCJhdXRvY29tcGxldGVcIiwgXCJvZmZcIik7XG5cdHRoaXMuaW5wdXQuc2V0QXR0cmlidXRlKFwiYXJpYS1hdXRvY29tcGxldGVcIiwgXCJsaXN0XCIpO1xuXG5cdG8gPSBvIHx8IHt9O1xuXG5cdGNvbmZpZ3VyZSh0aGlzLCB7XG5cdFx0bWluQ2hhcnM6IDIsXG5cdFx0bWF4SXRlbXM6IDEwLFxuXHRcdGF1dG9GaXJzdDogZmFsc2UsXG5cdFx0ZGF0YTogXy5EQVRBLFxuXHRcdGZpbHRlcjogXy5GSUxURVJfQ09OVEFJTlMsXG5cdFx0c29ydDogby5zb3J0ID09PSBmYWxzZSA/IGZhbHNlIDogXy5TT1JUX0JZTEVOR1RILFxuXHRcdGl0ZW06IF8uSVRFTSxcblx0XHRyZXBsYWNlOiBfLlJFUExBQ0Vcblx0fSwgbyk7XG5cblx0dGhpcy5pbmRleCA9IC0xO1xuXG5cdC8vIENyZWF0ZSBuZWNlc3NhcnkgZWxlbWVudHNcblxuXHR0aGlzLmNvbnRhaW5lciA9ICQuY3JlYXRlKFwiZGl2XCIsIHtcblx0XHRjbGFzc05hbWU6IFwiYXdlc29tcGxldGVcIixcblx0XHRhcm91bmQ6IGlucHV0XG5cdH0pO1xuXG5cdHRoaXMudWwgPSAkLmNyZWF0ZShcInVsXCIsIHtcblx0XHRoaWRkZW46IFwiaGlkZGVuXCIsXG5cdFx0aW5zaWRlOiB0aGlzLmNvbnRhaW5lclxuXHR9KTtcblxuXHR0aGlzLnN0YXR1cyA9ICQuY3JlYXRlKFwic3BhblwiLCB7XG5cdFx0Y2xhc3NOYW1lOiBcInZpc3VhbGx5LWhpZGRlblwiLFxuXHRcdHJvbGU6IFwic3RhdHVzXCIsXG5cdFx0XCJhcmlhLWxpdmVcIjogXCJhc3NlcnRpdmVcIixcblx0XHRcImFyaWEtcmVsZXZhbnRcIjogXCJhZGRpdGlvbnNcIixcblx0XHRpbnNpZGU6IHRoaXMuY29udGFpbmVyXG5cdH0pO1xuXG5cdC8vIEJpbmQgZXZlbnRzXG5cblx0dGhpcy5fZXZlbnRzID0ge1xuXHRcdGlucHV0OiB7XG5cdFx0XHRcImlucHV0XCI6IHRoaXMuZXZhbHVhdGUuYmluZCh0aGlzKSxcblx0XHRcdFwiYmx1clwiOiB0aGlzLmNsb3NlLmJpbmQodGhpcywgeyByZWFzb246IFwiYmx1clwiIH0pLFxuXHRcdFx0XCJrZXlkb3duXCI6IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHR2YXIgYyA9IGV2dC5rZXlDb2RlO1xuXG5cdFx0XHRcdC8vIElmIHRoZSBkcm9wZG93biBgdWxgIGlzIGluIHZpZXcsIHRoZW4gYWN0IG9uIGtleWRvd24gZm9yIHRoZSBmb2xsb3dpbmcga2V5czpcblx0XHRcdFx0Ly8gRW50ZXIgLyBFc2MgLyBVcCAvIERvd25cblx0XHRcdFx0aWYobWUub3BlbmVkKSB7XG5cdFx0XHRcdFx0aWYgKGMgPT09IDEzICYmIG1lLnNlbGVjdGVkKSB7IC8vIEVudGVyXG5cdFx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdG1lLnNlbGVjdCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChjID09PSAyNykgeyAvLyBFc2Ncblx0XHRcdFx0XHRcdG1lLmNsb3NlKHsgcmVhc29uOiBcImVzY1wiIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChjID09PSAzOCB8fCBjID09PSA0MCkgeyAvLyBEb3duL1VwIGFycm93XG5cdFx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdG1lW2MgPT09IDM4PyBcInByZXZpb3VzXCIgOiBcIm5leHRcIl0oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdGZvcm06IHtcblx0XHRcdFwic3VibWl0XCI6IHRoaXMuY2xvc2UuYmluZCh0aGlzLCB7IHJlYXNvbjogXCJzdWJtaXRcIiB9KVxuXHRcdH0sXG5cdFx0dWw6IHtcblx0XHRcdFwibW91c2Vkb3duXCI6IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHR2YXIgbGkgPSBldnQudGFyZ2V0O1xuXG5cdFx0XHRcdGlmIChsaSAhPT0gdGhpcykge1xuXG5cdFx0XHRcdFx0d2hpbGUgKGxpICYmICEvbGkvaS50ZXN0KGxpLm5vZGVOYW1lKSkge1xuXHRcdFx0XHRcdFx0bGkgPSBsaS5wYXJlbnROb2RlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChsaSAmJiBldnQuYnV0dG9uID09PSAwKSB7ICAvLyBPbmx5IHNlbGVjdCBvbiBsZWZ0IGNsaWNrXG5cdFx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdG1lLnNlbGVjdChsaSwgZXZ0LnRhcmdldCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdCQuYmluZCh0aGlzLmlucHV0LCB0aGlzLl9ldmVudHMuaW5wdXQpO1xuXHQkLmJpbmQodGhpcy5pbnB1dC5mb3JtLCB0aGlzLl9ldmVudHMuZm9ybSk7XG5cdCQuYmluZCh0aGlzLnVsLCB0aGlzLl9ldmVudHMudWwpO1xuXG5cdGlmICh0aGlzLmlucHV0Lmhhc0F0dHJpYnV0ZShcImxpc3RcIikpIHtcblx0XHR0aGlzLmxpc3QgPSBcIiNcIiArIHRoaXMuaW5wdXQuZ2V0QXR0cmlidXRlKFwibGlzdFwiKTtcblx0XHR0aGlzLmlucHV0LnJlbW92ZUF0dHJpYnV0ZShcImxpc3RcIik7XG5cdH1cblx0ZWxzZSB7XG5cdFx0dGhpcy5saXN0ID0gdGhpcy5pbnB1dC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWxpc3RcIikgfHwgby5saXN0IHx8IFtdO1xuXHR9XG5cblx0Xy5hbGwucHVzaCh0aGlzKTtcbn07XG5cbl8ucHJvdG90eXBlID0ge1xuXHRzZXQgbGlzdChsaXN0KSB7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkobGlzdCkpIHtcblx0XHRcdHRoaXMuX2xpc3QgPSBsaXN0O1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgbGlzdCA9PT0gXCJzdHJpbmdcIiAmJiBsaXN0LmluZGV4T2YoXCIsXCIpID4gLTEpIHtcblx0XHRcdFx0dGhpcy5fbGlzdCA9IGxpc3Quc3BsaXQoL1xccyosXFxzKi8pO1xuXHRcdH1cblx0XHRlbHNlIHsgLy8gRWxlbWVudCBvciBDU1Mgc2VsZWN0b3Jcblx0XHRcdGxpc3QgPSAkKGxpc3QpO1xuXG5cdFx0XHRpZiAobGlzdCAmJiBsaXN0LmNoaWxkcmVuKSB7XG5cdFx0XHRcdHZhciBpdGVtcyA9IFtdO1xuXHRcdFx0XHRzbGljZS5hcHBseShsaXN0LmNoaWxkcmVuKS5mb3JFYWNoKGZ1bmN0aW9uIChlbCkge1xuXHRcdFx0XHRcdGlmICghZWwuZGlzYWJsZWQpIHtcblx0XHRcdFx0XHRcdHZhciB0ZXh0ID0gZWwudGV4dENvbnRlbnQudHJpbSgpO1xuXHRcdFx0XHRcdFx0dmFyIHZhbHVlID0gZWwudmFsdWUgfHwgdGV4dDtcblx0XHRcdFx0XHRcdHZhciBsYWJlbCA9IGVsLmxhYmVsIHx8IHRleHQ7XG5cdFx0XHRcdFx0XHRpZiAodmFsdWUgIT09IFwiXCIpIHtcblx0XHRcdFx0XHRcdFx0aXRlbXMucHVzaCh7IGxhYmVsOiBsYWJlbCwgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuX2xpc3QgPSBpdGVtcztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gdGhpcy5pbnB1dCkge1xuXHRcdFx0dGhpcy5ldmFsdWF0ZSgpO1xuXHRcdH1cblx0fSxcblxuXHRnZXQgc2VsZWN0ZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5kZXggPiAtMTtcblx0fSxcblxuXHRnZXQgb3BlbmVkKCkge1xuXHRcdHJldHVybiB0aGlzLmlzT3BlbmVkO1xuXHR9LFxuXG5cdGNsb3NlOiBmdW5jdGlvbiAobykge1xuXHRcdGlmICghdGhpcy5vcGVuZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnVsLnNldEF0dHJpYnV0ZShcImhpZGRlblwiLCBcIlwiKTtcblx0XHR0aGlzLmlzT3BlbmVkID0gZmFsc2U7XG5cdFx0dGhpcy5pbmRleCA9IC0xO1xuXG5cdFx0JC5maXJlKHRoaXMuaW5wdXQsIFwiYXdlc29tcGxldGUtY2xvc2VcIiwgbyB8fCB7fSk7XG5cdH0sXG5cblx0b3BlbjogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudWwucmVtb3ZlQXR0cmlidXRlKFwiaGlkZGVuXCIpO1xuXHRcdHRoaXMuaXNPcGVuZWQgPSB0cnVlO1xuXG5cdFx0aWYgKHRoaXMuYXV0b0ZpcnN0ICYmIHRoaXMuaW5kZXggPT09IC0xKSB7XG5cdFx0XHR0aGlzLmdvdG8oMCk7XG5cdFx0fVxuXG5cdFx0JC5maXJlKHRoaXMuaW5wdXQsIFwiYXdlc29tcGxldGUtb3BlblwiKTtcblx0fSxcblxuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHQvL3JlbW92ZSBldmVudHMgZnJvbSB0aGUgaW5wdXQgYW5kIGl0cyBmb3JtXG5cdFx0JC51bmJpbmQodGhpcy5pbnB1dCwgdGhpcy5fZXZlbnRzLmlucHV0KTtcblx0XHQkLnVuYmluZCh0aGlzLmlucHV0LmZvcm0sIHRoaXMuX2V2ZW50cy5mb3JtKTtcblxuXHRcdC8vbW92ZSB0aGUgaW5wdXQgb3V0IG9mIHRoZSBhd2Vzb21wbGV0ZSBjb250YWluZXIgYW5kIHJlbW92ZSB0aGUgY29udGFpbmVyIGFuZCBpdHMgY2hpbGRyZW5cblx0XHR2YXIgcGFyZW50Tm9kZSA9IHRoaXMuY29udGFpbmVyLnBhcmVudE5vZGU7XG5cblx0XHRwYXJlbnROb2RlLmluc2VydEJlZm9yZSh0aGlzLmlucHV0LCB0aGlzLmNvbnRhaW5lcik7XG5cdFx0cGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmNvbnRhaW5lcik7XG5cblx0XHQvL3JlbW92ZSBhdXRvY29tcGxldGUgYW5kIGFyaWEtYXV0b2NvbXBsZXRlIGF0dHJpYnV0ZXNcblx0XHR0aGlzLmlucHV0LnJlbW92ZUF0dHJpYnV0ZShcImF1dG9jb21wbGV0ZVwiKTtcblx0XHR0aGlzLmlucHV0LnJlbW92ZUF0dHJpYnV0ZShcImFyaWEtYXV0b2NvbXBsZXRlXCIpO1xuXG5cdFx0Ly9yZW1vdmUgdGhpcyBhd2Vzb21lcGxldGUgaW5zdGFuY2UgZnJvbSB0aGUgZ2xvYmFsIGFycmF5IG9mIGluc3RhbmNlc1xuXHRcdHZhciBpbmRleE9mQXdlc29tcGxldGUgPSBfLmFsbC5pbmRleE9mKHRoaXMpO1xuXG5cdFx0aWYgKGluZGV4T2ZBd2Vzb21wbGV0ZSAhPT0gLTEpIHtcblx0XHRcdF8uYWxsLnNwbGljZShpbmRleE9mQXdlc29tcGxldGUsIDEpO1xuXHRcdH1cblx0fSxcblxuXHRuZXh0OiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGNvdW50ID0gdGhpcy51bC5jaGlsZHJlbi5sZW5ndGg7XG5cdFx0dGhpcy5nb3RvKHRoaXMuaW5kZXggPCBjb3VudCAtIDEgPyB0aGlzLmluZGV4ICsgMSA6IChjb3VudCA/IDAgOiAtMSkgKTtcblx0fSxcblxuXHRwcmV2aW91czogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBjb3VudCA9IHRoaXMudWwuY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdHZhciBwb3MgPSB0aGlzLmluZGV4IC0gMTtcblxuXHRcdHRoaXMuZ290byh0aGlzLnNlbGVjdGVkICYmIHBvcyAhPT0gLTEgPyBwb3MgOiBjb3VudCAtIDEpO1xuXHR9LFxuXG5cdC8vIFNob3VsZCBub3QgYmUgdXNlZCwgaGlnaGxpZ2h0cyBzcGVjaWZpYyBpdGVtIHdpdGhvdXQgYW55IGNoZWNrcyFcblx0Z290bzogZnVuY3Rpb24gKGkpIHtcblx0XHR2YXIgbGlzID0gdGhpcy51bC5jaGlsZHJlbjtcblxuXHRcdGlmICh0aGlzLnNlbGVjdGVkKSB7XG5cdFx0XHRsaXNbdGhpcy5pbmRleF0uc2V0QXR0cmlidXRlKFwiYXJpYS1zZWxlY3RlZFwiLCBcImZhbHNlXCIpO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5kZXggPSBpO1xuXG5cdFx0aWYgKGkgPiAtMSAmJiBsaXMubGVuZ3RoID4gMCkge1xuXHRcdFx0bGlzW2ldLnNldEF0dHJpYnV0ZShcImFyaWEtc2VsZWN0ZWRcIiwgXCJ0cnVlXCIpO1xuXHRcdFx0dGhpcy5zdGF0dXMudGV4dENvbnRlbnQgPSBsaXNbaV0udGV4dENvbnRlbnQ7XG5cblx0XHRcdC8vIHNjcm9sbCB0byBoaWdobGlnaHRlZCBlbGVtZW50IGluIGNhc2UgcGFyZW50J3MgaGVpZ2h0IGlzIGZpeGVkXG5cdFx0XHR0aGlzLnVsLnNjcm9sbFRvcCA9IGxpc1tpXS5vZmZzZXRUb3AgLSB0aGlzLnVsLmNsaWVudEhlaWdodCArIGxpc1tpXS5jbGllbnRIZWlnaHQ7XG5cblx0XHRcdCQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLWhpZ2hsaWdodFwiLCB7XG5cdFx0XHRcdHRleHQ6IHRoaXMuc3VnZ2VzdGlvbnNbdGhpcy5pbmRleF1cblx0XHRcdH0pO1xuXHRcdH1cblx0fSxcblxuXHRzZWxlY3Q6IGZ1bmN0aW9uIChzZWxlY3RlZCwgb3JpZ2luKSB7XG5cdFx0aWYgKHNlbGVjdGVkKSB7XG5cdFx0XHR0aGlzLmluZGV4ID0gJC5zaWJsaW5nSW5kZXgoc2VsZWN0ZWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMudWwuY2hpbGRyZW5bdGhpcy5pbmRleF07XG5cdFx0fVxuXG5cdFx0aWYgKHNlbGVjdGVkKSB7XG5cdFx0XHR2YXIgc3VnZ2VzdGlvbiA9IHRoaXMuc3VnZ2VzdGlvbnNbdGhpcy5pbmRleF07XG5cblx0XHRcdHZhciBhbGxvd2VkID0gJC5maXJlKHRoaXMuaW5wdXQsIFwiYXdlc29tcGxldGUtc2VsZWN0XCIsIHtcblx0XHRcdFx0dGV4dDogc3VnZ2VzdGlvbixcblx0XHRcdFx0b3JpZ2luOiBvcmlnaW4gfHwgc2VsZWN0ZWRcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoYWxsb3dlZCkge1xuXHRcdFx0XHR0aGlzLnJlcGxhY2Uoc3VnZ2VzdGlvbik7XG5cdFx0XHRcdHRoaXMuY2xvc2UoeyByZWFzb246IFwic2VsZWN0XCIgfSk7XG5cdFx0XHRcdCQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLXNlbGVjdGNvbXBsZXRlXCIsIHtcblx0XHRcdFx0XHR0ZXh0OiBzdWdnZXN0aW9uXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHRldmFsdWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG1lID0gdGhpcztcblx0XHR2YXIgdmFsdWUgPSB0aGlzLmlucHV0LnZhbHVlO1xuXG5cdFx0aWYgKHZhbHVlLmxlbmd0aCA+PSB0aGlzLm1pbkNoYXJzICYmIHRoaXMuX2xpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5pbmRleCA9IC0xO1xuXHRcdFx0Ly8gUG9wdWxhdGUgbGlzdCB3aXRoIG9wdGlvbnMgdGhhdCBtYXRjaFxuXHRcdFx0dGhpcy51bC5pbm5lckhUTUwgPSBcIlwiO1xuXG5cdFx0XHR0aGlzLnN1Z2dlc3Rpb25zID0gdGhpcy5fbGlzdFxuXHRcdFx0XHQubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFN1Z2dlc3Rpb24obWUuZGF0YShpdGVtLCB2YWx1ZSkpO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQuZmlsdGVyKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0XHRyZXR1cm4gbWUuZmlsdGVyKGl0ZW0sIHZhbHVlKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdGlmICh0aGlzLnNvcnQgIT09IGZhbHNlKSB7XG5cdFx0XHRcdHRoaXMuc3VnZ2VzdGlvbnMgPSB0aGlzLnN1Z2dlc3Rpb25zLnNvcnQodGhpcy5zb3J0KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zdWdnZXN0aW9ucyA9IHRoaXMuc3VnZ2VzdGlvbnMuc2xpY2UoMCwgdGhpcy5tYXhJdGVtcyk7XG5cblx0XHRcdHRoaXMuc3VnZ2VzdGlvbnMuZm9yRWFjaChmdW5jdGlvbih0ZXh0KSB7XG5cdFx0XHRcdFx0bWUudWwuYXBwZW5kQ2hpbGQobWUuaXRlbSh0ZXh0LCB2YWx1ZSkpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0aWYgKHRoaXMudWwuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuY2xvc2UoeyByZWFzb246IFwibm9tYXRjaGVzXCIgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm9wZW4oKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmNsb3NlKHsgcmVhc29uOiBcIm5vbWF0Y2hlc1wiIH0pO1xuXHRcdH1cblx0fVxufTtcblxuLy8gU3RhdGljIG1ldGhvZHMvcHJvcGVydGllc1xuXG5fLmFsbCA9IFtdO1xuXG5fLkZJTFRFUl9DT05UQUlOUyA9IGZ1bmN0aW9uICh0ZXh0LCBpbnB1dCkge1xuXHRyZXR1cm4gUmVnRXhwKCQucmVnRXhwRXNjYXBlKGlucHV0LnRyaW0oKSksIFwiaVwiKS50ZXN0KHRleHQpO1xufTtcblxuXy5GSUxURVJfU1RBUlRTV0lUSCA9IGZ1bmN0aW9uICh0ZXh0LCBpbnB1dCkge1xuXHRyZXR1cm4gUmVnRXhwKFwiXlwiICsgJC5yZWdFeHBFc2NhcGUoaW5wdXQudHJpbSgpKSwgXCJpXCIpLnRlc3QodGV4dCk7XG59O1xuXG5fLlNPUlRfQllMRU5HVEggPSBmdW5jdGlvbiAoYSwgYikge1xuXHRpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIGEubGVuZ3RoIC0gYi5sZW5ndGg7XG5cdH1cblxuXHRyZXR1cm4gYSA8IGI/IC0xIDogMTtcbn07XG5cbl8uSVRFTSA9IGZ1bmN0aW9uICh0ZXh0LCBpbnB1dCkge1xuXHR2YXIgaHRtbCA9IGlucHV0LnRyaW0oKSA9PT0gXCJcIiA/IHRleHQgOiB0ZXh0LnJlcGxhY2UoUmVnRXhwKCQucmVnRXhwRXNjYXBlKGlucHV0LnRyaW0oKSksIFwiZ2lcIiksIFwiPG1hcms+JCY8L21hcms+XCIpO1xuXHRyZXR1cm4gJC5jcmVhdGUoXCJsaVwiLCB7XG5cdFx0aW5uZXJIVE1MOiBodG1sLFxuXHRcdFwiYXJpYS1zZWxlY3RlZFwiOiBcImZhbHNlXCJcblx0fSk7XG59O1xuXG5fLlJFUExBQ0UgPSBmdW5jdGlvbiAodGV4dCkge1xuXHR0aGlzLmlucHV0LnZhbHVlID0gdGV4dC52YWx1ZTtcbn07XG5cbl8uREFUQSA9IGZ1bmN0aW9uIChpdGVtLyosIGlucHV0Ki8pIHsgcmV0dXJuIGl0ZW07IH07XG5cbi8vIFByaXZhdGUgZnVuY3Rpb25zXG5cbmZ1bmN0aW9uIFN1Z2dlc3Rpb24oZGF0YSkge1xuXHR2YXIgbyA9IEFycmF5LmlzQXJyYXkoZGF0YSlcblx0ICA/IHsgbGFiZWw6IGRhdGFbMF0sIHZhbHVlOiBkYXRhWzFdIH1cblx0ICA6IHR5cGVvZiBkYXRhID09PSBcIm9iamVjdFwiICYmIFwibGFiZWxcIiBpbiBkYXRhICYmIFwidmFsdWVcIiBpbiBkYXRhID8gZGF0YSA6IHsgbGFiZWw6IGRhdGEsIHZhbHVlOiBkYXRhIH07XG5cblx0dGhpcy5sYWJlbCA9IG8ubGFiZWwgfHwgby52YWx1ZTtcblx0dGhpcy52YWx1ZSA9IG8udmFsdWU7XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU3VnZ2VzdGlvbi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0cmluZy5wcm90b3R5cGUpLCBcImxlbmd0aFwiLCB7XG5cdGdldDogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmxhYmVsLmxlbmd0aDsgfVxufSk7XG5TdWdnZXN0aW9uLnByb3RvdHlwZS50b1N0cmluZyA9IFN1Z2dlc3Rpb24ucHJvdG90eXBlLnZhbHVlT2YgPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiBcIlwiICsgdGhpcy5sYWJlbDtcbn07XG5cbmZ1bmN0aW9uIGNvbmZpZ3VyZShpbnN0YW5jZSwgcHJvcGVydGllcywgbykge1xuXHRmb3IgKHZhciBpIGluIHByb3BlcnRpZXMpIHtcblx0XHR2YXIgaW5pdGlhbCA9IHByb3BlcnRpZXNbaV0sXG5cdFx0ICAgIGF0dHJWYWx1ZSA9IGluc3RhbmNlLmlucHV0LmdldEF0dHJpYnV0ZShcImRhdGEtXCIgKyBpLnRvTG93ZXJDYXNlKCkpO1xuXG5cdFx0aWYgKHR5cGVvZiBpbml0aWFsID09PSBcIm51bWJlclwiKSB7XG5cdFx0XHRpbnN0YW5jZVtpXSA9IHBhcnNlSW50KGF0dHJWYWx1ZSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGluaXRpYWwgPT09IGZhbHNlKSB7IC8vIEJvb2xlYW4gb3B0aW9ucyBtdXN0IGJlIGZhbHNlIGJ5IGRlZmF1bHQgYW55d2F5XG5cdFx0XHRpbnN0YW5jZVtpXSA9IGF0dHJWYWx1ZSAhPT0gbnVsbDtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoaW5pdGlhbCBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG5cdFx0XHRpbnN0YW5jZVtpXSA9IG51bGw7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSBhdHRyVmFsdWU7XG5cdFx0fVxuXG5cdFx0aWYgKCFpbnN0YW5jZVtpXSAmJiBpbnN0YW5jZVtpXSAhPT0gMCkge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSAoaSBpbiBvKT8gb1tpXSA6IGluaXRpYWw7XG5cdFx0fVxuXHR9XG59XG5cbi8vIEhlbHBlcnNcblxudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG5mdW5jdGlvbiAkKGV4cHIsIGNvbikge1xuXHRyZXR1cm4gdHlwZW9mIGV4cHIgPT09IFwic3RyaW5nXCI/IChjb24gfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3IoZXhwcikgOiBleHByIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uICQkKGV4cHIsIGNvbikge1xuXHRyZXR1cm4gc2xpY2UuY2FsbCgoY29uIHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKGV4cHIpKTtcbn1cblxuJC5jcmVhdGUgPSBmdW5jdGlvbih0YWcsIG8pIHtcblx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG5cblx0Zm9yICh2YXIgaSBpbiBvKSB7XG5cdFx0dmFyIHZhbCA9IG9baV07XG5cblx0XHRpZiAoaSA9PT0gXCJpbnNpZGVcIikge1xuXHRcdFx0JCh2YWwpLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChpID09PSBcImFyb3VuZFwiKSB7XG5cdFx0XHR2YXIgcmVmID0gJCh2YWwpO1xuXHRcdFx0cmVmLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsZW1lbnQsIHJlZik7XG5cdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKHJlZik7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGkgaW4gZWxlbWVudCkge1xuXHRcdFx0ZWxlbWVudFtpXSA9IHZhbDtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZShpLCB2YWwpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxuJC5iaW5kID0gZnVuY3Rpb24oZWxlbWVudCwgbykge1xuXHRpZiAoZWxlbWVudCkge1xuXHRcdGZvciAodmFyIGV2ZW50IGluIG8pIHtcblx0XHRcdHZhciBjYWxsYmFjayA9IG9bZXZlbnRdO1xuXG5cdFx0XHRldmVudC5zcGxpdCgvXFxzKy8pLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XG5cdFx0XHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgY2FsbGJhY2spO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59O1xuXG4kLnVuYmluZCA9IGZ1bmN0aW9uKGVsZW1lbnQsIG8pIHtcblx0aWYgKGVsZW1lbnQpIHtcblx0XHRmb3IgKHZhciBldmVudCBpbiBvKSB7XG5cdFx0XHR2YXIgY2FsbGJhY2sgPSBvW2V2ZW50XTtcblxuXHRcdFx0ZXZlbnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgY2FsbGJhY2spO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59O1xuXG4kLmZpcmUgPSBmdW5jdGlvbih0YXJnZXQsIHR5cGUsIHByb3BlcnRpZXMpIHtcblx0dmFyIGV2dCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KFwiSFRNTEV2ZW50c1wiKTtcblxuXHRldnQuaW5pdEV2ZW50KHR5cGUsIHRydWUsIHRydWUgKTtcblxuXHRmb3IgKHZhciBqIGluIHByb3BlcnRpZXMpIHtcblx0XHRldnRbal0gPSBwcm9wZXJ0aWVzW2pdO1xuXHR9XG5cblx0cmV0dXJuIHRhcmdldC5kaXNwYXRjaEV2ZW50KGV2dCk7XG59O1xuXG4kLnJlZ0V4cEVzY2FwZSA9IGZ1bmN0aW9uIChzKSB7XG5cdHJldHVybiBzLnJlcGxhY2UoL1stXFxcXF4kKis/LigpfFtcXF17fV0vZywgXCJcXFxcJCZcIik7XG59O1xuXG4kLnNpYmxpbmdJbmRleCA9IGZ1bmN0aW9uIChlbCkge1xuXHQvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuXHRmb3IgKHZhciBpID0gMDsgZWwgPSBlbC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nOyBpKyspO1xuXHRyZXR1cm4gaTtcbn07XG5cbi8vIEluaXRpYWxpemF0aW9uXG5cbmZ1bmN0aW9uIGluaXQoKSB7XG5cdCQkKFwiaW5wdXQuYXdlc29tcGxldGVcIikuZm9yRWFjaChmdW5jdGlvbiAoaW5wdXQpIHtcblx0XHRuZXcgXyhpbnB1dCk7XG5cdH0pO1xufVxuXG4vLyBBcmUgd2UgaW4gYSBicm93c2VyPyBDaGVjayBmb3IgRG9jdW1lbnQgY29uc3RydWN0b3JcbmlmICh0eXBlb2YgRG9jdW1lbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0Ly8gRE9NIGFscmVhZHkgbG9hZGVkP1xuXHRpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gXCJsb2FkaW5nXCIpIHtcblx0XHRpbml0KCk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0Ly8gV2FpdCBmb3IgaXRcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCBpbml0KTtcblx0fVxufVxuXG5fLiQgPSAkO1xuXy4kJCA9ICQkO1xuXG4vLyBNYWtlIHN1cmUgdG8gZXhwb3J0IEF3ZXNvbXBsZXRlIG9uIHNlbGYgd2hlbiBpbiBhIGJyb3dzZXJcbmlmICh0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRzZWxmLkF3ZXNvbXBsZXRlID0gXztcbn1cblxuLy8gRXhwb3NlIEF3ZXNvbXBsZXRlIGFzIGEgQ0pTIG1vZHVsZVxuaWYgKHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCIgJiYgbW9kdWxlLmV4cG9ydHMpIHtcblx0bW9kdWxlLmV4cG9ydHMgPSBfO1xufVxuXG5yZXR1cm4gXztcblxufSgpKTtcbiIsIi8qKlxuICogUmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0LCBhcyBsb25nIGFzIGl0IGNvbnRpbnVlcyB0byBiZSBpbnZva2VkLCB3aWxsIG5vdFxuICogYmUgdHJpZ2dlcmVkLiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgaXQgc3RvcHMgYmVpbmcgY2FsbGVkIGZvclxuICogTiBtaWxsaXNlY29uZHMuIElmIGBpbW1lZGlhdGVgIGlzIHBhc3NlZCwgdHJpZ2dlciB0aGUgZnVuY3Rpb24gb24gdGhlXG4gKiBsZWFkaW5nIGVkZ2UsIGluc3RlYWQgb2YgdGhlIHRyYWlsaW5nLiBUaGUgZnVuY3Rpb24gYWxzbyBoYXMgYSBwcm9wZXJ0eSAnY2xlYXInIFxuICogdGhhdCBpcyBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgY2xlYXIgdGhlIHRpbWVyIHRvIHByZXZlbnQgcHJldmlvdXNseSBzY2hlZHVsZWQgZXhlY3V0aW9ucy4gXG4gKlxuICogQHNvdXJjZSB1bmRlcnNjb3JlLmpzXG4gKiBAc2VlIGh0dHA6Ly91bnNjcmlwdGFibGUuY29tLzIwMDkvMDMvMjAvZGVib3VuY2luZy1qYXZhc2NyaXB0LW1ldGhvZHMvXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvbiB0byB3cmFwXG4gKiBAcGFyYW0ge051bWJlcn0gdGltZW91dCBpbiBtcyAoYDEwMGApXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHdoZXRoZXIgdG8gZXhlY3V0ZSBhdCB0aGUgYmVnaW5uaW5nIChgZmFsc2VgKVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlYm91bmNlKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSl7XG4gIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXAsIHJlc3VsdDtcbiAgaWYgKG51bGwgPT0gd2FpdCkgd2FpdCA9IDEwMDtcblxuICBmdW5jdGlvbiBsYXRlcigpIHtcbiAgICB2YXIgbGFzdCA9IERhdGUubm93KCkgLSB0aW1lc3RhbXA7XG5cbiAgICBpZiAobGFzdCA8IHdhaXQgJiYgbGFzdCA+PSAwKSB7XG4gICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgIGlmICghaW1tZWRpYXRlKSB7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgdmFyIGRlYm91bmNlZCA9IGZ1bmN0aW9uKCl7XG4gICAgY29udGV4dCA9IHRoaXM7XG4gICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIHZhciBjYWxsTm93ID0gaW1tZWRpYXRlICYmICF0aW1lb3V0O1xuICAgIGlmICghdGltZW91dCkgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgIGlmIChjYWxsTm93KSB7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgZGVib3VuY2VkLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgfTtcbiAgXG4gIGRlYm91bmNlZC5mbHVzaCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgXG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIGRlYm91bmNlZDtcbn07XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9nZW9wbGV0ZScpO1xuIl19
