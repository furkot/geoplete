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

var keepOpen = {
  esc: true
};

function displayAll() {
  return true;
}

function geoplete(el, options) {
  options = options || {};
  options.type = Suggestions[options.type] ? options.type : 'address';
  options.minChars = options.minChars || 4;
  var acOptions = {
    minChars: 0,
    item: options.item || Awesomplete.ITEM,
    filter: displayAll
  };


  var geoOptions = options.geocoder || defaultGeocoder;

  var lastValue;
  var outstandingRequest;
  var geocode = furkotGeocode(geoOptions);
  var ac = new Awesomplete(el, acOptions);

  if (options.keepOpen) {
    ac.close = function (close, o) {
      if (o && o.reason && keepOpen[o.reason]) {
        return;
      }
      close.apply(this, Array.prototype.slice.call(arguments, 1));
    }.bind(ac, ac.close);
    el.removeEventListener('blur', ac._events.input.blur);
  }

  var oninput = debounce(function() {
    if (el.value.length < options.minChars) {
      populate([]);
      return;
    }
    query(el.value);
  }, 300);

  function onchange(event) {
    var value = event.text.value;
    var changeEvent = new CustomEvent('geoplete-change', { detail: value });
    el.dispatchEvent(changeEvent);
  }

  function fromPlace(place) {
    return Object.assign(Object.create(Suggestions[options.type]), place);
  }

  function query(value) {
    if (lastValue && lastValue.value === value) {
      // do not requery for the same value
      if (lastValue.result) {
        populate(lastValue.result);
      }
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
    lastValue = {
      value: value
    };
    el.classList.add('geoplete-in-progress');
    outstandingRequest = geocode(params, function(result) {
      el.classList.remove('geoplete-in-progress');
      if (!result || !result.places) {
        // no results
        return;
      }
      lastValue.result = result.places;
      populate(result.places);
    });
  }

  function populate(places) {
    ac.list = places.map(fromPlace);
    ac.evaluate();
    var listEvent = new CustomEvent('geoplete-list', { detail: places });
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
    populate: populate,
    set: set,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9mdXJrb3QvZ2VvY29kZS9pbmRleC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9nZW9jb2RlLmpzIiwiLi4vZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2UvYWxnb2xpYS9pbmRleC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2Uvb3BlbmNhZ2UvaW5kZXguanMiLCIuLi9mdXJrb3QvZ2VvY29kZS9saWIvc2VydmljZS9zdGF0ZXMuanNvbiIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL3N0YXR1cy5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zZXJ2aWNlL3RpbGVob3N0aW5nL2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbGliL3NlcnZpY2UvdXRpbC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL2xpYi9zdHJhdGVneS5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvYnJvd3Nlci5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvZGVidWcuanMiLCIuLi9mdXJrb3QvZ2VvY29kZS9ub2RlX21vZHVsZXMvZmV0Y2hhZ2VudC9pbmRleC5qcyIsIi4uL2Z1cmtvdC9nZW9jb2RlL25vZGVfbW9kdWxlcy9mZXRjaGFnZW50L2xpYi9mZXRjaGFnZW50LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbm9kZV9tb2R1bGVzL2xpbWl0ZXItY29tcG9uZW50L2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwiLi4vZnVya290L2dlb2NvZGUvbm9kZV9tb2R1bGVzL3J1bi13YXRlcmZhbGwvaW5kZXguanMiLCJsaWIvZ2VvcGxldGUuanMiLCJub2RlX21vZHVsZXMvYXdlc29tcGxldGUvYXdlc29tcGxldGUuanMiLCJub2RlX21vZHVsZXMvZGVib3VuY2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pPQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDamZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9nZW9jb2RlJyk7XG4iLCJ2YXIgc3RyYXRlZ3kgPSByZXF1aXJlKCcuL3N0cmF0ZWd5Jyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vc2VydmljZS91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVya290R2VvY29kZTtcblxuZnVuY3Rpb24gc2tpcChvcHRpb25zLCBxdWVyeSwgcmVzdWx0KSB7XG4gIC8vIHNvbWUgb3RoZXIgc2VydmljZSBhbHJlYWR5IHJldHVybmVkIHJlc3VsdFxuICAvLyBvciBzZXJ2aWNlIGlzIGRpc2FibGVkXG4gIHJldHVybiAocmVzdWx0ICYmIHJlc3VsdC5wbGFjZXMgJiYgcmVzdWx0LnBsYWNlcy5sZW5ndGgpIHx8ICFvcHRpb25zLmVuYWJsZShxdWVyeSwgcmVzdWx0KTtcbn1cblxudmFyIHNlcnZpY2VzID0ge1xuICBhbGdvbGlhOiB7XG4gICAgaW5pdDogcmVxdWlyZSgnLi9zZXJ2aWNlL2FsZ29saWEnKVxuICB9LFxuICBvcGVuY2FnZToge1xuICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9vcGVuY2FnZScpXG4gIH0sXG4gIHRpbGVob3N0aW5nOiB7XG4gICAgaW5pdDogcmVxdWlyZSgnLi9zZXJ2aWNlL3RpbGVob3N0aW5nJylcbiAgfVxufTtcblxuLy9kZWZhdWx0IHRpbWVvdXQgdG8gY29tcGxldGUgb3BlcmF0aW9uXG52YXIgZGVmYXVsdFRpbWVvdXQgPSAyMCAqIDEwMDA7XG52YXIgaWQgPSAwO1xuXG5mdW5jdGlvbiBmdXJrb3RHZW9jb2RlKG9wdGlvbnMpIHtcbiAgdmFyIG9wZXJhdGlvbnM7XG5cbiAgZnVuY3Rpb24gZ2VvY29kZShxdWVyeSwgZm4pIHtcbiAgICB2YXIgdGltZW91dElkLCBxdWVyeUlkLCBvcCwgYWJvcnRlZDtcblxuICAgIGZ1bmN0aW9uIGFib3J0KCkge1xuICAgICAgYWJvcnRlZCA9IHRydWU7XG4gICAgICBpZiAodGltZW91dElkKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICB0aW1lb3V0SWQgPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICAvLyBjYW5jZWwgb3V0c3RhbmRpbmcgcmVxdWVzdHNcbiAgICAgIG9wZXJhdGlvbnMuYWJvcnQuZm9yRWFjaChmdW5jdGlvbiAoYWJvcnQpIHtcbiAgICAgICAgYWJvcnQocXVlcnlJZCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICBmbigpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBvcCA9IHF1ZXJ5LmxsID8gJ3JldmVyc2UnIDogJ2ZvcndhcmQnO1xuICAgIGlmICghKG9wZXJhdGlvbnNbb3BdICYmIG9wZXJhdGlvbnNbb3BdLmxlbmd0aCkpIHtcbiAgICAgIGZuKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWQgKz0gMTtcbiAgICBxdWVyeUlkID0gaWQ7XG4gICAgdGltZW91dElkID0gc2V0VGltZW91dChhYm9ydCwgb3B0aW9ucy50aW1lb3V0KTtcbiAgICBzdHJhdGVneShvcGVyYXRpb25zW29wXSwgcXVlcnlJZCwgcXVlcnksIHt9LCBmdW5jdGlvbiAoZXJyLCBxdWVyeUlkLCBxdWVyeSwgcmVzdWx0KSB7XG4gICAgICBpZiAodGltZW91dElkKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICB0aW1lb3V0SWQgPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZXJyIHx8IGFib3J0ZWQpIHtcbiAgICAgICAgcmV0dXJuIGZuKCk7XG4gICAgICB9XG4gICAgICBmbihyZXN1bHQpO1xuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBhYm9ydDogYWJvcnRcbiAgICB9O1xuICB9XG5cbiAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIHRpbWVvdXQ6IGRlZmF1bHRUaW1lb3V0LFxuICAgIG9yZGVyOiBbJ29wZW5jYWdlJ10sXG4gICAgc2tpcDogc2tpcFxuICB9KTtcbiAgb3BlcmF0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywge1xuICAgIGFib3J0OiBbXVxuICB9KTtcbiAgWydmb3J3YXJkJywgJ3JldmVyc2UnXS5yZWR1Y2UoZnVuY3Rpb24gKG9wdGlvbnMsIG9wKSB7XG4gICAgaWYgKCFvcGVyYXRpb25zW29wXSkge1xuICAgICAgb3BlcmF0aW9uc1tvcF0gPSBvcHRpb25zLm9yZGVyLnJlZHVjZShmdW5jdGlvbiAocmVzdWx0LCBuYW1lKSB7XG4gICAgICAgIHZhciBzZXJ2aWNlID0gc2VydmljZXNbbmFtZV07XG4gICAgICAgIGlmIChzZXJ2aWNlICYmIG9wdGlvbnNbKG5hbWUgKyAnX2VuYWJsZScpXSkge1xuICAgICAgICAgIGlmICghc2VydmljZS5zZXJ2aWNlKSB7XG4gICAgICAgICAgICBzZXJ2aWNlLnNlcnZpY2UgPSBzZXJ2aWNlLmluaXQodXRpbC5kZWZhdWx0cyh7XG4gICAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICAgIGxpbWl0ZXI6IG9wdGlvbnNbKG5hbWUgKyAnX2xpbWl0ZXInKV0sXG4gICAgICAgICAgICAgIGVuYWJsZTogb3B0aW9uc1sobmFtZSArICdfZW5hYmxlJyldLFxuICAgICAgICAgICAgICBza2lwOiBzZXJ2aWNlLnNraXBcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpKTtcbiAgICAgICAgICAgIG9wZXJhdGlvbnMuYWJvcnQucHVzaChzZXJ2aWNlLnNlcnZpY2UuYWJvcnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VydmljZS5zZXJ2aWNlW29wXSAmJiBzZXJ2aWNlLnNlcnZpY2UuZ2VvY29kZSkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goc2VydmljZS5zZXJ2aWNlLmdlb2NvZGUuYmluZCh1bmRlZmluZWQsIG9wKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9LCBbXSk7XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xuICB9LCBvcHRpb25zKTtcblxuICBnZW9jb2RlLm9wdGlvbnMgPSBvcGVyYXRpb25zO1xuICByZXR1cm4gZ2VvY29kZTtcbn1cbiIsInZhciBzdGF0ZXMgPSByZXF1aXJlKCcuLi9zdGF0ZXMnKTtcbnZhciBzdGF0dXMgPSByZXF1aXJlKCcuLi9zdGF0dXMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbmZ1bmN0aW9uIGdldFVybCh1cmwsIGtleSwgaWQpIHtcbiAgaWYgKGtleSAmJiBpZCkge1xuICAgIHVybCArPSAnP3gtYWxnb2xpYS1hcGkta2V5PScgKyBrZXkgKyAnJngtYWxnb2xpYS1hcHBsaWNhdGlvbi1pZD0nICsgaWQ7XG4gIH1cbiAgcmV0dXJuIHVybDtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVJlcXVlc3Qob3AsIHF1ZXJ5KSB7XG4gIHZhciByZXEgPSB7XG4gICAgcXVlcnk6IHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UsXG4gICAgbGFuZ3VhZ2U6IHF1ZXJ5LmxhbmcgPyBxdWVyeS5sYW5nLnNwbGl0KCdfJykucG9wKCkgOiAnZW4nLFxuICAgIGFyb3VuZExhdExuZ1ZpYUlQOiBmYWxzZVxuICB9O1xuICBpZiAocXVlcnkuYm91bmRzKSB7XG4gICAgcmVxLmFyb3VuZExhdExuZyA9IG1pZChxdWVyeS5ib3VuZHNbMF1bMV0sIHF1ZXJ5LmJvdW5kc1sxXVsxXSkgK1xuICAgICAgJywnICsgbWlkKHF1ZXJ5LmJvdW5kc1swXVswXSwgcXVlcnkuYm91bmRzWzBdWzFdKTtcbiAgfVxuICBpZiAocXVlcnkuYWRkcmVzcykge1xuICAgIHJlcS50eXBlID0gJ2FkZHJlc3MnO1xuICB9XG4gIHJldHVybiByZXE7XG59XG5cbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIGlmICghKHJlc3BvbnNlICYmIHJlc3BvbnNlLm5iSGl0cykpIHtcbiAgICByZXR1cm4gc3RhdHVzLmVtcHR5O1xuICB9XG4gIHJldHVybiBzdGF0dXMuc3VjY2Vzcztcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlLCBxdWVyeSwgcmVzdWx0KSB7XG4gIGlmICghKHJlc3BvbnNlICYmIHJlc3BvbnNlLmhpdHMgJiYgcmVzcG9uc2UuaGl0cy5sZW5ndGgpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHJlc3VsdC5wbGFjZXMgPSByZXNwb25zZS5oaXRzLm1hcChmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgdmFyIGdlb20gPSByZXN1bHQuX2dlb2xvYywgcmVzID0ge1xuICAgICAgbGw6IFsgZ2VvbS5sbmcsIGdlb20ubGF0IF1cbiAgICB9LCBhZGRyID0gW107XG4gICAgaWYgKHJlc3VsdC5pc19oaWdod2F5KSB7XG4gICAgICByZXMudHlwZSA9ICdyb2FkJztcbiAgICB9XG4gICAgZWxzZSBpZiAocmVzdWx0Ll90YWdzICYmIHJlc3VsdC5fdGFncy5sZW5ndGgpe1xuICAgICAgcmVzLnR5cGUgPSByZXN1bHQuX3RhZ3NbMF07XG4gICAgfVxuICAgIGlmIChyZXN1bHQubG9jYWxlX25hbWVzICYmIHJlc3VsdC5sb2NhbGVfbmFtZXMubGVuZ3RoKSB7XG4gICAgICBpZiAocmVzLnR5cGUgPT09ICdyb2FkJykge1xuICAgICAgICByZXMuc3RyZWV0ID0gcmVzdWx0LmxvY2FsZV9uYW1lc1swXTtcbiAgICAgICAgYWRkci5wdXNoKHJlcy5zdHJlZXQpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJlcy5wbGFjZSA9IHJlc3VsdC5sb2NhbGVfbmFtZXNbMF07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChyZXN1bHQuY2l0eSAmJiByZXN1bHQuY2l0eS5sZW5ndGgpIHtcbiAgICAgIHJlcy50b3duID0gcmVzdWx0LmNpdHlbMF07XG4gICAgICBhZGRyLnB1c2gocmVzLnRvd24pO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LmNvdW50eSAmJiByZXN1bHQuY291bnR5Lmxlbmd0aCkge1xuICAgICAgcmVzLmNvdW50eSA9IHJlc3VsdC5jb3VudHlbMF07XG4gICAgICBpZiAoIXJlcy50b3duKSB7XG4gICAgICAgIGFkZHIucHVzaChyZXMuY291bnR5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJlc3VsdC5hZG1pbmlzdHJhdGl2ZSAmJiByZXN1bHQuYWRtaW5pc3RyYXRpdmUubGVuZ3RoKSB7XG4gICAgICByZXMucHJvdmluY2UgPSBzdGF0ZXNbcmVzdWx0LmFkbWluaXN0cmF0aXZlWzBdXSB8fCByZXN1bHQuYWRtaW5pc3RyYXRpdmVbMF07XG4gICAgICBhZGRyLnB1c2gocmVzLnByb3ZpbmNlKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC5jb3VudHJ5KSB7XG4gICAgICByZXMuY291bnRyeSA9IHJlc3VsdC5jb3VudHJ5O1xuICAgICAgaWYgKHJlcy5jb3VudHJ5ID09PSAnVW5pdGVkIFN0YXRlcyBvZiBBbWVyaWNhJykge1xuICAgICAgICByZXMuY291bnRyeSA9ICdVU0EnO1xuICAgICAgfVxuICAgICAgYWRkci5wdXNoKHJlcy5jb3VudHJ5KTtcbiAgICB9XG4gICAgcmVzLmFkZHJlc3MgPSBhZGRyLmpvaW4oJywgJyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGluaXQob3B0aW9ucykge1xuXG4gIGlmIChvcHRpb25zLmFsZ29saWFfcGFyYW1ldGVycykge1xuICAgIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIG9wdGlvbnMuYWxnb2xpYV9wYXJhbWV0ZXJzKTtcbiAgfVxuICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCB7XG4gICAgZm9yd2FyZDogdHJ1ZSxcbiAgICBwb3N0OiB0cnVlLFxuICAgIHVybDogZ2V0VXJsKG9wdGlvbnMuYWxnb2xpYV91cmwgfHwgJ2h0dHBzOi8vcGxhY2VzLWRzbi5hbGdvbGlhLm5ldC8xL3BsYWNlcy9xdWVyeScsXG4gICAgICBvcHRpb25zLmFsZ29saWFfa2V5LFxuICAgICAgb3B0aW9ucy5hbGdvbGlhX2FwcF9pZCksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3Q6IHByZXBhcmVSZXF1ZXN0LFxuICAgIHByb2Nlc3NSZXNwb25zZTogcHJvY2Vzc1Jlc3BvbnNlXG4gIH0pO1xuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gbWlkKHYxLCB2Mikge1xuICByZXR1cm4gKHYxICsgdjIpIC8gMjtcbn0iLCJ2YXIgZmV0Y2hhZ2VudCA9IHJlcXVpcmUoJ2ZldGNoYWdlbnQnKTtcbnZhciBzdGF0dXMgPSByZXF1aXJlKCcuL3N0YXR1cycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2Z1cmtvdDpnZW9jb2RlOnNlcnZpY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG52YXIgbGltaXRlcnMgPSB7fTtcblxudmFyIEVSUk9SID0gJ2lucHV0IGVycm9yJztcblxuZnVuY3Rpb24gcmVxdWVzdCh1cmwsIHJlcSwgZm4pIHtcbiAgdmFyIG9wdGlvbnMgPSB0aGlzLCBmYSA9IGZldGNoYWdlbnQ7XG4gIGlmIChvcHRpb25zLnBvc3QpIHtcbiAgICBmYSA9IGZhLnBvc3QodXJsKS5zZW5kKHJlcSk7XG4gIH1cbiAgZWxzZSB7XG4gICAgZmEgPSBmYS5nZXQodXJsKS5xdWVyeShyZXEpO1xuICB9XG4gIHJldHVybiBmYVxuICAgIC5zZXQoJ2FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAuZW5kKGZuKTtcbn1cblxuZnVuY3Rpb24gaW5pdFVybCh1cmwpIHtcbiAgaWYgKHR5cGVvZiB1cmwgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gdXJsO1xuICB9XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHVybDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG4gIHZhciBsaW1pdGVyLCBob2xkUmVxdWVzdHMsIG91dHN0YW5kaW5nID0ge307XG5cbiAgZnVuY3Rpb24gYWJvcnQocXVlcnlJZCkge1xuICAgIGRlYnVnKCdhYm9ydCcsIHF1ZXJ5SWQpO1xuICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gY2FuY2VsIGxhdGVyIHJlcXVlc3QgaWYgc2NoZWR1bGVkXG4gICAgaWYgKG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmxhdGVyVGltZW91dElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQob3V0c3RhbmRpbmdbcXVlcnlJZF0ubGF0ZXJUaW1lb3V0SWQpO1xuICAgIH1cbiAgICAvLyBjYW5jZWwgcmVxdWVzdCBpbiBwcm9ncmVzc1xuICAgIGlmIChvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzKSB7XG4gICAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzLmFib3J0KCk7XG4gICAgfVxuICAgIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmNhbGxiYWNrKEVSUk9SKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdlb2NvZGUob3AsIHF1ZXJ5SWQsIHF1ZXJ5LCByZXN1bHQsIGZuKSB7XG5cbiAgICBmdW5jdGlvbiByZXF1ZXN0TGF0ZXIoKSB7XG4gICAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5sYXRlclRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAob3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgICBkZWxldGUgb3V0c3RhbmRpbmdbcXVlcnlJZF0ubGF0ZXJUaW1lb3V0SWQ7XG4gICAgICAgIH1cbiAgICAgICAgZXhlY3V0ZVF1ZXJ5KCk7XG4gICAgICB9LCBvcHRpb25zLnBlbmFsdHlUaW1lb3V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlUXVlcnkoY2FsbGJhY2spIHtcbiAgICAgIHZhciByZXE7XG5cbiAgICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgLy8gcXVlcnkgaGFzIGJlZW4gYWJvcnRlZFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoaG9sZFJlcXVlc3RzKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgICAgcmVxID0gb3B0aW9ucy5wcmVwYXJlUmVxdWVzdChvcCwgcXVlcnkpO1xuICAgICAgaWYgKCFyZXEpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICB9XG4gICAgICBpZiAocmVxID09PSB0cnVlKSB7XG4gICAgICAgIHJlcSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgbGltaXRlci50cmlnZ2VyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFvdXRzdGFuZGluZ1txdWVyeUlkXSkge1xuICAgICAgICAgIC8vIHF1ZXJ5IGhhcyBiZWVuIGFib3J0ZWRcbiAgICAgICAgICBsaW1pdGVyLnNraXAoKTsgLy8gaW1tZWRpYXRlbHkgcHJvY2VzcyB0aGUgbmV4dCByZXF1ZXN0IGluIHRoZSBxdWV1ZVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBxdWVyeS5zdGF0cyA9IHF1ZXJ5LnN0YXRzIHx8IFtdO1xuICAgICAgICBxdWVyeS5zdGF0cy5wdXNoKG9wdGlvbnMubmFtZSk7XG4gICAgICAgIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLnJlcUluUHJvZ3Jlc3MgPSBvcHRpb25zLnJlcXVlc3Qob3B0aW9ucy51cmwob3AsIHF1ZXJ5KSwgcmVxLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgIHZhciBzdCwgcmVzO1xuICAgICAgICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgICAgIC8vIHF1ZXJ5IGhhcyBiZWVuIGFib3J0ZWRcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLnJlcUluUHJvZ3Jlc3M7XG4gICAgICAgICAgc3QgPSBvcHRpb25zLnN0YXR1cyhlcnIsIHJlc3BvbnNlKTtcbiAgICAgICAgICBpZiAoc3QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gc2hvdWxkbid0IGhhcHBlbiAoYnVnIG9yIHVuZXhwZWN0ZWQgcmVzcG9uc2UgZm9ybWF0KVxuICAgICAgICAgICAgLy8gdHJlYXQgaXQgYXMgbm8gcmVzdWx0XG4gICAgICAgICAgICBzdCA9IHN0YXR1cy5lbXB0eTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0ID09PSBzdGF0dXMuZmFpbHVyZSkge1xuICAgICAgICAgICAgLy8gZG9uJ3QgZXZlciBhc2sgYWdhaW5cbiAgICAgICAgICAgIGhvbGRSZXF1ZXN0cyA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0ID09PSBzdGF0dXMuZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIHRyeSBhZ2FpbiBsYXRlclxuICAgICAgICAgICAgbGltaXRlci5wZW5hbHR5KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdExhdGVyKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHN0ID09PSBzdGF0dXMuc3VjY2Vzcykge1xuICAgICAgICAgICAgcmVzID0gb3B0aW9ucy5wcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQgfHwge30pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjayh1bmRlZmluZWQsIHJlcyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgb3V0c3RhbmRpbmdbcXVlcnlJZF0gPSB7XG4gICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7XG4gICAgICAgIHZhciBmaW5pc2hlZCA9IEJvb2xlYW4ocmVzdWx0KTtcbiAgICAgICAgZGVsZXRlIG91dHN0YW5kaW5nW3F1ZXJ5SWRdO1xuICAgICAgICByZXN1bHQgPSByZXN1bHQgfHwge307XG4gICAgICAgIHJlc3VsdC5zdGF0cyA9IHF1ZXJ5LnN0YXRzO1xuICAgICAgICByZXN1bHQucHJvdmlkZXIgPSBvcHRpb25zLm5hbWU7XG4gICAgICAgIGZuKGVyciwgZmluaXNoZWQsIHF1ZXJ5SWQsIHF1ZXJ5LCByZXN1bHQpO1xuICAgICAgfVxuICAgIH07XG4gICAgZXhlY3V0ZVF1ZXJ5KG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmNhbGxiYWNrKTtcbiAgfVxuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBpbnRlcnZhbDogMzQwLFxuICAgIHBlbmFsdHlJbnRlcnZhbDogMjAwMCxcbiAgICBsaW1pdGVyOiBsaW1pdGVyc1tvcHRpb25zLm5hbWVdLFxuICAgIHJlcXVlc3Q6IHJlcXVlc3QsXG4gICAgYWJvcnQ6IGFib3J0XG4gIH0pO1xuICBvcHRpb25zLnVybCA9IGluaXRVcmwob3B0aW9ucy51cmwpO1xuICBsaW1pdGVyc1tvcHRpb25zLm5hbWVdID0gb3B0aW9ucy5saW1pdGVyIHx8IHJlcXVpcmUoJ2xpbWl0ZXItY29tcG9uZW50Jykob3B0aW9ucy5pbnRlcnZhbCwgb3B0aW9ucy5wZW5hbHR5SW50ZXJ2YWwpO1xuICBsaW1pdGVyID0gbGltaXRlcnNbb3B0aW9ucy5uYW1lXTtcbiAgXG4gIHJldHVybiB7XG4gICAgZm9yd2FyZDogb3B0aW9ucy5mb3J3YXJkLFxuICAgIHJldmVyc2U6IG9wdGlvbnMucmV2ZXJzZSxcbiAgICBnZW9jb2RlOiBnZW9jb2RlLFxuICAgIGFib3J0OiBvcHRpb25zLmFib3J0XG4gIH07XG59XG4iLCJ2YXIgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxudmFyIGNvZGUyc3RhdHVzID0ge1xuICAyMDA6IHN0YXR1cy5zdWNjZXNzLCAvLyBPSyAoemVybyBvciBtb3JlIHJlc3VsdHMgd2lsbCBiZSByZXR1cm5lZClcbiAgNDAwOiBzdGF0dXMuZW1wdHksICAgLy8gSW52YWxpZCByZXF1ZXN0IChiYWQgcmVxdWVzdDsgYSByZXF1aXJlZCBwYXJhbWV0ZXIgaXMgbWlzc2luZzsgaW52YWxpZCBjb29yZGluYXRlcylcbiAgNDAyOiBzdGF0dXMuZmFpbHVyZSwgLy8gVmFsaWQgcmVxdWVzdCBidXQgcXVvdGEgZXhjZWVkZWQgKHBheW1lbnQgcmVxdWlyZWQpXG4gIDQwMzogc3RhdHVzLmZhaWx1cmUsIC8vIEludmFsaWQgb3IgbWlzc2luZyBhcGkga2V5IChmb3JiaWRkZW4pXG4gIDQwNDogc3RhdHVzLmZhaWx1cmUsIC8vIEludmFsaWQgQVBJIGVuZHBvaW50XG4gIDQwODogc3RhdHVzLmVycm9yLCAgIC8vIFRpbWVvdXQ7IHlvdSBjYW4gdHJ5IGFnYWluXG4gIDQxMDogc3RhdHVzLmVtcHR5LCAgIC8vIFJlcXVlc3QgdG9vIGxvbmdcbiAgNDI5OiBzdGF0dXMuZXJyb3IsICAgLy8gVG9vIG1hbnkgcmVxdWVzdHMgKHRvbyBxdWlja2x5LCByYXRlIGxpbWl0aW5nKVxuICA1MDM6IHN0YXR1cy5lbXB0eSAgICAvLyBJbnRlcm5hbCBzZXJ2ZXIgZXJyb3Jcbn07XG5cbnZhciBnZW90eXBlcyA9IFtcbiAgJ3JvYWQnLFxuICAnbmVpZ2hib3VyaG9vZCcsXG4gICdzdWJ1cmInLFxuICAndG93bicsXG4gICdjaXR5JyxcbiAgJ2NvdW50eScsXG4gICdzdGF0ZScsXG4gICdjb3VudHJ5J1xuXS5yZWR1Y2UoZnVuY3Rpb24gKHJlc3VsdCwgdHlwZSkge1xuICByZXN1bHRbdHlwZV0gPSB0eXBlO1xuICByZXR1cm4gcmVzdWx0O1xufSwge30pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbi8vIHJlc3BvbnNlIGNvZGVzOiBodHRwczovL2dlb2NvZGVyLm9wZW5jYWdlZGF0YS5jb20vYXBpI2NvZGVzXG5mdW5jdGlvbiBnZXRTdGF0dXMoZXJyLCByZXNwb25zZSkge1xuICB2YXIgY29kZSA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLnN0YXR1cyAmJiByZXNwb25zZS5zdGF0dXMuY29kZTtcbiAgaWYgKCFyZXNwb25zZSkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb2RlID0gY29kZTJzdGF0dXNbY29kZV07XG4gIGlmIChjb2RlID09PSBzdGF0dXMuc3VjY2VzcyAmJiAhKHJlc3BvbnNlLnJlc3VsdHMgJiYgcmVzcG9uc2UucmVzdWx0cy5sZW5ndGgpKSB7XG4gICAgY29kZSA9IHN0YXR1cy5lbXB0eTtcbiAgfVxuICByZXR1cm4gY29kZSB8fCBzdGF0dXMuZXJyb3I7XG59XG5cbmZ1bmN0aW9uIGdldFVybCh1cmwsIGtleSwgb3AsIHF1ZXJ5KSB7XG4gIHZhciBxO1xuICBpZiAob3AgPT09ICdmb3J3YXJkJykge1xuICAgIHEgPSAocXVlcnkuYWRkcmVzcyB8fCBxdWVyeS5wbGFjZSkucmVwbGFjZSgvIC9nLCAnKycpLnJlcGxhY2UoLywvZywgJyUyQycpO1xuICB9XG4gIGVsc2Uge1xuICAgIHEgPSBxdWVyeS5sbFsxXSArICcrJyArIHF1ZXJ5LmxsWzBdO1xuICB9XG4gIHVybCArPSAnP3E9JyArIHE7XG4gIGlmIChxdWVyeS5ib3VuZHMpIHtcbiAgICB1cmwgKz0gJyZib3VuZHM9JyArIHF1ZXJ5LmJvdW5kcy5tYXAoam9pbikuam9pbignLCcpO1xuICB9XG4gIGlmIChxdWVyeS5sYW5nKSB7XG4gICAgdXJsICs9ICcmbGFuZ3VhZ2U9JyArIHF1ZXJ5Lmxhbmc7XG4gIH1cbiAgdXJsICs9ICcmbm9fYW5ub3RhdGlvbnM9MSc7XG4gIHJldHVybiB1cmwgKyAnJmtleT0nICsga2V5O1xufVxuXG5mdW5jdGlvbiBwcmVwYXJlUmVxdWVzdCgpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGluaXQob3B0aW9ucykge1xuXG4gIGZ1bmN0aW9uIHByb2Nlc3NSZXNwb25zZShyZXNwb25zZSwgcXVlcnksIHJlc3VsdCkge1xuICAgIGlmICghKHJlc3BvbnNlICYmIHJlc3BvbnNlLnJlc3VsdHMgJiYgcmVzcG9uc2UucmVzdWx0cy5sZW5ndGgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJlc3VsdC5wbGFjZXMgPSByZXNwb25zZS5yZXN1bHRzLm1hcChmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICB2YXIgY29tcG9uZW50cyA9IHJlc3VsdC5jb21wb25lbnRzLCBnZW9tID0gcmVzdWx0Lmdlb21ldHJ5LCByZXMgPSB7XG4gICAgICAgICAgbGw6IFsgZ2VvbS5sbmcsIGdlb20ubGF0IF1cbiAgICAgIH0sIGFkZHI7XG4gICAgICBpZiAoY29tcG9uZW50cy5fdHlwZSkge1xuICAgICAgICByZXMudHlwZSA9IGNvbXBvbmVudHMuX3R5cGU7XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50c1tjb21wb25lbnRzLl90eXBlXSkge1xuICAgICAgICByZXMucGxhY2UgPSBjb21wb25lbnRzW2NvbXBvbmVudHMuX3R5cGVdO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMuaG91c2VfbnVtYmVyKSB7XG4gICAgICAgIHJlcy5ob3VzZSA9IGNvbXBvbmVudHMuaG91c2VfbnVtYmVyO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMucm9hZCB8fCBjb21wb25lbnRzLnBlZGVzdHJpYW4pIHtcbiAgICAgICAgcmVzLnN0cmVldCA9IGNvbXBvbmVudHMucm9hZCB8fCBjb21wb25lbnRzLnBlZGVzdHJpYW47XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5uZWlnaGJvdXJob29kIHx8IGNvbXBvbmVudHMudmlsbGFnZSkge1xuICAgICAgICByZXMuY29tbXVuaXR5ID0gY29tcG9uZW50cy5uZWlnaGJvdXJob29kIHx8IGNvbXBvbmVudHMudmlsbGFnZTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLnRvd24gfHwgY29tcG9uZW50cy5jaXR5KSB7XG4gICAgICAgIHJlcy50b3duID0gY29tcG9uZW50cy50b3duIHx8IGNvbXBvbmVudHMuY2l0eTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLmNvdW50eSkge1xuICAgICAgICByZXMuY291bnR5ID0gY29tcG9uZW50cy5jb3VudHk7XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5zdGF0ZV9jb2RlKSB7XG4gICAgICAgIHJlcy5wcm92aW5jZSA9IGNvbXBvbmVudHMuc3RhdGVfY29kZTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLmNvdW50cnkpIHtcbiAgICAgICAgcmVzLmNvdW50cnkgPSBjb21wb25lbnRzLmNvdW50cnk7XG4gICAgICAgIGlmIChyZXMuY291bnRyeSA9PT0gJ1VuaXRlZCBTdGF0ZXMgb2YgQW1lcmljYScpIHtcbiAgICAgICAgICByZXMuY291bnRyeSA9ICdVU0EnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0LmZvcm1hdHRlZCkge1xuICAgICAgICByZXMuYWRkcmVzcyA9IHJlc3VsdC5mb3JtYXR0ZWQ7XG4gICAgICAgIGlmICghZ2VvdHlwZXNbcmVzLnR5cGVdKSB7XG4gICAgICAgICAgYWRkciA9IHJlcy5hZGRyZXNzLnNwbGl0KCcsICcpO1xuICAgICAgICAgIGlmIChhZGRyLmxlbmd0aCA+IDEgJiYgYWRkclswXSA9PT0gcmVzLnBsYWNlKSB7XG4gICAgICAgICAgICBhZGRyLnNoaWZ0KCk7XG4gICAgICAgICAgICByZXMuYWRkcmVzcyA9IGFkZHIuam9pbignLCAnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlcy5jb3VudHJ5ID09PSAnVVNBJykge1xuICAgICAgICAgIHJlcy5hZGRyZXNzID0gcmVzLmFkZHJlc3MucmVwbGFjZSgnVW5pdGVkIFN0YXRlcyBvZiBBbWVyaWNhJywgJ1VTQScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCB7XG4gICAgZm9yd2FyZDogdHJ1ZSxcbiAgICByZXZlcnNlOiB0cnVlLFxuICAgIHVybDogZ2V0VXJsLmJpbmQodW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zLm9wZW5jYWdlX3VybCB8fCAnaHR0cHM6Ly9hcGkub3BlbmNhZ2VkYXRhLmNvbS9nZW9jb2RlL3YxL2pzb24nLFxuICAgICAgICBvcHRpb25zLm9wZW5jYWdlX2tleSksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3Q6IHByZXBhcmVSZXF1ZXN0LFxuICAgIHByb2Nlc3NSZXNwb25zZTogcHJvY2Vzc1Jlc3BvbnNlXG4gIH0pO1xuICBpZiAob3B0aW9ucy5vcGVuY2FnZV9wYXJhbWV0ZXJzKSB7XG4gICAgb3B0aW9ucyA9IHV0aWwuZGVmYXVsdHMob3B0aW9ucywgb3B0aW9ucy5vcGVuY2FnZV9wYXJhbWV0ZXJzKTtcbiAgfVxuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gam9pbihsbCkge1xuICByZXR1cm4gbGwuam9pbignLCcpO1xufVxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgIFwiQWxhYmFtYVwiOiBcIkFMXCIsXG4gICAgXCJBbGFza2FcIjogXCJBS1wiLFxuICAgIFwiQXJpem9uYVwiOiBcIkFaXCIsXG4gICAgXCJBcmthbnNhc1wiOiBcIkFSXCIsXG4gICAgXCJDYWxpZm9ybmlhXCI6IFwiQ0FcIixcbiAgICBcIkNvbG9yYWRvXCI6IFwiQ09cIixcbiAgICBcIkNvbm5lY3RpY3V0XCI6IFwiQ1RcIixcbiAgICBcIkRlbGF3YXJlXCI6IFwiREVcIixcbiAgICBcIkRpc3RyaWN0IG9mIENvbHVtYmlhXCI6IFwiRENcIixcbiAgICBcIkZsb3JpZGFcIjogXCJGTFwiLFxuICAgIFwiR2VvcmdpYVwiOiBcIkdBXCIsXG4gICAgXCJIYXdhaWlcIjogXCJISVwiLFxuICAgIFwiSWRhaG9cIjogXCJJRFwiLFxuICAgIFwiSWxsaW5vaXNcIjogXCJJTFwiLFxuICAgIFwiSW5kaWFuYVwiOiBcIklOXCIsXG4gICAgXCJJb3dhXCI6IFwiSUFcIixcbiAgICBcIkthbnNhc1wiOiBcIktTXCIsXG4gICAgXCJLZW50dWNreVwiOiBcIktZXCIsXG4gICAgXCJMb3Vpc2lhbmFcIjogXCJMQVwiLFxuICAgIFwiTWFpbmVcIjogXCJNRVwiLFxuICAgIFwiTW9udGFuYVwiOiBcIk1UXCIsXG4gICAgXCJOZWJyYXNrYVwiOiBcIk5FXCIsXG4gICAgXCJOZXZhZGFcIjogXCJOVlwiLFxuICAgIFwiTmV3IEhhbXBzaGlyZVwiOiBcIk5IXCIsXG4gICAgXCJOZXcgSmVyc2V5XCI6IFwiTkpcIixcbiAgICBcIk5ldyBNZXhpY29cIjogXCJOTVwiLFxuICAgIFwiTmV3IFlvcmtcIjogXCJOWVwiLFxuICAgIFwiTm9ydGggQ2Fyb2xpbmFcIjogXCJOQ1wiLFxuICAgIFwiTm9ydGggRGFrb3RhXCI6IFwiTkRcIixcbiAgICBcIk9oaW9cIjogXCJPSFwiLFxuICAgIFwiT2tsYWhvbWFcIjogXCJPS1wiLFxuICAgIFwiT3JlZ29uXCI6IFwiT1JcIixcbiAgICBcIk1hcnlsYW5kXCI6IFwiTURcIixcbiAgICBcIk1hc3NhY2h1c2V0dHNcIjogXCJNQVwiLFxuICAgIFwiTWljaGlnYW5cIjogXCJNSVwiLFxuICAgIFwiTWlubmVzb3RhXCI6IFwiTU5cIixcbiAgICBcIk1pc3Npc3NpcHBpXCI6IFwiTVNcIixcbiAgICBcIk1pc3NvdXJpXCI6IFwiTU9cIixcbiAgICBcIlBlbm5zeWx2YW5pYVwiOiBcIlBBXCIsXG4gICAgXCJSaG9kZSBJc2xhbmRcIjogXCJSSVwiLFxuICAgIFwiU291dGggQ2Fyb2xpbmFcIjogXCJTQ1wiLFxuICAgIFwiU291dGggRGFrb3RhXCI6IFwiU0RcIixcbiAgICBcIlRlbm5lc3NlZVwiOiBcIlROXCIsXG4gICAgXCJUZXhhc1wiOiBcIlRYXCIsXG4gICAgXCJVdGFoXCI6IFwiVVRcIixcbiAgICBcIlZlcm1vbnRcIjogXCJWVFwiLFxuICAgIFwiVmlyZ2luaWFcIjogXCJWQVwiLFxuICAgIFwiV2FzaGluZ3RvblwiOiBcIldBXCIsXG4gICAgXCJXZXN0IFZpcmdpbmlhXCI6IFwiV1ZcIixcbiAgICBcIldpc2NvbnNpblwiOiBcIldJXCIsXG4gICAgXCJXeW9taW5nXCI6IFwiV1lcIixcblxuICAgIFwiQWxiZXJ0YVwiOiBcIkFCXCIsXG4gICAgXCJCcml0aXNoIENvbHVtYmlhXCI6IFwiQkNcIixcbiAgICBcIk1hbml0b2JhXCI6IFwiTUJcIixcbiAgICBcIk5ldyBCcnVuc3dpY2tcIjogXCJOQlwiLFxuICAgIFwiTmV3Zm91bmRsYW5kIGFuZCBMYWJyYWRvclwiOiBcIk5MXCIsXG4gICAgXCJOb3J0aHdlc3QgVGVycml0b3JpZXNcIjogXCJOVFwiLFxuICAgIFwiTm92YSBTY290aWFcIjogXCJOU1wiLFxuICAgIFwiTnVuYXZ1dFwiOiBcIk5VXCIsXG4gICAgXCJPbnRhcmlvXCI6IFwiT05cIixcbiAgICBcIlByaW5jZSBFZHdhcmQgSXNsYW5kXCI6IFwiUEVcIixcbiAgICBcIlF1ZWJlY1wiOiBcIlFDXCIsXG4gICAgXCJTYXNrYXRjaGV3YW5cIjogXCJTS1wiLFxuICAgIFwiWXVrb25cIjogXCJZVFwiXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgc3VjY2VzczogJ3N1Y2Nlc3MnLCAvLyBzdWNjZXNzXG4gIGZhaWx1cmU6ICdmYWlsdXJlJywgLy8gdWx0aW1hdGUgZmFpbHVyZVxuICBlcnJvcjogJ2Vycm9yJywgLy8gdGVtcG9yYXJ5IGVycm9yXG4gIGVtcHR5OiAnZW1wdHknIC8vIG5vIHJlc3VsdFxufTtcbiIsIi8qXG4gKiBodHRwczovL2Nsb3VkLm1hcHRpbGVyLmNvbS9nZW9jb2RpbmcvXG4gKi9cbnZhciBzdGF0ZXMgPSByZXF1aXJlKCcuLi9zdGF0ZXMnKTtcbnZhciBzdGF0dXMgPSByZXF1aXJlKCcuLi9zdGF0dXMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5cbi8vIHJlc3BvbnNlIGNvZGVzOiBodHRwczovL2dlb2NvZGVyLm9wZW5jYWdlZGF0YS5jb20vYXBpI2NvZGVzXG5mdW5jdGlvbiBnZXRTdGF0dXMoZXJyLCByZXNwb25zZSkge1xuICBpZiAoIXJlc3BvbnNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChlcnIpIHtcbiAgICByZXR1cm4gZXJyLnN0YXR1cyA/IHN0YXR1cy5lcnJvciA6IHN0YXR1cy5mYWlsdXJlO1xuICB9XG4gIGlmICghKHJlc3BvbnNlLnJlc3VsdHMgJiYgcmVzcG9uc2UucmVzdWx0cy5sZW5ndGgpKSB7XG4gICAgcmV0dXJuIHN0YXR1cy5lbXB0eTtcbiAgfVxuICByZXR1cm4gc3RhdHVzLnN1Y2Nlc3M7XG59XG5cbmZ1bmN0aW9uIGdldFVybCh1cmwsIGtleSwgb3AsIHF1ZXJ5KSB7XG4gIHZhciBxO1xuICBpZiAob3AgPT09ICdmb3J3YXJkJykge1xuICAgIHEgPSAncS8nICsgZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5LmFkZHJlc3MgfHwgcXVlcnkucGxhY2UpO1xuICB9XG4gIGVsc2Uge1xuICAgIHEgPSAnci8nICsgcXVlcnkubGwuam9pbignLycpO1xuICB9XG4gIHJldHVybiB1cmwgKyBxICsgJy5qcz9rZXk9JyArIGtleTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVJlcXVlc3QoKSB7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcblxuICBmdW5jdGlvbiBwcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQpIHtcbiAgICBpZiAoIShyZXNwb25zZSAmJiByZXNwb25zZS5yZXN1bHRzICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXN1bHQucGxhY2VzID0gcmVzcG9uc2UucmVzdWx0cy5tYXAoZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgdmFyIHJlcyA9IHtcbiAgICAgICAgICBsbDogWyByZXN1bHQubG9uLCByZXN1bHQubGF0IF1cbiAgICAgIH0sIGFkZHI7XG4gICAgICBpZiAocmVzdWx0LnR5cGUpIHtcbiAgICAgICAgcmVzLnR5cGUgPSByZXN1bHQudHlwZTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQubmFtZSkge1xuICAgICAgICByZXMucGxhY2UgPSByZXN1bHQubmFtZTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuaG91c2VudW1iZXJzKSB7XG4gICAgICAgIHJlcy5ob3VzZSA9IHJlc3VsdC5ob3VzZW51bWJlcnMuc3BsaXQoJywgJykuc2hpZnQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuc3RyZWV0KSB7XG4gICAgICAgIHJlcy5zdHJlZXQgPSByZXN1bHQuc3RyZWV0O1xuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdC5jaXR5KSB7XG4gICAgICAgIHJlcy50b3duID0gcmVzdWx0LmNpdHk7XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0LmNvdW50eSkge1xuICAgICAgICByZXMuY291bnR5ID0gcmVzdWx0LmNvdW50eTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuc3RhdGUpIHtcbiAgICAgICAgcmVzLnByb3ZpbmNlID0gc3RhdGVzW3Jlc3VsdC5zdGF0ZV0gfHwgcmVzdWx0LnN0YXRlO1xuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdC5jb3VudHJ5KSB7XG4gICAgICAgIHJlcy5jb3VudHJ5ID0gcmVzdWx0LmNvdW50cnk7XG4gICAgICAgIGlmIChyZXMuY291bnRyeSA9PT0gJ1VuaXRlZCBTdGF0ZXMgb2YgQW1lcmljYScpIHtcbiAgICAgICAgICByZXMuY291bnRyeSA9ICdVU0EnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocmVzdWx0LmRpc3BsYXlfbmFtZSkge1xuICAgICAgICByZXMuYWRkcmVzcyA9IHJlc3VsdC5kaXNwbGF5X25hbWU7XG4gICAgICAgIGlmIChyZXMuc3RyZWV0ICE9PSByZXMucGxhY2UpIHtcbiAgICAgICAgICBhZGRyID0gcmVzLmFkZHJlc3Muc3BsaXQoJywgJyk7XG4gICAgICAgICAgaWYgKGFkZHIubGVuZ3RoID4gMSAmJiBhZGRyWzBdID09PSByZXMucGxhY2UpIHtcbiAgICAgICAgICAgIGFkZHIuc2hpZnQoKTtcbiAgICAgICAgICAgIHJlcy5hZGRyZXNzID0gYWRkci5qb2luKCcsICcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzLmNvdW50cnkgPT09ICdVU0EnKSB7XG4gICAgICAgICAgcmVzLmFkZHJlc3MgPSByZXMuYWRkcmVzcy5yZXBsYWNlKCdVbml0ZWQgU3RhdGVzIG9mIEFtZXJpY2EnLCAnVVNBJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlcy5jb3VudHJ5ID09PSAnVVNBJyB8fCByZXMuY291dHJ5ID09PSAnQ2FuYWRhJykge1xuICAgICAgICAgIHJlcy5hZGRyZXNzID0gcmVzLmFkZHJlc3MucmVwbGFjZShyZXN1bHQuc3RhdGUsIHJlcy5wcm92aW5jZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXM7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBmb3J3YXJkOiB0cnVlLFxuICAgIHJldmVyc2U6IHRydWUsXG4gICAgdXJsOiBnZXRVcmwuYmluZCh1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnMudGlsZWhvc3RpbmdfdXJsIHx8ICdodHRwczovL2dlb2NvZGVyLnRpbGVob3N0aW5nLmNvbS8nLFxuICAgICAgICBvcHRpb25zLnRpbGVob3N0aW5nX2tleSksXG4gICAgc3RhdHVzOiBnZXRTdGF0dXMsXG4gICAgcHJlcGFyZVJlcXVlc3Q6IHByZXBhcmVSZXF1ZXN0LFxuICAgIHByb2Nlc3NSZXNwb25zZTogcHJvY2Vzc1Jlc3BvbnNlXG4gIH0pO1xuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBkZWZhdWx0czogZGVmYXVsdHNcbn07XG5cbmZ1bmN0aW9uIGRlZmF1bHRzKG9iaiwgc291cmNlKSB7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBzb3VyY2UsIG9iaik7XG59XG4iLCJ2YXIgd2F0ZXJmYWxsID0gcmVxdWlyZSgncnVuLXdhdGVyZmFsbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN0cmF0ZWd5O1xuXG52YXIgRU5EID0gJ2VuZCBwcm9jZXNzaW5nJztcblxuLyoqXG4gKiBQcm9jZXNzIHRoZSBsaXN0IG9mIHRhc2tzIG9uZSBieSBvbmUsZW5kaW5nIHByb2Nlc3NpbmcgYXMgc29vbiBhcyBvbmUgdGFzayBzYXlzIHNvLlxuICogVGhlIG5leHQgdGFzayBpcyBpbnZva2VkIHdpdGggcGFyYW1ldGVycyBzZXQgYnkgdGhlIHByZXZpb3VzIHRhc2suXG4gKiBJdCBpcyBhIGNyb3NzIGJldHdlZW4gYXN5bmMgb3BlcmF0aW9uczogd2F0ZXJmYWxsIGFuZCBzb21lXG4gKiBAcGFyYW0gdGFza3MgbGlzdCBvZiB0YXNrc1xuICogQHBhcmFtIC4uLiBhbnkgbnVtYmVyIG9mIHBhcmFtZXRlcnMgdG8gYmUgcGFzc2VkIHRvIHRoZSBmaXJzdCB0YXNrXG4gKiBAcGFyYW0gY2FsbGJhY2sgdGhlIGxhc3QgYXJndW1lbnQgaXMgYW4gb3B0aW9uYWwgY2FsbGJhY2sgY2FsbGVkIGFmdGVyIHRhc2tzIGhhdmUgYmVlbiBwcm9jZXNzZWQ7XG4gKiAgIGNhbGxlZCB3aXRoIGVycm9yIGZvbGxvd2VkIGJ5IHRoZSBwYXJhbWV0ZXJzIHBhc3NlZCBmcm9tIHRoZSBsYXN0IGludm9rZWQgdGFza1xuICovXG5mdW5jdGlvbiBzdHJhdGVneSh0YXNrcykge1xuICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdLFxuICAgIHBhcmFtZXRlcnMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDAsIC0xKTtcbiAgcGFyYW1ldGVyc1swXSA9IHVuZGVmaW5lZDtcblxuICB0YXNrcyA9IHRhc2tzLnJlZHVjZShmdW5jdGlvbiAocmVzdWx0LCB0YXNrKSB7XG4gICAgcmVzdWx0LnB1c2goZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXTtcbiAgICAgICAgcGFyYW1ldGVycyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCwgLTEpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKGZ1bmN0aW9uIChlcnIsIHRydWVWYWx1ZSkge1xuICAgICAgICB2YXIgcGFyYW1ldGVycyA9IFtlcnJdLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbiAgICAgICAgaWYgKCFlcnIgJiYgdHJ1ZVZhbHVlKSB7XG4gICAgICAgICAgLy8ganVtcCBvdXQgb2YgcHJvY2Vzc2luZ1xuICAgICAgICAgIHBhcmFtZXRlcnNbMF0gPSBFTkQ7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2suYXBwbHkodW5kZWZpbmVkLCBwYXJhbWV0ZXJzKTtcbiAgICAgIH0pO1xuICAgICAgdGFzay5hcHBseSh1bmRlZmluZWQsIHBhcmFtZXRlcnMpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sIFtcbiAgICBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIGZuLmFwcGx5KHVuZGVmaW5lZCwgcGFyYW1ldGVycyk7XG4gICAgfVxuICBdKTtcbiAgd2F0ZXJmYWxsKHRhc2tzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgdmFyIHBhcmFtZXRlcnMgPSBbZXJyXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgaWYgKGVyciA9PT0gRU5EKSB7XG4gICAgICBwYXJhbWV0ZXJzWzBdID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjYWxsYmFjay5hcHBseSh1bmRlZmluZWQsIHBhcmFtZXRlcnMpO1xuICB9KTtcbn1cbiIsIi8qKlxuICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2RlYnVnJyk7XG5leHBvcnRzLmxvZyA9IGxvZztcbmV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5leHBvcnRzLnNhdmUgPSBzYXZlO1xuZXhwb3J0cy5sb2FkID0gbG9hZDtcbmV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuZXhwb3J0cy5zdG9yYWdlID0gJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZVxuICAgICAgICAgICAgICAgJiYgJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZS5zdG9yYWdlXG4gICAgICAgICAgICAgICAgICA/IGNocm9tZS5zdG9yYWdlLmxvY2FsXG4gICAgICAgICAgICAgICAgICA6IGxvY2Fsc3RvcmFnZSgpO1xuXG4vKipcbiAqIENvbG9ycy5cbiAqL1xuXG5leHBvcnRzLmNvbG9ycyA9IFtcbiAgJyMwMDAwQ0MnLCAnIzAwMDBGRicsICcjMDAzM0NDJywgJyMwMDMzRkYnLCAnIzAwNjZDQycsICcjMDA2NkZGJywgJyMwMDk5Q0MnLFxuICAnIzAwOTlGRicsICcjMDBDQzAwJywgJyMwMENDMzMnLCAnIzAwQ0M2NicsICcjMDBDQzk5JywgJyMwMENDQ0MnLCAnIzAwQ0NGRicsXG4gICcjMzMwMENDJywgJyMzMzAwRkYnLCAnIzMzMzNDQycsICcjMzMzM0ZGJywgJyMzMzY2Q0MnLCAnIzMzNjZGRicsICcjMzM5OUNDJyxcbiAgJyMzMzk5RkYnLCAnIzMzQ0MwMCcsICcjMzNDQzMzJywgJyMzM0NDNjYnLCAnIzMzQ0M5OScsICcjMzNDQ0NDJywgJyMzM0NDRkYnLFxuICAnIzY2MDBDQycsICcjNjYwMEZGJywgJyM2NjMzQ0MnLCAnIzY2MzNGRicsICcjNjZDQzAwJywgJyM2NkNDMzMnLCAnIzk5MDBDQycsXG4gICcjOTkwMEZGJywgJyM5OTMzQ0MnLCAnIzk5MzNGRicsICcjOTlDQzAwJywgJyM5OUNDMzMnLCAnI0NDMDAwMCcsICcjQ0MwMDMzJyxcbiAgJyNDQzAwNjYnLCAnI0NDMDA5OScsICcjQ0MwMENDJywgJyNDQzAwRkYnLCAnI0NDMzMwMCcsICcjQ0MzMzMzJywgJyNDQzMzNjYnLFxuICAnI0NDMzM5OScsICcjQ0MzM0NDJywgJyNDQzMzRkYnLCAnI0NDNjYwMCcsICcjQ0M2NjMzJywgJyNDQzk5MDAnLCAnI0NDOTkzMycsXG4gICcjQ0NDQzAwJywgJyNDQ0NDMzMnLCAnI0ZGMDAwMCcsICcjRkYwMDMzJywgJyNGRjAwNjYnLCAnI0ZGMDA5OScsICcjRkYwMENDJyxcbiAgJyNGRjAwRkYnLCAnI0ZGMzMwMCcsICcjRkYzMzMzJywgJyNGRjMzNjYnLCAnI0ZGMzM5OScsICcjRkYzM0NDJywgJyNGRjMzRkYnLFxuICAnI0ZGNjYwMCcsICcjRkY2NjMzJywgJyNGRjk5MDAnLCAnI0ZGOTkzMycsICcjRkZDQzAwJywgJyNGRkNDMzMnXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gTkI6IEluIGFuIEVsZWN0cm9uIHByZWxvYWQgc2NyaXB0LCBkb2N1bWVudCB3aWxsIGJlIGRlZmluZWQgYnV0IG5vdCBmdWxseVxuICAvLyBpbml0aWFsaXplZC4gU2luY2Ugd2Uga25vdyB3ZSdyZSBpbiBDaHJvbWUsIHdlJ2xsIGp1c3QgZGV0ZWN0IHRoaXMgY2FzZVxuICAvLyBleHBsaWNpdGx5XG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucHJvY2VzcyAmJiB3aW5kb3cucHJvY2Vzcy50eXBlID09PSAncmVuZGVyZXInKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBJbnRlcm5ldCBFeHBsb3JlciBhbmQgRWRnZSBkbyBub3Qgc3VwcG9ydCBjb2xvcnMuXG4gIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvKGVkZ2V8dHJpZGVudClcXC8oXFxkKykvKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG4gIC8vIGRvY3VtZW50IGlzIHVuZGVmaW5lZCBpbiByZWFjdC1uYXRpdmU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC1uYXRpdmUvcHVsbC8xNjMyXG4gIHJldHVybiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5XZWJraXRBcHBlYXJhbmNlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmNvbnNvbGUgJiYgKHdpbmRvdy5jb25zb2xlLmZpcmVidWcgfHwgKHdpbmRvdy5jb25zb2xlLmV4Y2VwdGlvbiAmJiB3aW5kb3cuY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKSB8fFxuICAgIC8vIGRvdWJsZSBjaGVjayB3ZWJraXQgaW4gdXNlckFnZW50IGp1c3QgaW4gY2FzZSB3ZSBhcmUgaW4gYSB3b3JrZXJcbiAgICAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2FwcGxld2Via2l0XFwvKFxcZCspLykpO1xufVxuXG4vKipcbiAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMuaiA9IGZ1bmN0aW9uKHYpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiAnW1VuZXhwZWN0ZWRKU09OUGFyc2VFcnJvcl06ICcgKyBlcnIubWVzc2FnZTtcbiAgfVxufTtcblxuXG4vKipcbiAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGZvcm1hdEFyZ3MoYXJncykge1xuICB2YXIgdXNlQ29sb3JzID0gdGhpcy51c2VDb2xvcnM7XG5cbiAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpXG4gICAgKyB0aGlzLm5hbWVzcGFjZVxuICAgICsgKHVzZUNvbG9ycyA/ICcgJWMnIDogJyAnKVxuICAgICsgYXJnc1swXVxuICAgICsgKHVzZUNvbG9ycyA/ICclYyAnIDogJyAnKVxuICAgICsgJysnICsgZXhwb3J0cy5odW1hbml6ZSh0aGlzLmRpZmYpO1xuXG4gIGlmICghdXNlQ29sb3JzKSByZXR1cm47XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzLnNwbGljZSgxLCAwLCBjLCAnY29sb3I6IGluaGVyaXQnKVxuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXpBLVolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5yZW1vdmVJdGVtKCdkZWJ1ZycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBleHBvcnRzLnN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cblxuICAvLyBJZiBkZWJ1ZyBpc24ndCBzZXQgaW4gTFMsIGFuZCB3ZSdyZSBpbiBFbGVjdHJvbiwgdHJ5IHRvIGxvYWQgJERFQlVHXG4gIGlmICghciAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgJ2VudicgaW4gcHJvY2Vzcykge1xuICAgIHIgPSBwcm9jZXNzLmVudi5ERUJVRztcbiAgfVxuXG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG4gIH0gY2F0Y2ggKGUpIHt9XG59XG4iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgY29tbW9uIGxvZ2ljIGZvciBib3RoIHRoZSBOb2RlLmpzIGFuZCB3ZWIgYnJvd3NlclxuICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gY3JlYXRlRGVidWcuZGVidWcgPSBjcmVhdGVEZWJ1Z1snZGVmYXVsdCddID0gY3JlYXRlRGVidWc7XG5leHBvcnRzLmNvZXJjZSA9IGNvZXJjZTtcbmV4cG9ydHMuZGlzYWJsZSA9IGRpc2FibGU7XG5leHBvcnRzLmVuYWJsZSA9IGVuYWJsZTtcbmV4cG9ydHMuZW5hYmxlZCA9IGVuYWJsZWQ7XG5leHBvcnRzLmh1bWFuaXplID0gcmVxdWlyZSgnbXMnKTtcblxuLyoqXG4gKiBBY3RpdmUgYGRlYnVnYCBpbnN0YW5jZXMuXG4gKi9cbmV4cG9ydHMuaW5zdGFuY2VzID0gW107XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlciBvciB1cHBlci1jYXNlIGxldHRlciwgaS5lLiBcIm5cIiBhbmQgXCJOXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogU2VsZWN0IGEgY29sb3IuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcihuYW1lc3BhY2UpIHtcbiAgdmFyIGhhc2ggPSAwLCBpO1xuXG4gIGZvciAoaSBpbiBuYW1lc3BhY2UpIHtcbiAgICBoYXNoICA9ICgoaGFzaCA8PCA1KSAtIGhhc2gpICsgbmFtZXNwYWNlLmNoYXJDb2RlQXQoaSk7XG4gICAgaGFzaCB8PSAwOyAvLyBDb252ZXJ0IHRvIDMyYml0IGludGVnZXJcbiAgfVxuXG4gIHJldHVybiBleHBvcnRzLmNvbG9yc1tNYXRoLmFicyhoYXNoKSAlIGV4cG9ydHMuY29sb3JzLmxlbmd0aF07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgZGVidWdnZXIgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVzcGFjZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGNyZWF0ZURlYnVnKG5hbWVzcGFjZSkge1xuXG4gIHZhciBwcmV2VGltZTtcblxuICBmdW5jdGlvbiBkZWJ1ZygpIHtcbiAgICAvLyBkaXNhYmxlZD9cbiAgICBpZiAoIWRlYnVnLmVuYWJsZWQpIHJldHVybjtcblxuICAgIHZhciBzZWxmID0gZGVidWc7XG5cbiAgICAvLyBzZXQgYGRpZmZgIHRpbWVzdGFtcFxuICAgIHZhciBjdXJyID0gK25ldyBEYXRlKCk7XG4gICAgdmFyIG1zID0gY3VyciAtIChwcmV2VGltZSB8fCBjdXJyKTtcbiAgICBzZWxmLmRpZmYgPSBtcztcbiAgICBzZWxmLnByZXYgPSBwcmV2VGltZTtcbiAgICBzZWxmLmN1cnIgPSBjdXJyO1xuICAgIHByZXZUaW1lID0gY3VycjtcblxuICAgIC8vIHR1cm4gdGhlIGBhcmd1bWVudHNgIGludG8gYSBwcm9wZXIgQXJyYXlcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJU9cbiAgICAgIGFyZ3MudW5zaGlmdCgnJU8nKTtcbiAgICB9XG5cbiAgICAvLyBhcHBseSBhbnkgYGZvcm1hdHRlcnNgIHRyYW5zZm9ybWF0aW9uc1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgYXJnc1swXSA9IGFyZ3NbMF0ucmVwbGFjZSgvJShbYS16QS1aJV0pL2csIGZ1bmN0aW9uKG1hdGNoLCBmb3JtYXQpIHtcbiAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcbiAgICAgIGlmIChtYXRjaCA9PT0gJyUlJykgcmV0dXJuIG1hdGNoO1xuICAgICAgaW5kZXgrKztcbiAgICAgIHZhciBmb3JtYXR0ZXIgPSBleHBvcnRzLmZvcm1hdHRlcnNbZm9ybWF0XTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9ybWF0dGVyKSB7XG4gICAgICAgIHZhciB2YWwgPSBhcmdzW2luZGV4XTtcbiAgICAgICAgbWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG4gICAgICAgIC8vIG5vdyB3ZSBuZWVkIHRvIHJlbW92ZSBgYXJnc1tpbmRleF1gIHNpbmNlIGl0J3MgaW5saW5lZCBpbiB0aGUgYGZvcm1hdGBcbiAgICAgICAgYXJncy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICBpbmRleC0tO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuXG4gICAgLy8gYXBwbHkgZW52LXNwZWNpZmljIGZvcm1hdHRpbmcgKGNvbG9ycywgZXRjLilcbiAgICBleHBvcnRzLmZvcm1hdEFyZ3MuY2FsbChzZWxmLCBhcmdzKTtcblxuICAgIHZhciBsb2dGbiA9IGRlYnVnLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG5cbiAgZGVidWcubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuICBkZWJ1Zy5lbmFibGVkID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSk7XG4gIGRlYnVnLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gIGRlYnVnLmNvbG9yID0gc2VsZWN0Q29sb3IobmFtZXNwYWNlKTtcbiAgZGVidWcuZGVzdHJveSA9IGRlc3Ryb3k7XG5cbiAgLy8gZW52LXNwZWNpZmljIGluaXRpYWxpemF0aW9uIGxvZ2ljIGZvciBkZWJ1ZyBpbnN0YW5jZXNcbiAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRzLmluaXQpIHtcbiAgICBleHBvcnRzLmluaXQoZGVidWcpO1xuICB9XG5cbiAgZXhwb3J0cy5pbnN0YW5jZXMucHVzaChkZWJ1Zyk7XG5cbiAgcmV0dXJuIGRlYnVnO1xufVxuXG5mdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgdmFyIGluZGV4ID0gZXhwb3J0cy5pbnN0YW5jZXMuaW5kZXhPZih0aGlzKTtcbiAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgIGV4cG9ydHMuaW5zdGFuY2VzLnNwbGljZShpbmRleCwgMSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgZXhwb3J0cy5uYW1lcyA9IFtdO1xuICBleHBvcnRzLnNraXBzID0gW107XG5cbiAgdmFyIGk7XG4gIHZhciBzcGxpdCA9ICh0eXBlb2YgbmFtZXNwYWNlcyA9PT0gJ3N0cmluZycgPyBuYW1lc3BhY2VzIDogJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoaSA9IDA7IGkgPCBleHBvcnRzLmluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpbnN0YW5jZSA9IGV4cG9ydHMuaW5zdGFuY2VzW2ldO1xuICAgIGluc3RhbmNlLmVuYWJsZWQgPSBleHBvcnRzLmVuYWJsZWQoaW5zdGFuY2UubmFtZXNwYWNlKTtcbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIGlmIChuYW1lW25hbWUubGVuZ3RoIC0gMV0gPT09ICcqJykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2ZldGNoYWdlbnQnKTtcbiIsIi8qIGdsb2JhbCBIZWFkZXJzICovXG5cbm1vZHVsZS5leHBvcnRzID0gZmV0Y2hhZ2VudDtcblxuWydnZXQnLCAncHV0JywgJ3Bvc3QnLCAnZGVsZXRlJ10uZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgZmV0Y2hhZ2VudFttZXRob2RdID0gZnVuY3Rpb24odXJsKSB7XG4gICAgcmV0dXJuIGZldGNoYWdlbnQobWV0aG9kLnRvVXBwZXJDYXNlKCksIHVybCk7XG4gIH07XG59KTtcblxuZmV0Y2hhZ2VudC5kZWwgPSBmZXRjaGFnZW50LmRlbGV0ZTtcblxuZnVuY3Rpb24gc2V0QWxsKGRlc3RpbmF0aW9uLCBzb3VyY2UpIHtcbiAgT2JqZWN0LmtleXMoc291cmNlKS5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICBkZXN0aW5hdGlvbi5zZXQocCwgc291cmNlW3BdKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFVybChwcmVmaXgsIHF1ZXJ5KSB7XG4gIGZ1bmN0aW9uIGVuY29kZSh2KSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkodilcbiAgICAgID8gdi5tYXAoZW5jb2RlVVJJQ29tcG9uZW50KS5qb2luKCcsJylcbiAgICAgIDogZW5jb2RlVVJJQ29tcG9uZW50KHYpO1xuICB9XG5cbiAgaWYgKCFxdWVyeSkge1xuICAgIHJldHVybiBwcmVmaXg7XG4gIH1cbiAgdmFyIHFzID0gT2JqZWN0XG4gICAgLmtleXMocXVlcnkpXG4gICAgLm1hcChmdW5jdGlvbihuYW1lKSB7IHJldHVybiBuYW1lICsgJz0nICsgZW5jb2RlKHF1ZXJ5W25hbWVdKTsgfSlcbiAgICAuam9pbignJicpO1xuICBpZiAoIXFzKSB7XG4gICAgcmV0dXJuIHByZWZpeDtcbiAgfVxuICByZXR1cm4gcHJlZml4ICsgJz8nICsgcXM7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRDb250ZW50UGFyc2VyKGNvbnRlbnRUeXBlKSB7XG4gIHJldHVybiBjb250ZW50VHlwZSAmJiBjb250ZW50VHlwZS5pbmRleE9mKCdqc29uJykgIT09IC0xXG4gICAgPyAnanNvbidcbiAgICA6ICd0ZXh0Jztcbn1cblxuZnVuY3Rpb24gZmV0Y2hhZ2VudChtZXRob2QsIHVybCkge1xuICB2YXIgcmVxID0ge1xuICAgIHVybDogdXJsLFxuICAgIHF1ZXJ5OiB1bmRlZmluZWRcbiAgfTtcbiAgdmFyIGluaXQgPSB7XG4gICAgbWV0aG9kOiBtZXRob2QsXG4gICAgcmVkaXJlY3Q6ICdtYW51YWwnLFxuICAgIGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nXG4gIH07XG4gIHZhciBzZWxmID0ge1xuICAgIGVuZDogZW5kLFxuICAgIGpzb246IGpzb24sXG4gICAgcGFyc2VyOiBwYXJzZXIsXG4gICAgcXVlcnk6IHF1ZXJ5LFxuICAgIHJlZGlyZWN0OiByZWRpcmVjdCxcbiAgICBzZW5kOiBzZW5kLFxuICAgIHNldDogc2V0LFxuICAgIHRleHQ6IHRleHRcbiAgfTtcbiAgdmFyIGVycm9yO1xuICB2YXIgY29udGVudFBhcnNlciA9IGRlZmF1bHRDb250ZW50UGFyc2VyO1xuXG4gIGZ1bmN0aW9uIGVuZChmbikge1xuICAgIHZhciBmZXRjaGVkID0gZmV0Y2goZm9ybWF0VXJsKHJlcS51cmwsIHJlcS5xdWVyeSksIGluaXQpO1xuXG4gICAgaWYgKCFmbikge1xuICAgICAgcmV0dXJuIGZldGNoZWQ7XG4gICAgfVxuXG4gICAgZmV0Y2hlZFxuICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgIGlmICghcmVzLm9rKSB7XG4gICAgICAgICAgZXJyb3IgPSB7XG4gICAgICAgICAgICBzdGF0dXM6IHJlcy5zdGF0dXMsXG4gICAgICAgICAgICByZXNwb25zZTogcmVzXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcGFyc2VyID0gY29udGVudFBhcnNlcihyZXMuaGVhZGVycy5nZXQoJ0NvbnRlbnQtVHlwZScpKTtcbiAgICAgICAgaWYgKHBhcnNlcikge1xuICAgICAgICAgIHJldHVybiByZXNbcGFyc2VyXSgpO1xuICAgICAgICB9IGVsc2UgaWYgKCFlcnJvcikge1xuICAgICAgICAgIGVycm9yID0ge1xuICAgICAgICAgICAgc3RhdHVzOiAndW5rbm93biBDb250ZW50LVR5cGUnLFxuICAgICAgICAgICAgcmVzcG9uc2U6IHJlc1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGhlbihcbiAgICAgICAgZnVuY3Rpb24oYm9keSkgeyByZXR1cm4gZm4oZXJyb3IsIGJvZHkpOyB9LFxuICAgICAgICBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgZXJyb3IgPSBlcnJvciB8fCB7fTtcbiAgICAgICAgICBlcnJvci5lcnJvciA9IGU7XG4gICAgICAgICAgcmV0dXJuIGZuKGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGpzb24oKSB7XG4gICAgcmV0dXJuIGVuZCgpLnRoZW4oZnVuY3Rpb24ocmVzKSB7IHJldHVybiByZXMuanNvbigpOyB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRleHQoKSB7XG4gICAgcmV0dXJuIGVuZCgpLnRoZW4oZnVuY3Rpb24ocmVzKSB7IHJldHVybiByZXMudGV4dCgpOyB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbmQoYm9keSkge1xuICAgIGlmIChib2R5IGluc3RhbmNlb2YgQmxvYiB8fCBib2R5IGluc3RhbmNlb2YgRm9ybURhdGEgfHwgdHlwZW9mIGJvZHkgIT09ICdvYmplY3QnKSB7XG4gICAgICBpbml0LmJvZHkgPSBib2R5O1xuICAgIH0gZWxzZSB7XG4gICAgICBpbml0LmJvZHkgPSBKU09OLnN0cmluZ2lmeShib2R5KTtcbiAgICAgIHNldCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBxdWVyeShxKSB7XG4gICAgcmVxLnF1ZXJ5ID0gcTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldChoZWFkZXIsIHZhbHVlKSB7XG4gICAgaWYgKCFpbml0LmhlYWRlcnMpIHtcbiAgICAgIGluaXQuaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBpbml0LmhlYWRlcnMuc2V0KGhlYWRlciwgdmFsdWUpO1xuICAgIH1cbiAgICBlbHNlICB7XG4gICAgICBzZXRBbGwoaW5pdC5oZWFkZXJzLCBoZWFkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZGlyZWN0KGZvbGxvdykge1xuICAgIGluaXQucmVkaXJlY3QgPSBmb2xsb3cgPyAnZm9sbG93JyA6ICdtYW51YWwnO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcGFyc2VyKGZuKSB7XG4gICAgY29udGVudFBhcnNlciA9IGZuO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgcmV0dXJuIHNlbGY7XG59XG4iLCJcbm1vZHVsZS5leHBvcnRzID0gbGltaXRlcjtcblxuLypnbG9iYWwgc2V0VGltZW91dCwgY2xlYXJUaW1lb3V0ICovXG5cbmZ1bmN0aW9uIGxpbWl0ZXIoaW50ZXJ2YWwsIHBlbmFsdHlJbnRlcnZhbCkge1xuXG4gIHZhciBxdWV1ZSA9IFtdLFxuICAgIGxhc3RUcmlnZ2VyID0gMCxcbiAgICBwZW5hbHR5Q291bnRlciA9IDAsXG4gICAgc2tpcENvdW50ZXIgPSAwLFxuICAgIHRpbWVyO1xuXG4gIGZ1bmN0aW9uIG5vdygpIHtcbiAgICByZXR1cm4gRGF0ZS5ub3coKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNpbmNlKCkge1xuICAgIHJldHVybiBub3coKSAtIGxhc3RUcmlnZ2VyO1xuICB9XG5cbiAgZnVuY3Rpb24gY3VycmVudEludGVydmFsKCkge1xuICAgIHJldHVybiBwZW5hbHR5Q291bnRlciA+IDAgPyBwZW5hbHR5SW50ZXJ2YWwgOiBpbnRlcnZhbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJ1bk5vdyhmbikge1xuICAgIHBlbmFsdHlDb3VudGVyID0gMDtcbiAgICBmbigpO1xuICAgIC8vIHdhaXQgdG8gdGhlIG5leHQgaW50ZXJ2YWwgdW5sZXNzIHRvbGQgdG8gc2tpcFxuICAgIC8vIHRvIHRoZSBuZXh0IG9wZXJhdGlvbiBpbW1lZGlhdGVseVxuICAgIGlmIChza2lwQ291bnRlciA+IDApIHtcbiAgICAgIHNraXBDb3VudGVyID0gMDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBsYXN0VHJpZ2dlciA9IG5vdygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlcXVlKCkge1xuICAgIHRpbWVyID0gdW5kZWZpbmVkO1xuICAgIGlmIChzaW5jZSgpID49IGN1cnJlbnRJbnRlcnZhbCgpKSB7XG4gICAgICBydW5Ob3cocXVldWUuc2hpZnQoKSk7XG4gICAgfVxuICAgIHNjaGVkdWxlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBzY2hlZHVsZSgpIHtcbiAgICB2YXIgZGVsYXk7XG4gICAgaWYgKCF0aW1lciAmJiBxdWV1ZS5sZW5ndGgpIHtcbiAgICAgIGRlbGF5ID0gY3VycmVudEludGVydmFsKCkgLSBzaW5jZSgpO1xuICAgICAgaWYgKGRlbGF5IDwgMCkge1xuICAgICAgICByZXR1cm4gZGVxdWUoKTtcbiAgICAgIH1cbiAgICAgIHRpbWVyID0gc2V0VGltZW91dChkZXF1ZSwgZGVsYXkpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHRyaWdnZXIoZm4pIHtcbiAgICBpZiAoc2luY2UoKSA+PSBjdXJyZW50SW50ZXJ2YWwoKSAmJiAhcXVldWUubGVuZ3RoKSB7XG4gICAgICBydW5Ob3coZm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgIHNjaGVkdWxlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGVuYWx0eSgpIHtcbiAgICBwZW5hbHR5Q291bnRlciArPSAxO1xuICB9XG5cbiAgZnVuY3Rpb24gc2tpcCgpIHtcbiAgICBza2lwQ291bnRlciArPSAxO1xuICB9XG5cbiAgZnVuY3Rpb24gY2FuY2VsKCkge1xuICAgIGlmICh0aW1lcikge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICB9XG4gICAgcXVldWUgPSBbXTtcbiAgfVxuXG4gIHBlbmFsdHlJbnRlcnZhbCA9IHBlbmFsdHlJbnRlcnZhbCB8fCA1ICogaW50ZXJ2YWw7XG4gIHJldHVybiB7XG4gICAgdHJpZ2dlcjogdHJpZ2dlcixcbiAgICBwZW5hbHR5OiBwZW5hbHR5LFxuICAgIHNraXA6IHNraXAsXG4gICAgY2FuY2VsOiBjYW5jZWxcbiAgfTtcbn1cbiIsIi8qKlxuICogSGVscGVycy5cbiAqL1xuXG52YXIgcyA9IDEwMDA7XG52YXIgbSA9IHMgKiA2MDtcbnZhciBoID0gbSAqIDYwO1xudmFyIGQgPSBoICogMjQ7XG52YXIgeSA9IGQgKiAzNjUuMjU7XG5cbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWw7XG4gIGlmICh0eXBlID09PSAnc3RyaW5nJyAmJiB2YWwubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBwYXJzZSh2YWwpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmIGlzTmFOKHZhbCkgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICd2YWwgaXMgbm90IGEgbm9uLWVtcHR5IHN0cmluZyBvciBhIHZhbGlkIG51bWJlci4gdmFsPScgK1xuICAgICAgSlNPTi5zdHJpbmdpZnkodmFsKVxuICApO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHN0ciA9IFN0cmluZyhzdHIpO1xuICBpZiAoc3RyLmxlbmd0aCA+IDEwMCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKFxuICAgIHN0clxuICApO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5cnMnOlxuICAgIGNhc2UgJ3lyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdocnMnOlxuICAgIGNhc2UgJ2hyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ21pbnMnOlxuICAgIGNhc2UgJ21pbic6XG4gICAgY2FzZSAnbSc6XG4gICAgICByZXR1cm4gbiAqIG07XG4gICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgY2FzZSAnc2Vjb25kJzpcbiAgICBjYXNlICdzZWNzJzpcbiAgICBjYXNlICdzZWMnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21pbGxpc2Vjb25kcyc6XG4gICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgIGNhc2UgJ21zZWNzJzpcbiAgICBjYXNlICdtc2VjJzpcbiAgICBjYXNlICdtcyc6XG4gICAgICByZXR1cm4gbjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG4vKipcbiAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGZtdFNob3J0KG1zKSB7XG4gIGlmIChtcyA+PSBkKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgfVxuICBpZiAobXMgPj0gaCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIH1cbiAgaWYgKG1zID49IG0pIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICB9XG4gIGlmIChtcyA+PSBzKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgfVxuICByZXR1cm4gbXMgKyAnbXMnO1xufVxuXG4vKipcbiAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gZm10TG9uZyhtcykge1xuICByZXR1cm4gcGx1cmFsKG1zLCBkLCAnZGF5JykgfHxcbiAgICBwbHVyYWwobXMsIGgsICdob3VyJykgfHxcbiAgICBwbHVyYWwobXMsIG0sICdtaW51dGUnKSB8fFxuICAgIHBsdXJhbChtcywgcywgJ3NlY29uZCcpIHx8XG4gICAgbXMgKyAnIG1zJztcbn1cblxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqL1xuXG5mdW5jdGlvbiBwbHVyYWwobXMsIG4sIG5hbWUpIHtcbiAgaWYgKG1zIDwgbikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAobXMgPCBuICogMS41KSB7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIH1cbiAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcnVuV2F0ZXJmYWxsXG5cbmZ1bmN0aW9uIHJ1bldhdGVyZmFsbCAodGFza3MsIGNiKSB7XG4gIHZhciBjdXJyZW50ID0gMFxuICB2YXIgaXNTeW5jID0gdHJ1ZVxuXG4gIGZ1bmN0aW9uIGRvbmUgKGVyciwgYXJncykge1xuICAgIGZ1bmN0aW9uIGVuZCAoKSB7XG4gICAgICBhcmdzID0gYXJncyA/IFtdLmNvbmNhdChlcnIsIGFyZ3MpIDogWyBlcnIgXVxuICAgICAgaWYgKGNiKSBjYi5hcHBseSh1bmRlZmluZWQsIGFyZ3MpXG4gICAgfVxuICAgIGlmIChpc1N5bmMpIHByb2Nlc3MubmV4dFRpY2soZW5kKVxuICAgIGVsc2UgZW5kKClcbiAgfVxuXG4gIGZ1bmN0aW9uIGVhY2ggKGVycikge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKVxuICAgIGlmICgrK2N1cnJlbnQgPj0gdGFza3MubGVuZ3RoIHx8IGVycikge1xuICAgICAgZG9uZShlcnIsIGFyZ3MpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRhc2tzW2N1cnJlbnRdLmFwcGx5KHVuZGVmaW5lZCwgW10uY29uY2F0KGFyZ3MsIGVhY2gpKVxuICAgIH1cbiAgfVxuXG4gIGlmICh0YXNrcy5sZW5ndGgpIHtcbiAgICB0YXNrc1swXShlYWNoKVxuICB9IGVsc2Uge1xuICAgIGRvbmUobnVsbClcbiAgfVxuXG4gIGlzU3luYyA9IGZhbHNlXG59XG4iLCJ2YXIgQXdlc29tcGxldGUgPSByZXF1aXJlKCdhd2Vzb21wbGV0ZScpO1xudmFyIGZ1cmtvdEdlb2NvZGUgPSByZXF1aXJlKCdmdXJrb3QtZ2VvY29kZScpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnZGVib3VuY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBnZW9wbGV0ZTtcblxudmFyIGRlZmF1bHRHZW9jb2RlciA9IHtcbiAgb3JkZXI6IFsnYWxnb2xpYSddLFxuICBhbGdvbGlhX3BhcmFtZXRlcnM6IHsgaW50ZXJ2YWwgOiAxMDAwIH0sXG4gIGFsZ29saWFfZW5hYmxlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRydWU7IH1cbn07XG5cbnZhciBTdWdnZXN0aW9ucyA9IHtcbiAgJ2FkZHJlc3MnOiB7XG4gICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5hZGRyZXNzIHx8IHRoaXMucGxhY2U7IH1cbiAgfSxcbiAgJ3BsYWNlJzoge1xuICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMucGxhY2UgfHwgdGhpcy5hZGRyZXNzOyB9XG4gIH1cbn07XG5cbnZhciBrZWVwT3BlbiA9IHtcbiAgZXNjOiB0cnVlXG59O1xuXG5mdW5jdGlvbiBkaXNwbGF5QWxsKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2VvcGxldGUoZWwsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMudHlwZSA9IFN1Z2dlc3Rpb25zW29wdGlvbnMudHlwZV0gPyBvcHRpb25zLnR5cGUgOiAnYWRkcmVzcyc7XG4gIG9wdGlvbnMubWluQ2hhcnMgPSBvcHRpb25zLm1pbkNoYXJzIHx8IDQ7XG4gIHZhciBhY09wdGlvbnMgPSB7XG4gICAgbWluQ2hhcnM6IDAsXG4gICAgaXRlbTogb3B0aW9ucy5pdGVtIHx8IEF3ZXNvbXBsZXRlLklURU0sXG4gICAgZmlsdGVyOiBkaXNwbGF5QWxsXG4gIH07XG5cblxuICB2YXIgZ2VvT3B0aW9ucyA9IG9wdGlvbnMuZ2VvY29kZXIgfHwgZGVmYXVsdEdlb2NvZGVyO1xuXG4gIHZhciBsYXN0VmFsdWU7XG4gIHZhciBvdXRzdGFuZGluZ1JlcXVlc3Q7XG4gIHZhciBnZW9jb2RlID0gZnVya290R2VvY29kZShnZW9PcHRpb25zKTtcbiAgdmFyIGFjID0gbmV3IEF3ZXNvbXBsZXRlKGVsLCBhY09wdGlvbnMpO1xuXG4gIGlmIChvcHRpb25zLmtlZXBPcGVuKSB7XG4gICAgYWMuY2xvc2UgPSBmdW5jdGlvbiAoY2xvc2UsIG8pIHtcbiAgICAgIGlmIChvICYmIG8ucmVhc29uICYmIGtlZXBPcGVuW28ucmVhc29uXSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjbG9zZS5hcHBseSh0aGlzLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICB9LmJpbmQoYWMsIGFjLmNsb3NlKTtcbiAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCdibHVyJywgYWMuX2V2ZW50cy5pbnB1dC5ibHVyKTtcbiAgfVxuXG4gIHZhciBvbmlucHV0ID0gZGVib3VuY2UoZnVuY3Rpb24oKSB7XG4gICAgaWYgKGVsLnZhbHVlLmxlbmd0aCA8IG9wdGlvbnMubWluQ2hhcnMpIHtcbiAgICAgIHBvcHVsYXRlKFtdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcXVlcnkoZWwudmFsdWUpO1xuICB9LCAzMDApO1xuXG4gIGZ1bmN0aW9uIG9uY2hhbmdlKGV2ZW50KSB7XG4gICAgdmFyIHZhbHVlID0gZXZlbnQudGV4dC52YWx1ZTtcbiAgICB2YXIgY2hhbmdlRXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2dlb3BsZXRlLWNoYW5nZScsIHsgZGV0YWlsOiB2YWx1ZSB9KTtcbiAgICBlbC5kaXNwYXRjaEV2ZW50KGNoYW5nZUV2ZW50KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZyb21QbGFjZShwbGFjZSkge1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUoU3VnZ2VzdGlvbnNbb3B0aW9ucy50eXBlXSksIHBsYWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHF1ZXJ5KHZhbHVlKSB7XG4gICAgaWYgKGxhc3RWYWx1ZSAmJiBsYXN0VmFsdWUudmFsdWUgPT09IHZhbHVlKSB7XG4gICAgICAvLyBkbyBub3QgcmVxdWVyeSBmb3IgdGhlIHNhbWUgdmFsdWVcbiAgICAgIGlmIChsYXN0VmFsdWUucmVzdWx0KSB7XG4gICAgICAgIHBvcHVsYXRlKGxhc3RWYWx1ZS5yZXN1bHQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAob3V0c3RhbmRpbmdSZXF1ZXN0KSB7XG4gICAgICBvdXRzdGFuZGluZ1JlcXVlc3QuYWJvcnQoKTtcbiAgICB9XG4gICAgdmFyIHBhcmFtcyA9IHtcbiAgICAgIHBhcnRpYWw6IHRydWUsXG4gICAgICBib3VuZHM6IG9wdGlvbnMuYm91bmRzLFxuICAgICAgbGFuZzogb3B0aW9ucy5sYW5nIHx8IGRvY3VtZW50LmxhbmcgfHwgJ2VuJ1xuICAgIH07XG4gICAgcGFyYW1zW29wdGlvbnMudHlwZV0gPSB2YWx1ZTtcbiAgICBsYXN0VmFsdWUgPSB7XG4gICAgICB2YWx1ZTogdmFsdWVcbiAgICB9O1xuICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2dlb3BsZXRlLWluLXByb2dyZXNzJyk7XG4gICAgb3V0c3RhbmRpbmdSZXF1ZXN0ID0gZ2VvY29kZShwYXJhbXMsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZ2VvcGxldGUtaW4tcHJvZ3Jlc3MnKTtcbiAgICAgIGlmICghcmVzdWx0IHx8ICFyZXN1bHQucGxhY2VzKSB7XG4gICAgICAgIC8vIG5vIHJlc3VsdHNcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbGFzdFZhbHVlLnJlc3VsdCA9IHJlc3VsdC5wbGFjZXM7XG4gICAgICBwb3B1bGF0ZShyZXN1bHQucGxhY2VzKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvcHVsYXRlKHBsYWNlcykge1xuICAgIGFjLmxpc3QgPSBwbGFjZXMubWFwKGZyb21QbGFjZSk7XG4gICAgYWMuZXZhbHVhdGUoKTtcbiAgICB2YXIgbGlzdEV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdnZW9wbGV0ZS1saXN0JywgeyBkZXRhaWw6IHBsYWNlcyB9KTtcbiAgICBlbC5kaXNwYXRjaEV2ZW50KGxpc3RFdmVudCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2lucHV0Jywgb25pbnB1dCk7XG4gICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignYXdlc29tcGxldGUtc2VsZWN0Y29tcGxldGUnLCBvbmNoYW5nZSk7XG4gICAgYWMuZGVzdHJveSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0KHByb3BlcnR5LCB2YWx1ZSkge1xuICAgIG9wdGlvbnNbcHJvcGVydHldID0gdmFsdWU7XG4gIH1cblxuICBlbC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIG9uaW5wdXQpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdhd2Vzb21wbGV0ZS1zZWxlY3Rjb21wbGV0ZScsIG9uY2hhbmdlKTtcblxuICByZXR1cm4ge1xuICAgIHBvcHVsYXRlOiBwb3B1bGF0ZSxcbiAgICBzZXQ6IHNldCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG59XG4iLCIvKipcbiAqIFNpbXBsZSwgbGlnaHR3ZWlnaHQsIHVzYWJsZSBsb2NhbCBhdXRvY29tcGxldGUgbGlicmFyeSBmb3IgbW9kZXJuIGJyb3dzZXJzXG4gKiBCZWNhdXNlIHRoZXJlIHdlcmVu4oCZdCBlbm91Z2ggYXV0b2NvbXBsZXRlIHNjcmlwdHMgaW4gdGhlIHdvcmxkPyBCZWNhdXNlIEnigJltIGNvbXBsZXRlbHkgaW5zYW5lIGFuZCBoYXZlIE5JSCBzeW5kcm9tZT8gUHJvYmFibHkgYm90aC4gOlBcbiAqIEBhdXRob3IgTGVhIFZlcm91IGh0dHA6Ly9sZWF2ZXJvdS5naXRodWIuaW8vYXdlc29tcGxldGVcbiAqIE1JVCBsaWNlbnNlXG4gKi9cblxuKGZ1bmN0aW9uICgpIHtcblxudmFyIF8gPSBmdW5jdGlvbiAoaW5wdXQsIG8pIHtcblx0dmFyIG1lID0gdGhpcztcblxuXHQvLyBTZXR1cFxuXG5cdHRoaXMuaXNPcGVuZWQgPSBmYWxzZTtcblxuXHR0aGlzLmlucHV0ID0gJChpbnB1dCk7XG5cdHRoaXMuaW5wdXQuc2V0QXR0cmlidXRlKFwiYXV0b2NvbXBsZXRlXCIsIFwib2ZmXCIpO1xuXHR0aGlzLmlucHV0LnNldEF0dHJpYnV0ZShcImFyaWEtYXV0b2NvbXBsZXRlXCIsIFwibGlzdFwiKTtcblxuXHRvID0gbyB8fCB7fTtcblxuXHRjb25maWd1cmUodGhpcywge1xuXHRcdG1pbkNoYXJzOiAyLFxuXHRcdG1heEl0ZW1zOiAxMCxcblx0XHRhdXRvRmlyc3Q6IGZhbHNlLFxuXHRcdGRhdGE6IF8uREFUQSxcblx0XHRmaWx0ZXI6IF8uRklMVEVSX0NPTlRBSU5TLFxuXHRcdHNvcnQ6IG8uc29ydCA9PT0gZmFsc2UgPyBmYWxzZSA6IF8uU09SVF9CWUxFTkdUSCxcblx0XHRpdGVtOiBfLklURU0sXG5cdFx0cmVwbGFjZTogXy5SRVBMQUNFXG5cdH0sIG8pO1xuXG5cdHRoaXMuaW5kZXggPSAtMTtcblxuXHQvLyBDcmVhdGUgbmVjZXNzYXJ5IGVsZW1lbnRzXG5cblx0dGhpcy5jb250YWluZXIgPSAkLmNyZWF0ZShcImRpdlwiLCB7XG5cdFx0Y2xhc3NOYW1lOiBcImF3ZXNvbXBsZXRlXCIsXG5cdFx0YXJvdW5kOiBpbnB1dFxuXHR9KTtcblxuXHR0aGlzLnVsID0gJC5jcmVhdGUoXCJ1bFwiLCB7XG5cdFx0aGlkZGVuOiBcImhpZGRlblwiLFxuXHRcdGluc2lkZTogdGhpcy5jb250YWluZXJcblx0fSk7XG5cblx0dGhpcy5zdGF0dXMgPSAkLmNyZWF0ZShcInNwYW5cIiwge1xuXHRcdGNsYXNzTmFtZTogXCJ2aXN1YWxseS1oaWRkZW5cIixcblx0XHRyb2xlOiBcInN0YXR1c1wiLFxuXHRcdFwiYXJpYS1saXZlXCI6IFwiYXNzZXJ0aXZlXCIsXG5cdFx0XCJhcmlhLXJlbGV2YW50XCI6IFwiYWRkaXRpb25zXCIsXG5cdFx0aW5zaWRlOiB0aGlzLmNvbnRhaW5lclxuXHR9KTtcblxuXHQvLyBCaW5kIGV2ZW50c1xuXG5cdHRoaXMuX2V2ZW50cyA9IHtcblx0XHRpbnB1dDoge1xuXHRcdFx0XCJpbnB1dFwiOiB0aGlzLmV2YWx1YXRlLmJpbmQodGhpcyksXG5cdFx0XHRcImJsdXJcIjogdGhpcy5jbG9zZS5iaW5kKHRoaXMsIHsgcmVhc29uOiBcImJsdXJcIiB9KSxcblx0XHRcdFwia2V5ZG93blwiOiBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0dmFyIGMgPSBldnQua2V5Q29kZTtcblxuXHRcdFx0XHQvLyBJZiB0aGUgZHJvcGRvd24gYHVsYCBpcyBpbiB2aWV3LCB0aGVuIGFjdCBvbiBrZXlkb3duIGZvciB0aGUgZm9sbG93aW5nIGtleXM6XG5cdFx0XHRcdC8vIEVudGVyIC8gRXNjIC8gVXAgLyBEb3duXG5cdFx0XHRcdGlmKG1lLm9wZW5lZCkge1xuXHRcdFx0XHRcdGlmIChjID09PSAxMyAmJiBtZS5zZWxlY3RlZCkgeyAvLyBFbnRlclxuXHRcdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRtZS5zZWxlY3QoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoYyA9PT0gMjcpIHsgLy8gRXNjXG5cdFx0XHRcdFx0XHRtZS5jbG9zZSh7IHJlYXNvbjogXCJlc2NcIiB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoYyA9PT0gMzggfHwgYyA9PT0gNDApIHsgLy8gRG93bi9VcCBhcnJvd1xuXHRcdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRtZVtjID09PSAzOD8gXCJwcmV2aW91c1wiIDogXCJuZXh0XCJdKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRmb3JtOiB7XG5cdFx0XHRcInN1Ym1pdFwiOiB0aGlzLmNsb3NlLmJpbmQodGhpcywgeyByZWFzb246IFwic3VibWl0XCIgfSlcblx0XHR9LFxuXHRcdHVsOiB7XG5cdFx0XHRcIm1vdXNlZG93blwiOiBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0dmFyIGxpID0gZXZ0LnRhcmdldDtcblxuXHRcdFx0XHRpZiAobGkgIT09IHRoaXMpIHtcblxuXHRcdFx0XHRcdHdoaWxlIChsaSAmJiAhL2xpL2kudGVzdChsaS5ub2RlTmFtZSkpIHtcblx0XHRcdFx0XHRcdGxpID0gbGkucGFyZW50Tm9kZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAobGkgJiYgZXZ0LmJ1dHRvbiA9PT0gMCkgeyAgLy8gT25seSBzZWxlY3Qgb24gbGVmdCBjbGlja1xuXHRcdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRtZS5zZWxlY3QobGksIGV2dC50YXJnZXQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHQkLmJpbmQodGhpcy5pbnB1dCwgdGhpcy5fZXZlbnRzLmlucHV0KTtcblx0JC5iaW5kKHRoaXMuaW5wdXQuZm9ybSwgdGhpcy5fZXZlbnRzLmZvcm0pO1xuXHQkLmJpbmQodGhpcy51bCwgdGhpcy5fZXZlbnRzLnVsKTtcblxuXHRpZiAodGhpcy5pbnB1dC5oYXNBdHRyaWJ1dGUoXCJsaXN0XCIpKSB7XG5cdFx0dGhpcy5saXN0ID0gXCIjXCIgKyB0aGlzLmlucHV0LmdldEF0dHJpYnV0ZShcImxpc3RcIik7XG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJsaXN0XCIpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdHRoaXMubGlzdCA9IHRoaXMuaW5wdXQuZ2V0QXR0cmlidXRlKFwiZGF0YS1saXN0XCIpIHx8IG8ubGlzdCB8fCBbXTtcblx0fVxuXG5cdF8uYWxsLnB1c2godGhpcyk7XG59O1xuXG5fLnByb3RvdHlwZSA9IHtcblx0c2V0IGxpc3QobGlzdCkge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGxpc3QpKSB7XG5cdFx0XHR0aGlzLl9saXN0ID0gbGlzdDtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIGxpc3QgPT09IFwic3RyaW5nXCIgJiYgbGlzdC5pbmRleE9mKFwiLFwiKSA+IC0xKSB7XG5cdFx0XHRcdHRoaXMuX2xpc3QgPSBsaXN0LnNwbGl0KC9cXHMqLFxccyovKTtcblx0XHR9XG5cdFx0ZWxzZSB7IC8vIEVsZW1lbnQgb3IgQ1NTIHNlbGVjdG9yXG5cdFx0XHRsaXN0ID0gJChsaXN0KTtcblxuXHRcdFx0aWYgKGxpc3QgJiYgbGlzdC5jaGlsZHJlbikge1xuXHRcdFx0XHR2YXIgaXRlbXMgPSBbXTtcblx0XHRcdFx0c2xpY2UuYXBwbHkobGlzdC5jaGlsZHJlbikuZm9yRWFjaChmdW5jdGlvbiAoZWwpIHtcblx0XHRcdFx0XHRpZiAoIWVsLmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0XHR2YXIgdGV4dCA9IGVsLnRleHRDb250ZW50LnRyaW0oKTtcblx0XHRcdFx0XHRcdHZhciB2YWx1ZSA9IGVsLnZhbHVlIHx8IHRleHQ7XG5cdFx0XHRcdFx0XHR2YXIgbGFiZWwgPSBlbC5sYWJlbCB8fCB0ZXh0O1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlICE9PSBcIlwiKSB7XG5cdFx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goeyBsYWJlbDogbGFiZWwsIHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLl9saXN0ID0gaXRlbXM7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IHRoaXMuaW5wdXQpIHtcblx0XHRcdHRoaXMuZXZhbHVhdGUoKTtcblx0XHR9XG5cdH0sXG5cblx0Z2V0IHNlbGVjdGVkKCkge1xuXHRcdHJldHVybiB0aGlzLmluZGV4ID4gLTE7XG5cdH0sXG5cblx0Z2V0IG9wZW5lZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5pc09wZW5lZDtcblx0fSxcblxuXHRjbG9zZTogZnVuY3Rpb24gKG8pIHtcblx0XHRpZiAoIXRoaXMub3BlbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy51bC5zZXRBdHRyaWJ1dGUoXCJoaWRkZW5cIiwgXCJcIik7XG5cdFx0dGhpcy5pc09wZW5lZCA9IGZhbHNlO1xuXHRcdHRoaXMuaW5kZXggPSAtMTtcblxuXHRcdCQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLWNsb3NlXCIsIG8gfHwge30pO1xuXHR9LFxuXG5cdG9wZW46IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLnVsLnJlbW92ZUF0dHJpYnV0ZShcImhpZGRlblwiKTtcblx0XHR0aGlzLmlzT3BlbmVkID0gdHJ1ZTtcblxuXHRcdGlmICh0aGlzLmF1dG9GaXJzdCAmJiB0aGlzLmluZGV4ID09PSAtMSkge1xuXHRcdFx0dGhpcy5nb3RvKDApO1xuXHRcdH1cblxuXHRcdCQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLW9wZW5cIik7XG5cdH0sXG5cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0Ly9yZW1vdmUgZXZlbnRzIGZyb20gdGhlIGlucHV0IGFuZCBpdHMgZm9ybVxuXHRcdCQudW5iaW5kKHRoaXMuaW5wdXQsIHRoaXMuX2V2ZW50cy5pbnB1dCk7XG5cdFx0JC51bmJpbmQodGhpcy5pbnB1dC5mb3JtLCB0aGlzLl9ldmVudHMuZm9ybSk7XG5cblx0XHQvL21vdmUgdGhlIGlucHV0IG91dCBvZiB0aGUgYXdlc29tcGxldGUgY29udGFpbmVyIGFuZCByZW1vdmUgdGhlIGNvbnRhaW5lciBhbmQgaXRzIGNoaWxkcmVuXG5cdFx0dmFyIHBhcmVudE5vZGUgPSB0aGlzLmNvbnRhaW5lci5wYXJlbnROb2RlO1xuXG5cdFx0cGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGhpcy5pbnB1dCwgdGhpcy5jb250YWluZXIpO1xuXHRcdHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5jb250YWluZXIpO1xuXG5cdFx0Ly9yZW1vdmUgYXV0b2NvbXBsZXRlIGFuZCBhcmlhLWF1dG9jb21wbGV0ZSBhdHRyaWJ1dGVzXG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJhdXRvY29tcGxldGVcIik7XG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJhcmlhLWF1dG9jb21wbGV0ZVwiKTtcblxuXHRcdC8vcmVtb3ZlIHRoaXMgYXdlc29tZXBsZXRlIGluc3RhbmNlIGZyb20gdGhlIGdsb2JhbCBhcnJheSBvZiBpbnN0YW5jZXNcblx0XHR2YXIgaW5kZXhPZkF3ZXNvbXBsZXRlID0gXy5hbGwuaW5kZXhPZih0aGlzKTtcblxuXHRcdGlmIChpbmRleE9mQXdlc29tcGxldGUgIT09IC0xKSB7XG5cdFx0XHRfLmFsbC5zcGxpY2UoaW5kZXhPZkF3ZXNvbXBsZXRlLCAxKTtcblx0XHR9XG5cdH0sXG5cblx0bmV4dDogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBjb3VudCA9IHRoaXMudWwuY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdHRoaXMuZ290byh0aGlzLmluZGV4IDwgY291bnQgLSAxID8gdGhpcy5pbmRleCArIDEgOiAoY291bnQgPyAwIDogLTEpICk7XG5cdH0sXG5cblx0cHJldmlvdXM6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgY291bnQgPSB0aGlzLnVsLmNoaWxkcmVuLmxlbmd0aDtcblx0XHR2YXIgcG9zID0gdGhpcy5pbmRleCAtIDE7XG5cblx0XHR0aGlzLmdvdG8odGhpcy5zZWxlY3RlZCAmJiBwb3MgIT09IC0xID8gcG9zIDogY291bnQgLSAxKTtcblx0fSxcblxuXHQvLyBTaG91bGQgbm90IGJlIHVzZWQsIGhpZ2hsaWdodHMgc3BlY2lmaWMgaXRlbSB3aXRob3V0IGFueSBjaGVja3MhXG5cdGdvdG86IGZ1bmN0aW9uIChpKSB7XG5cdFx0dmFyIGxpcyA9IHRoaXMudWwuY2hpbGRyZW47XG5cblx0XHRpZiAodGhpcy5zZWxlY3RlZCkge1xuXHRcdFx0bGlzW3RoaXMuaW5kZXhdLnNldEF0dHJpYnV0ZShcImFyaWEtc2VsZWN0ZWRcIiwgXCJmYWxzZVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLmluZGV4ID0gaTtcblxuXHRcdGlmIChpID4gLTEgJiYgbGlzLmxlbmd0aCA+IDApIHtcblx0XHRcdGxpc1tpXS5zZXRBdHRyaWJ1dGUoXCJhcmlhLXNlbGVjdGVkXCIsIFwidHJ1ZVwiKTtcblx0XHRcdHRoaXMuc3RhdHVzLnRleHRDb250ZW50ID0gbGlzW2ldLnRleHRDb250ZW50O1xuXG5cdFx0XHQvLyBzY3JvbGwgdG8gaGlnaGxpZ2h0ZWQgZWxlbWVudCBpbiBjYXNlIHBhcmVudCdzIGhlaWdodCBpcyBmaXhlZFxuXHRcdFx0dGhpcy51bC5zY3JvbGxUb3AgPSBsaXNbaV0ub2Zmc2V0VG9wIC0gdGhpcy51bC5jbGllbnRIZWlnaHQgKyBsaXNbaV0uY2xpZW50SGVpZ2h0O1xuXG5cdFx0XHQkLmZpcmUodGhpcy5pbnB1dCwgXCJhd2Vzb21wbGV0ZS1oaWdobGlnaHRcIiwge1xuXHRcdFx0XHR0ZXh0OiB0aGlzLnN1Z2dlc3Rpb25zW3RoaXMuaW5kZXhdXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0sXG5cblx0c2VsZWN0OiBmdW5jdGlvbiAoc2VsZWN0ZWQsIG9yaWdpbikge1xuXHRcdGlmIChzZWxlY3RlZCkge1xuXHRcdFx0dGhpcy5pbmRleCA9ICQuc2libGluZ0luZGV4KHNlbGVjdGVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLnVsLmNoaWxkcmVuW3RoaXMuaW5kZXhdO1xuXHRcdH1cblxuXHRcdGlmIChzZWxlY3RlZCkge1xuXHRcdFx0dmFyIHN1Z2dlc3Rpb24gPSB0aGlzLnN1Z2dlc3Rpb25zW3RoaXMuaW5kZXhdO1xuXG5cdFx0XHR2YXIgYWxsb3dlZCA9ICQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLXNlbGVjdFwiLCB7XG5cdFx0XHRcdHRleHQ6IHN1Z2dlc3Rpb24sXG5cdFx0XHRcdG9yaWdpbjogb3JpZ2luIHx8IHNlbGVjdGVkXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKGFsbG93ZWQpIHtcblx0XHRcdFx0dGhpcy5yZXBsYWNlKHN1Z2dlc3Rpb24pO1xuXHRcdFx0XHR0aGlzLmNsb3NlKHsgcmVhc29uOiBcInNlbGVjdFwiIH0pO1xuXHRcdFx0XHQkLmZpcmUodGhpcy5pbnB1dCwgXCJhd2Vzb21wbGV0ZS1zZWxlY3Rjb21wbGV0ZVwiLCB7XG5cdFx0XHRcdFx0dGV4dDogc3VnZ2VzdGlvblxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0ZXZhbHVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0dmFyIHZhbHVlID0gdGhpcy5pbnB1dC52YWx1ZTtcblxuXHRcdGlmICh2YWx1ZS5sZW5ndGggPj0gdGhpcy5taW5DaGFycyAmJiB0aGlzLl9saXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuaW5kZXggPSAtMTtcblx0XHRcdC8vIFBvcHVsYXRlIGxpc3Qgd2l0aCBvcHRpb25zIHRoYXQgbWF0Y2hcblx0XHRcdHRoaXMudWwuaW5uZXJIVE1MID0gXCJcIjtcblxuXHRcdFx0dGhpcy5zdWdnZXN0aW9ucyA9IHRoaXMuX2xpc3Rcblx0XHRcdFx0Lm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBTdWdnZXN0aW9uKG1lLmRhdGEoaXRlbSwgdmFsdWUpKTtcblx0XHRcdFx0fSlcblx0XHRcdFx0LmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG1lLmZpbHRlcihpdGVtLCB2YWx1ZSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy5zb3J0ICE9PSBmYWxzZSkge1xuXHRcdFx0XHR0aGlzLnN1Z2dlc3Rpb25zID0gdGhpcy5zdWdnZXN0aW9ucy5zb3J0KHRoaXMuc29ydCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc3VnZ2VzdGlvbnMgPSB0aGlzLnN1Z2dlc3Rpb25zLnNsaWNlKDAsIHRoaXMubWF4SXRlbXMpO1xuXG5cdFx0XHR0aGlzLnN1Z2dlc3Rpb25zLmZvckVhY2goZnVuY3Rpb24odGV4dCkge1xuXHRcdFx0XHRcdG1lLnVsLmFwcGVuZENoaWxkKG1lLml0ZW0odGV4dCwgdmFsdWUpKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdGlmICh0aGlzLnVsLmNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLmNsb3NlKHsgcmVhc29uOiBcIm5vbWF0Y2hlc1wiIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5vcGVuKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5jbG9zZSh7IHJlYXNvbjogXCJub21hdGNoZXNcIiB9KTtcblx0XHR9XG5cdH1cbn07XG5cbi8vIFN0YXRpYyBtZXRob2RzL3Byb3BlcnRpZXNcblxuXy5hbGwgPSBbXTtcblxuXy5GSUxURVJfQ09OVEFJTlMgPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0cmV0dXJuIFJlZ0V4cCgkLnJlZ0V4cEVzY2FwZShpbnB1dC50cmltKCkpLCBcImlcIikudGVzdCh0ZXh0KTtcbn07XG5cbl8uRklMVEVSX1NUQVJUU1dJVEggPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0cmV0dXJuIFJlZ0V4cChcIl5cIiArICQucmVnRXhwRXNjYXBlKGlucHV0LnRyaW0oKSksIFwiaVwiKS50ZXN0KHRleHQpO1xufTtcblxuXy5TT1JUX0JZTEVOR1RIID0gZnVuY3Rpb24gKGEsIGIpIHtcblx0aWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuXHRcdHJldHVybiBhLmxlbmd0aCAtIGIubGVuZ3RoO1xuXHR9XG5cblx0cmV0dXJuIGEgPCBiPyAtMSA6IDE7XG59O1xuXG5fLklURU0gPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0dmFyIGh0bWwgPSBpbnB1dC50cmltKCkgPT09IFwiXCIgPyB0ZXh0IDogdGV4dC5yZXBsYWNlKFJlZ0V4cCgkLnJlZ0V4cEVzY2FwZShpbnB1dC50cmltKCkpLCBcImdpXCIpLCBcIjxtYXJrPiQmPC9tYXJrPlwiKTtcblx0cmV0dXJuICQuY3JlYXRlKFwibGlcIiwge1xuXHRcdGlubmVySFRNTDogaHRtbCxcblx0XHRcImFyaWEtc2VsZWN0ZWRcIjogXCJmYWxzZVwiXG5cdH0pO1xufTtcblxuXy5SRVBMQUNFID0gZnVuY3Rpb24gKHRleHQpIHtcblx0dGhpcy5pbnB1dC52YWx1ZSA9IHRleHQudmFsdWU7XG59O1xuXG5fLkRBVEEgPSBmdW5jdGlvbiAoaXRlbS8qLCBpbnB1dCovKSB7IHJldHVybiBpdGVtOyB9O1xuXG4vLyBQcml2YXRlIGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBTdWdnZXN0aW9uKGRhdGEpIHtcblx0dmFyIG8gPSBBcnJheS5pc0FycmF5KGRhdGEpXG5cdCAgPyB7IGxhYmVsOiBkYXRhWzBdLCB2YWx1ZTogZGF0YVsxXSB9XG5cdCAgOiB0eXBlb2YgZGF0YSA9PT0gXCJvYmplY3RcIiAmJiBcImxhYmVsXCIgaW4gZGF0YSAmJiBcInZhbHVlXCIgaW4gZGF0YSA/IGRhdGEgOiB7IGxhYmVsOiBkYXRhLCB2YWx1ZTogZGF0YSB9O1xuXG5cdHRoaXMubGFiZWwgPSBvLmxhYmVsIHx8IG8udmFsdWU7XG5cdHRoaXMudmFsdWUgPSBvLnZhbHVlO1xufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFN1Z2dlc3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdHJpbmcucHJvdG90eXBlKSwgXCJsZW5ndGhcIiwge1xuXHRnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5sYWJlbC5sZW5ndGg7IH1cbn0pO1xuU3VnZ2VzdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPSBTdWdnZXN0aW9uLnByb3RvdHlwZS52YWx1ZU9mID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gXCJcIiArIHRoaXMubGFiZWw7XG59O1xuXG5mdW5jdGlvbiBjb25maWd1cmUoaW5zdGFuY2UsIHByb3BlcnRpZXMsIG8pIHtcblx0Zm9yICh2YXIgaSBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0dmFyIGluaXRpYWwgPSBwcm9wZXJ0aWVzW2ldLFxuXHRcdCAgICBhdHRyVmFsdWUgPSBpbnN0YW5jZS5pbnB1dC5nZXRBdHRyaWJ1dGUoXCJkYXRhLVwiICsgaS50b0xvd2VyQ2FzZSgpKTtcblxuXHRcdGlmICh0eXBlb2YgaW5pdGlhbCA9PT0gXCJudW1iZXJcIikge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSBwYXJzZUludChhdHRyVmFsdWUpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChpbml0aWFsID09PSBmYWxzZSkgeyAvLyBCb29sZWFuIG9wdGlvbnMgbXVzdCBiZSBmYWxzZSBieSBkZWZhdWx0IGFueXdheVxuXHRcdFx0aW5zdGFuY2VbaV0gPSBhdHRyVmFsdWUgIT09IG51bGw7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGluaXRpYWwgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSBudWxsO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGluc3RhbmNlW2ldID0gYXR0clZhbHVlO1xuXHRcdH1cblxuXHRcdGlmICghaW5zdGFuY2VbaV0gJiYgaW5zdGFuY2VbaV0gIT09IDApIHtcblx0XHRcdGluc3RhbmNlW2ldID0gKGkgaW4gbyk/IG9baV0gOiBpbml0aWFsO1xuXHRcdH1cblx0fVxufVxuXG4vLyBIZWxwZXJzXG5cbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuZnVuY3Rpb24gJChleHByLCBjb24pIHtcblx0cmV0dXJuIHR5cGVvZiBleHByID09PSBcInN0cmluZ1wiPyAoY29uIHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yKGV4cHIpIDogZXhwciB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiAkJChleHByLCBjb24pIHtcblx0cmV0dXJuIHNsaWNlLmNhbGwoKGNvbiB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChleHByKSk7XG59XG5cbiQuY3JlYXRlID0gZnVuY3Rpb24odGFnLCBvKSB7XG5cdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXG5cdGZvciAodmFyIGkgaW4gbykge1xuXHRcdHZhciB2YWwgPSBvW2ldO1xuXG5cdFx0aWYgKGkgPT09IFwiaW5zaWRlXCIpIHtcblx0XHRcdCQodmFsKS5hcHBlbmRDaGlsZChlbGVtZW50KTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoaSA9PT0gXCJhcm91bmRcIikge1xuXHRcdFx0dmFyIHJlZiA9ICQodmFsKTtcblx0XHRcdHJlZi5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlbGVtZW50LCByZWYpO1xuXHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChyZWYpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChpIGluIGVsZW1lbnQpIHtcblx0XHRcdGVsZW1lbnRbaV0gPSB2YWw7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoaSwgdmFsKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbiQuYmluZCA9IGZ1bmN0aW9uKGVsZW1lbnQsIG8pIHtcblx0aWYgKGVsZW1lbnQpIHtcblx0XHRmb3IgKHZhciBldmVudCBpbiBvKSB7XG5cdFx0XHR2YXIgY2FsbGJhY2sgPSBvW2V2ZW50XTtcblxuXHRcdFx0ZXZlbnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGNhbGxiYWNrKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufTtcblxuJC51bmJpbmQgPSBmdW5jdGlvbihlbGVtZW50LCBvKSB7XG5cdGlmIChlbGVtZW50KSB7XG5cdFx0Zm9yICh2YXIgZXZlbnQgaW4gbykge1xuXHRcdFx0dmFyIGNhbGxiYWNrID0gb1tldmVudF07XG5cblx0XHRcdGV2ZW50LnNwbGl0KC9cXHMrLykuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGNhbGxiYWNrKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufTtcblxuJC5maXJlID0gZnVuY3Rpb24odGFyZ2V0LCB0eXBlLCBwcm9wZXJ0aWVzKSB7XG5cdHZhciBldnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudChcIkhUTUxFdmVudHNcIik7XG5cblx0ZXZ0LmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlICk7XG5cblx0Zm9yICh2YXIgaiBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0ZXZ0W2pdID0gcHJvcGVydGllc1tqXTtcblx0fVxuXG5cdHJldHVybiB0YXJnZXQuZGlzcGF0Y2hFdmVudChldnQpO1xufTtcblxuJC5yZWdFeHBFc2NhcGUgPSBmdW5jdGlvbiAocykge1xuXHRyZXR1cm4gcy5yZXBsYWNlKC9bLVxcXFxeJCorPy4oKXxbXFxde31dL2csIFwiXFxcXCQmXCIpO1xufTtcblxuJC5zaWJsaW5nSW5kZXggPSBmdW5jdGlvbiAoZWwpIHtcblx0LyogZXNsaW50LWRpc2FibGUgbm8tY29uZC1hc3NpZ24gKi9cblx0Zm9yICh2YXIgaSA9IDA7IGVsID0gZWwucHJldmlvdXNFbGVtZW50U2libGluZzsgaSsrKTtcblx0cmV0dXJuIGk7XG59O1xuXG4vLyBJbml0aWFsaXphdGlvblxuXG5mdW5jdGlvbiBpbml0KCkge1xuXHQkJChcImlucHV0LmF3ZXNvbXBsZXRlXCIpLmZvckVhY2goZnVuY3Rpb24gKGlucHV0KSB7XG5cdFx0bmV3IF8oaW5wdXQpO1xuXHR9KTtcbn1cblxuLy8gQXJlIHdlIGluIGEgYnJvd3Nlcj8gQ2hlY2sgZm9yIERvY3VtZW50IGNvbnN0cnVjdG9yXG5pZiAodHlwZW9mIERvY3VtZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cdC8vIERPTSBhbHJlYWR5IGxvYWRlZD9cblx0aWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgIT09IFwibG9hZGluZ1wiKSB7XG5cdFx0aW5pdCgpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdC8vIFdhaXQgZm9yIGl0XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgaW5pdCk7XG5cdH1cbn1cblxuXy4kID0gJDtcbl8uJCQgPSAkJDtcblxuLy8gTWFrZSBzdXJlIHRvIGV4cG9ydCBBd2Vzb21wbGV0ZSBvbiBzZWxmIHdoZW4gaW4gYSBicm93c2VyXG5pZiAodHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0c2VsZi5Bd2Vzb21wbGV0ZSA9IF87XG59XG5cbi8vIEV4cG9zZSBBd2Vzb21wbGV0ZSBhcyBhIENKUyBtb2R1bGVcbmlmICh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gXztcbn1cblxucmV0dXJuIF87XG5cbn0oKSk7XG4iLCIvKipcbiAqIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgYXMgbG9uZyBhcyBpdCBjb250aW51ZXMgdG8gYmUgaW52b2tlZCwgd2lsbCBub3RcbiAqIGJlIHRyaWdnZXJlZC4gVGhlIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkIGFmdGVyIGl0IHN0b3BzIGJlaW5nIGNhbGxlZCBmb3JcbiAqIE4gbWlsbGlzZWNvbmRzLiBJZiBgaW1tZWRpYXRlYCBpcyBwYXNzZWQsIHRyaWdnZXIgdGhlIGZ1bmN0aW9uIG9uIHRoZVxuICogbGVhZGluZyBlZGdlLCBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZy4gVGhlIGZ1bmN0aW9uIGFsc28gaGFzIGEgcHJvcGVydHkgJ2NsZWFyJyBcbiAqIHRoYXQgaXMgYSBmdW5jdGlvbiB3aGljaCB3aWxsIGNsZWFyIHRoZSB0aW1lciB0byBwcmV2ZW50IHByZXZpb3VzbHkgc2NoZWR1bGVkIGV4ZWN1dGlvbnMuIFxuICpcbiAqIEBzb3VyY2UgdW5kZXJzY29yZS5qc1xuICogQHNlZSBodHRwOi8vdW5zY3JpcHRhYmxlLmNvbS8yMDA5LzAzLzIwL2RlYm91bmNpbmctamF2YXNjcmlwdC1tZXRob2RzL1xuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb24gdG8gd3JhcFxuICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXQgaW4gbXMgKGAxMDBgKVxuICogQHBhcmFtIHtCb29sZWFufSB3aGV0aGVyIHRvIGV4ZWN1dGUgYXQgdGhlIGJlZ2lubmluZyAoYGZhbHNlYClcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0LCBpbW1lZGlhdGUpe1xuICB2YXIgdGltZW91dCwgYXJncywgY29udGV4dCwgdGltZXN0YW1wLCByZXN1bHQ7XG4gIGlmIChudWxsID09IHdhaXQpIHdhaXQgPSAxMDA7XG5cbiAgZnVuY3Rpb24gbGF0ZXIoKSB7XG4gICAgdmFyIGxhc3QgPSBEYXRlLm5vdygpIC0gdGltZXN0YW1wO1xuXG4gICAgaWYgKGxhc3QgPCB3YWl0ICYmIGxhc3QgPj0gMCkge1xuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICBpZiAoIWltbWVkaWF0ZSkge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHZhciBkZWJvdW5jZWQgPSBmdW5jdGlvbigpe1xuICAgIGNvbnRleHQgPSB0aGlzO1xuICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICB2YXIgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcbiAgICBpZiAoIXRpbWVvdXQpIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICBpZiAoY2FsbE5vdykge1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGRlYm91bmNlZC5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gIH07XG4gIFxuICBkZWJvdW5jZWQuZmx1c2ggPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGltZW91dCkge1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIFxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBkZWJvdW5jZWQ7XG59O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZ2VvcGxldGUnKTtcbiJdfQ==
