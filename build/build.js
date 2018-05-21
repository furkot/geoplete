require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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
    var params = {
      partial: true,
      bounds: options.bounds,
      lang: options.lang || document.lang || 'en'
    };
    params[options.type] = value;
    lastValue = value;
    el.classList.add('geoplete-in-progress');
    geocode(params, function(result) {
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

},{"awesomplete":2,"debounce":3,"furkot-geocode":8}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

},{"./debug":5,"_process":19}],5:[function(require,module,exports){

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

},{"ms":18}],6:[function(require,module,exports){
module.exports = require('./lib/fetchagent');

},{"./lib/fetchagent":7}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
module.exports = require('./lib/geocode');

},{"./lib/geocode":9}],9:[function(require,module,exports){
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
  }
};

//default timeout to complete operation
var defaultTimeout = 20 * 1000;
var id = 0;

function furkotGeocode(options) {
  var operations;

  function geocode(query, fn) {
    var timeoutId, queryId, op;
    if (!query) {
      return fn();
    }
    op = query.ll ? 'reverse' : 'forward';
    if (!(operations[op] && operations[op].length)) {
      return fn();
    }

    id += 1;
    queryId = id;
    timeoutId = setTimeout(function () {
      timeoutId = undefined;
      // cancel outstanding requests
      operations.abort.forEach(function (abort) {
        abort(queryId);
      });
    }, options.timeout);
    strategy(operations[op], queryId, query, {}, function (err, queryId, query, result) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (err) {
        return fn();
      }
      fn(result);
    });
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

},{"./service/algolia":10,"./service/opencage":12,"./service/util":15,"./strategy":16}],10:[function(require,module,exports){
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
    aroundLatLngViaIP: false
  };
  if (query.bounds) {
    req.aroundLatLng = mid(query.bounds[0][1], query.bounds[1][1]) +
      ',' + mid(query.bounds[0][0], query.bounds[0][1]);
  }
  if (query.address) {
    req.type = 'address';
  }
  if (query.lang) {
    req.language = query.lang.split('_').pop();
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
  if (options.algolia_parameters) {
    options = util.defaults(options, options.algolia_parameters);
  }
  return require('..')(options);
}

function mid(v1, v2) {
  return (v1 + v2) / 2;
}
},{"..":11,"../states":13,"../status":14,"../util":15}],11:[function(require,module,exports){
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

},{"./status":14,"./util":15,"debug":4,"fetchagent":6,"limiter-component":17}],12:[function(require,module,exports){
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
        if (res.type !== 'road') {
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

},{"..":11,"../status":14,"../util":15}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
module.exports = {
  success: 'success', // success
  failure: 'failure', // ultimate failure
  error: 'error', // temporary error
  empty: 'empty' // no result
};

},{}],15:[function(require,module,exports){
module.exports = {
  defaults: defaults
};

function defaults(obj, source) {
  return Object.assign({}, source, obj);
}

},{}],16:[function(require,module,exports){
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

},{"run-waterfall":20}],17:[function(require,module,exports){

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

},{}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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

},{"_process":19}],"geoplete":[function(require,module,exports){
module.exports = require('./lib/geoplete');

},{"./lib/geoplete":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvZ2VvcGxldGUuanMiLCJub2RlX21vZHVsZXMvYXdlc29tcGxldGUvYXdlc29tcGxldGUuanMiLCJub2RlX21vZHVsZXMvZGVib3VuY2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVidWcvc3JjL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZGVidWcvc3JjL2RlYnVnLmpzIiwibm9kZV9tb2R1bGVzL2ZldGNoYWdlbnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmV0Y2hhZ2VudC9saWIvZmV0Y2hhZ2VudC5qcyIsIm5vZGVfbW9kdWxlcy9mdXJrb3QtZ2VvY29kZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mdXJrb3QtZ2VvY29kZS9saWIvZ2VvY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9mdXJrb3QtZ2VvY29kZS9saWIvc2VydmljZS9hbGdvbGlhL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Z1cmtvdC1nZW9jb2RlL2xpYi9zZXJ2aWNlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Z1cmtvdC1nZW9jb2RlL2xpYi9zZXJ2aWNlL29wZW5jYWdlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Z1cmtvdC1nZW9jb2RlL2xpYi9zZXJ2aWNlL3N0YXRlcy5qc29uIiwibm9kZV9tb2R1bGVzL2Z1cmtvdC1nZW9jb2RlL2xpYi9zZXJ2aWNlL3N0YXR1cy5qcyIsIm5vZGVfbW9kdWxlcy9mdXJrb3QtZ2VvY29kZS9saWIvc2VydmljZS91dGlsLmpzIiwibm9kZV9tb2R1bGVzL2Z1cmtvdC1nZW9jb2RlL2xpYi9zdHJhdGVneS5qcyIsIm5vZGVfbW9kdWxlcy9saW1pdGVyLWNvbXBvbmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcnVuLXdhdGVyZmFsbC9pbmRleC5qcyIsImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDamZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDak9BO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaENBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgQXdlc29tcGxldGUgPSByZXF1aXJlKCdhd2Vzb21wbGV0ZScpO1xudmFyIGZ1cmtvdEdlb2NvZGUgPSByZXF1aXJlKCdmdXJrb3QtZ2VvY29kZScpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnZGVib3VuY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBnZW9wbGV0ZTtcblxudmFyIGRlZmF1bHRHZW9jb2RlciA9IHtcbiAgb3JkZXI6IFsnYWxnb2xpYSddLFxuICBhbGdvbGlhX3BhcmFtZXRlcnM6IHsgaW50ZXJ2YWwgOiAxMDAwIH0sXG4gIGFsZ29saWFfZW5hYmxlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRydWU7IH1cbn07XG5cbnZhciBTdWdnZXN0aW9ucyA9IHtcbiAgJ2FkZHJlc3MnOiB7XG4gICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5hZGRyZXNzIHx8IHRoaXMucGxhY2U7IH1cbiAgfSxcbiAgJ3BsYWNlJzoge1xuICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMucGxhY2UgfHwgdGhpcy5hZGRyZXNzOyB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGRpc3BsYXlBbGwoKSB7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBnZW9wbGV0ZShlbCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy50eXBlID0gU3VnZ2VzdGlvbnNbb3B0aW9ucy50eXBlXSA/IG9wdGlvbnMudHlwZSA6ICdhZGRyZXNzJztcbiAgdmFyIGFjT3B0aW9ucyA9IHtcbiAgICBtaW5DaGFyczogb3B0aW9ucy5taW5DaGFycyB8fCA0LFxuICAgIGZpbHRlcjogZGlzcGxheUFsbFxuICB9O1xuXG5cbiAgdmFyIGdlb09wdGlvbnMgPSBvcHRpb25zLmdlb2NvZGVyIHx8IGRlZmF1bHRHZW9jb2RlcjtcblxuICB2YXIgbGFzdFZhbHVlO1xuICB2YXIgZ2VvY29kZSA9IGZ1cmtvdEdlb2NvZGUoZ2VvT3B0aW9ucyk7XG4gIHZhciBhYyA9IG5ldyBBd2Vzb21wbGV0ZShlbCwgYWNPcHRpb25zKTtcblxuICB2YXIgb25pbnB1dCA9IGRlYm91bmNlKGZ1bmN0aW9uKCkge1xuICAgIGlmIChlbC52YWx1ZS5sZW5ndGggPCBhY09wdGlvbnMubWluQ2hhcnMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcXVlcnkoZWwudmFsdWUpO1xuICB9LCAzMDApO1xuXG4gIGZ1bmN0aW9uIG9uY2hhbmdlKGV2ZW50KSB7XG4gICAgdmFyIHZhbHVlID0gZXZlbnQudGV4dC52YWx1ZTtcbiAgICBsYXN0VmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuICAgIHZhciBjaGFuZ2VFdmVudCA9IG5ldyBDdXN0b21FdmVudCgnZ2VvcGxldGUtY2hhbmdlJywgeyBkZXRhaWw6IHZhbHVlIH0pO1xuICAgIGVsLmRpc3BhdGNoRXZlbnQoY2hhbmdlRXZlbnQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZnJvbVBsYWNlKHBsYWNlKSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShTdWdnZXN0aW9uc1tvcHRpb25zLnR5cGVdKSwgcGxhY2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gcXVlcnkodmFsdWUpIHtcbiAgICBpZiAobGFzdFZhbHVlID09PSB2YWx1ZSkge1xuICAgICAgLy8gZG8gbm90IHJlcXVlcnkgZm9yIHRoZSBzYW1lIHZhbHVlXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBwYXJhbXMgPSB7XG4gICAgICBwYXJ0aWFsOiB0cnVlLFxuICAgICAgYm91bmRzOiBvcHRpb25zLmJvdW5kcyxcbiAgICAgIGxhbmc6IG9wdGlvbnMubGFuZyB8fCBkb2N1bWVudC5sYW5nIHx8ICdlbidcbiAgICB9O1xuICAgIHBhcmFtc1tvcHRpb25zLnR5cGVdID0gdmFsdWU7XG4gICAgbGFzdFZhbHVlID0gdmFsdWU7XG4gICAgZWwuY2xhc3NMaXN0LmFkZCgnZ2VvcGxldGUtaW4tcHJvZ3Jlc3MnKTtcbiAgICBnZW9jb2RlKHBhcmFtcywgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdnZW9wbGV0ZS1pbi1wcm9ncmVzcycpO1xuICAgICAgaWYgKCFyZXN1bHQgfHwgIXJlc3VsdC5wbGFjZXMpIHtcbiAgICAgICAgLy8gbm8gcmVzdWx0c1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBhYy5saXN0ID0gcmVzdWx0LnBsYWNlcy5tYXAoZnJvbVBsYWNlKTtcbiAgICAgIGFjLmV2YWx1YXRlKCk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2lucHV0Jywgb25pbnB1dCk7XG4gICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignYXdlc29tcGxldGUtc2VsZWN0Y29tcGxldGUnLCBvbmNoYW5nZSk7XG4gICAgYWMuZGVzdHJveSgpO1xuICB9XG5cbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBvbmlucHV0KTtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignYXdlc29tcGxldGUtc2VsZWN0Y29tcGxldGUnLCBvbmNoYW5nZSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG59XG4iLCIvKipcbiAqIFNpbXBsZSwgbGlnaHR3ZWlnaHQsIHVzYWJsZSBsb2NhbCBhdXRvY29tcGxldGUgbGlicmFyeSBmb3IgbW9kZXJuIGJyb3dzZXJzXG4gKiBCZWNhdXNlIHRoZXJlIHdlcmVu4oCZdCBlbm91Z2ggYXV0b2NvbXBsZXRlIHNjcmlwdHMgaW4gdGhlIHdvcmxkPyBCZWNhdXNlIEnigJltIGNvbXBsZXRlbHkgaW5zYW5lIGFuZCBoYXZlIE5JSCBzeW5kcm9tZT8gUHJvYmFibHkgYm90aC4gOlBcbiAqIEBhdXRob3IgTGVhIFZlcm91IGh0dHA6Ly9sZWF2ZXJvdS5naXRodWIuaW8vYXdlc29tcGxldGVcbiAqIE1JVCBsaWNlbnNlXG4gKi9cblxuKGZ1bmN0aW9uICgpIHtcblxudmFyIF8gPSBmdW5jdGlvbiAoaW5wdXQsIG8pIHtcblx0dmFyIG1lID0gdGhpcztcblxuXHQvLyBTZXR1cFxuXG5cdHRoaXMuaXNPcGVuZWQgPSBmYWxzZTtcblxuXHR0aGlzLmlucHV0ID0gJChpbnB1dCk7XG5cdHRoaXMuaW5wdXQuc2V0QXR0cmlidXRlKFwiYXV0b2NvbXBsZXRlXCIsIFwib2ZmXCIpO1xuXHR0aGlzLmlucHV0LnNldEF0dHJpYnV0ZShcImFyaWEtYXV0b2NvbXBsZXRlXCIsIFwibGlzdFwiKTtcblxuXHRvID0gbyB8fCB7fTtcblxuXHRjb25maWd1cmUodGhpcywge1xuXHRcdG1pbkNoYXJzOiAyLFxuXHRcdG1heEl0ZW1zOiAxMCxcblx0XHRhdXRvRmlyc3Q6IGZhbHNlLFxuXHRcdGRhdGE6IF8uREFUQSxcblx0XHRmaWx0ZXI6IF8uRklMVEVSX0NPTlRBSU5TLFxuXHRcdHNvcnQ6IG8uc29ydCA9PT0gZmFsc2UgPyBmYWxzZSA6IF8uU09SVF9CWUxFTkdUSCxcblx0XHRpdGVtOiBfLklURU0sXG5cdFx0cmVwbGFjZTogXy5SRVBMQUNFXG5cdH0sIG8pO1xuXG5cdHRoaXMuaW5kZXggPSAtMTtcblxuXHQvLyBDcmVhdGUgbmVjZXNzYXJ5IGVsZW1lbnRzXG5cblx0dGhpcy5jb250YWluZXIgPSAkLmNyZWF0ZShcImRpdlwiLCB7XG5cdFx0Y2xhc3NOYW1lOiBcImF3ZXNvbXBsZXRlXCIsXG5cdFx0YXJvdW5kOiBpbnB1dFxuXHR9KTtcblxuXHR0aGlzLnVsID0gJC5jcmVhdGUoXCJ1bFwiLCB7XG5cdFx0aGlkZGVuOiBcImhpZGRlblwiLFxuXHRcdGluc2lkZTogdGhpcy5jb250YWluZXJcblx0fSk7XG5cblx0dGhpcy5zdGF0dXMgPSAkLmNyZWF0ZShcInNwYW5cIiwge1xuXHRcdGNsYXNzTmFtZTogXCJ2aXN1YWxseS1oaWRkZW5cIixcblx0XHRyb2xlOiBcInN0YXR1c1wiLFxuXHRcdFwiYXJpYS1saXZlXCI6IFwiYXNzZXJ0aXZlXCIsXG5cdFx0XCJhcmlhLXJlbGV2YW50XCI6IFwiYWRkaXRpb25zXCIsXG5cdFx0aW5zaWRlOiB0aGlzLmNvbnRhaW5lclxuXHR9KTtcblxuXHQvLyBCaW5kIGV2ZW50c1xuXG5cdHRoaXMuX2V2ZW50cyA9IHtcblx0XHRpbnB1dDoge1xuXHRcdFx0XCJpbnB1dFwiOiB0aGlzLmV2YWx1YXRlLmJpbmQodGhpcyksXG5cdFx0XHRcImJsdXJcIjogdGhpcy5jbG9zZS5iaW5kKHRoaXMsIHsgcmVhc29uOiBcImJsdXJcIiB9KSxcblx0XHRcdFwia2V5ZG93blwiOiBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0dmFyIGMgPSBldnQua2V5Q29kZTtcblxuXHRcdFx0XHQvLyBJZiB0aGUgZHJvcGRvd24gYHVsYCBpcyBpbiB2aWV3LCB0aGVuIGFjdCBvbiBrZXlkb3duIGZvciB0aGUgZm9sbG93aW5nIGtleXM6XG5cdFx0XHRcdC8vIEVudGVyIC8gRXNjIC8gVXAgLyBEb3duXG5cdFx0XHRcdGlmKG1lLm9wZW5lZCkge1xuXHRcdFx0XHRcdGlmIChjID09PSAxMyAmJiBtZS5zZWxlY3RlZCkgeyAvLyBFbnRlclxuXHRcdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRtZS5zZWxlY3QoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoYyA9PT0gMjcpIHsgLy8gRXNjXG5cdFx0XHRcdFx0XHRtZS5jbG9zZSh7IHJlYXNvbjogXCJlc2NcIiB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoYyA9PT0gMzggfHwgYyA9PT0gNDApIHsgLy8gRG93bi9VcCBhcnJvd1xuXHRcdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRtZVtjID09PSAzOD8gXCJwcmV2aW91c1wiIDogXCJuZXh0XCJdKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRmb3JtOiB7XG5cdFx0XHRcInN1Ym1pdFwiOiB0aGlzLmNsb3NlLmJpbmQodGhpcywgeyByZWFzb246IFwic3VibWl0XCIgfSlcblx0XHR9LFxuXHRcdHVsOiB7XG5cdFx0XHRcIm1vdXNlZG93blwiOiBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0dmFyIGxpID0gZXZ0LnRhcmdldDtcblxuXHRcdFx0XHRpZiAobGkgIT09IHRoaXMpIHtcblxuXHRcdFx0XHRcdHdoaWxlIChsaSAmJiAhL2xpL2kudGVzdChsaS5ub2RlTmFtZSkpIHtcblx0XHRcdFx0XHRcdGxpID0gbGkucGFyZW50Tm9kZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAobGkgJiYgZXZ0LmJ1dHRvbiA9PT0gMCkgeyAgLy8gT25seSBzZWxlY3Qgb24gbGVmdCBjbGlja1xuXHRcdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRtZS5zZWxlY3QobGksIGV2dC50YXJnZXQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHQkLmJpbmQodGhpcy5pbnB1dCwgdGhpcy5fZXZlbnRzLmlucHV0KTtcblx0JC5iaW5kKHRoaXMuaW5wdXQuZm9ybSwgdGhpcy5fZXZlbnRzLmZvcm0pO1xuXHQkLmJpbmQodGhpcy51bCwgdGhpcy5fZXZlbnRzLnVsKTtcblxuXHRpZiAodGhpcy5pbnB1dC5oYXNBdHRyaWJ1dGUoXCJsaXN0XCIpKSB7XG5cdFx0dGhpcy5saXN0ID0gXCIjXCIgKyB0aGlzLmlucHV0LmdldEF0dHJpYnV0ZShcImxpc3RcIik7XG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJsaXN0XCIpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdHRoaXMubGlzdCA9IHRoaXMuaW5wdXQuZ2V0QXR0cmlidXRlKFwiZGF0YS1saXN0XCIpIHx8IG8ubGlzdCB8fCBbXTtcblx0fVxuXG5cdF8uYWxsLnB1c2godGhpcyk7XG59O1xuXG5fLnByb3RvdHlwZSA9IHtcblx0c2V0IGxpc3QobGlzdCkge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGxpc3QpKSB7XG5cdFx0XHR0aGlzLl9saXN0ID0gbGlzdDtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodHlwZW9mIGxpc3QgPT09IFwic3RyaW5nXCIgJiYgbGlzdC5pbmRleE9mKFwiLFwiKSA+IC0xKSB7XG5cdFx0XHRcdHRoaXMuX2xpc3QgPSBsaXN0LnNwbGl0KC9cXHMqLFxccyovKTtcblx0XHR9XG5cdFx0ZWxzZSB7IC8vIEVsZW1lbnQgb3IgQ1NTIHNlbGVjdG9yXG5cdFx0XHRsaXN0ID0gJChsaXN0KTtcblxuXHRcdFx0aWYgKGxpc3QgJiYgbGlzdC5jaGlsZHJlbikge1xuXHRcdFx0XHR2YXIgaXRlbXMgPSBbXTtcblx0XHRcdFx0c2xpY2UuYXBwbHkobGlzdC5jaGlsZHJlbikuZm9yRWFjaChmdW5jdGlvbiAoZWwpIHtcblx0XHRcdFx0XHRpZiAoIWVsLmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0XHR2YXIgdGV4dCA9IGVsLnRleHRDb250ZW50LnRyaW0oKTtcblx0XHRcdFx0XHRcdHZhciB2YWx1ZSA9IGVsLnZhbHVlIHx8IHRleHQ7XG5cdFx0XHRcdFx0XHR2YXIgbGFiZWwgPSBlbC5sYWJlbCB8fCB0ZXh0O1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlICE9PSBcIlwiKSB7XG5cdFx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goeyBsYWJlbDogbGFiZWwsIHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLl9saXN0ID0gaXRlbXM7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IHRoaXMuaW5wdXQpIHtcblx0XHRcdHRoaXMuZXZhbHVhdGUoKTtcblx0XHR9XG5cdH0sXG5cblx0Z2V0IHNlbGVjdGVkKCkge1xuXHRcdHJldHVybiB0aGlzLmluZGV4ID4gLTE7XG5cdH0sXG5cblx0Z2V0IG9wZW5lZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5pc09wZW5lZDtcblx0fSxcblxuXHRjbG9zZTogZnVuY3Rpb24gKG8pIHtcblx0XHRpZiAoIXRoaXMub3BlbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy51bC5zZXRBdHRyaWJ1dGUoXCJoaWRkZW5cIiwgXCJcIik7XG5cdFx0dGhpcy5pc09wZW5lZCA9IGZhbHNlO1xuXHRcdHRoaXMuaW5kZXggPSAtMTtcblxuXHRcdCQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLWNsb3NlXCIsIG8gfHwge30pO1xuXHR9LFxuXG5cdG9wZW46IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLnVsLnJlbW92ZUF0dHJpYnV0ZShcImhpZGRlblwiKTtcblx0XHR0aGlzLmlzT3BlbmVkID0gdHJ1ZTtcblxuXHRcdGlmICh0aGlzLmF1dG9GaXJzdCAmJiB0aGlzLmluZGV4ID09PSAtMSkge1xuXHRcdFx0dGhpcy5nb3RvKDApO1xuXHRcdH1cblxuXHRcdCQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLW9wZW5cIik7XG5cdH0sXG5cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0Ly9yZW1vdmUgZXZlbnRzIGZyb20gdGhlIGlucHV0IGFuZCBpdHMgZm9ybVxuXHRcdCQudW5iaW5kKHRoaXMuaW5wdXQsIHRoaXMuX2V2ZW50cy5pbnB1dCk7XG5cdFx0JC51bmJpbmQodGhpcy5pbnB1dC5mb3JtLCB0aGlzLl9ldmVudHMuZm9ybSk7XG5cblx0XHQvL21vdmUgdGhlIGlucHV0IG91dCBvZiB0aGUgYXdlc29tcGxldGUgY29udGFpbmVyIGFuZCByZW1vdmUgdGhlIGNvbnRhaW5lciBhbmQgaXRzIGNoaWxkcmVuXG5cdFx0dmFyIHBhcmVudE5vZGUgPSB0aGlzLmNvbnRhaW5lci5wYXJlbnROb2RlO1xuXG5cdFx0cGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGhpcy5pbnB1dCwgdGhpcy5jb250YWluZXIpO1xuXHRcdHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5jb250YWluZXIpO1xuXG5cdFx0Ly9yZW1vdmUgYXV0b2NvbXBsZXRlIGFuZCBhcmlhLWF1dG9jb21wbGV0ZSBhdHRyaWJ1dGVzXG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJhdXRvY29tcGxldGVcIik7XG5cdFx0dGhpcy5pbnB1dC5yZW1vdmVBdHRyaWJ1dGUoXCJhcmlhLWF1dG9jb21wbGV0ZVwiKTtcblxuXHRcdC8vcmVtb3ZlIHRoaXMgYXdlc29tZXBsZXRlIGluc3RhbmNlIGZyb20gdGhlIGdsb2JhbCBhcnJheSBvZiBpbnN0YW5jZXNcblx0XHR2YXIgaW5kZXhPZkF3ZXNvbXBsZXRlID0gXy5hbGwuaW5kZXhPZih0aGlzKTtcblxuXHRcdGlmIChpbmRleE9mQXdlc29tcGxldGUgIT09IC0xKSB7XG5cdFx0XHRfLmFsbC5zcGxpY2UoaW5kZXhPZkF3ZXNvbXBsZXRlLCAxKTtcblx0XHR9XG5cdH0sXG5cblx0bmV4dDogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBjb3VudCA9IHRoaXMudWwuY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdHRoaXMuZ290byh0aGlzLmluZGV4IDwgY291bnQgLSAxID8gdGhpcy5pbmRleCArIDEgOiAoY291bnQgPyAwIDogLTEpICk7XG5cdH0sXG5cblx0cHJldmlvdXM6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgY291bnQgPSB0aGlzLnVsLmNoaWxkcmVuLmxlbmd0aDtcblx0XHR2YXIgcG9zID0gdGhpcy5pbmRleCAtIDE7XG5cblx0XHR0aGlzLmdvdG8odGhpcy5zZWxlY3RlZCAmJiBwb3MgIT09IC0xID8gcG9zIDogY291bnQgLSAxKTtcblx0fSxcblxuXHQvLyBTaG91bGQgbm90IGJlIHVzZWQsIGhpZ2hsaWdodHMgc3BlY2lmaWMgaXRlbSB3aXRob3V0IGFueSBjaGVja3MhXG5cdGdvdG86IGZ1bmN0aW9uIChpKSB7XG5cdFx0dmFyIGxpcyA9IHRoaXMudWwuY2hpbGRyZW47XG5cblx0XHRpZiAodGhpcy5zZWxlY3RlZCkge1xuXHRcdFx0bGlzW3RoaXMuaW5kZXhdLnNldEF0dHJpYnV0ZShcImFyaWEtc2VsZWN0ZWRcIiwgXCJmYWxzZVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLmluZGV4ID0gaTtcblxuXHRcdGlmIChpID4gLTEgJiYgbGlzLmxlbmd0aCA+IDApIHtcblx0XHRcdGxpc1tpXS5zZXRBdHRyaWJ1dGUoXCJhcmlhLXNlbGVjdGVkXCIsIFwidHJ1ZVwiKTtcblx0XHRcdHRoaXMuc3RhdHVzLnRleHRDb250ZW50ID0gbGlzW2ldLnRleHRDb250ZW50O1xuXG5cdFx0XHQvLyBzY3JvbGwgdG8gaGlnaGxpZ2h0ZWQgZWxlbWVudCBpbiBjYXNlIHBhcmVudCdzIGhlaWdodCBpcyBmaXhlZFxuXHRcdFx0dGhpcy51bC5zY3JvbGxUb3AgPSBsaXNbaV0ub2Zmc2V0VG9wIC0gdGhpcy51bC5jbGllbnRIZWlnaHQgKyBsaXNbaV0uY2xpZW50SGVpZ2h0O1xuXG5cdFx0XHQkLmZpcmUodGhpcy5pbnB1dCwgXCJhd2Vzb21wbGV0ZS1oaWdobGlnaHRcIiwge1xuXHRcdFx0XHR0ZXh0OiB0aGlzLnN1Z2dlc3Rpb25zW3RoaXMuaW5kZXhdXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0sXG5cblx0c2VsZWN0OiBmdW5jdGlvbiAoc2VsZWN0ZWQsIG9yaWdpbikge1xuXHRcdGlmIChzZWxlY3RlZCkge1xuXHRcdFx0dGhpcy5pbmRleCA9ICQuc2libGluZ0luZGV4KHNlbGVjdGVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLnVsLmNoaWxkcmVuW3RoaXMuaW5kZXhdO1xuXHRcdH1cblxuXHRcdGlmIChzZWxlY3RlZCkge1xuXHRcdFx0dmFyIHN1Z2dlc3Rpb24gPSB0aGlzLnN1Z2dlc3Rpb25zW3RoaXMuaW5kZXhdO1xuXG5cdFx0XHR2YXIgYWxsb3dlZCA9ICQuZmlyZSh0aGlzLmlucHV0LCBcImF3ZXNvbXBsZXRlLXNlbGVjdFwiLCB7XG5cdFx0XHRcdHRleHQ6IHN1Z2dlc3Rpb24sXG5cdFx0XHRcdG9yaWdpbjogb3JpZ2luIHx8IHNlbGVjdGVkXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKGFsbG93ZWQpIHtcblx0XHRcdFx0dGhpcy5yZXBsYWNlKHN1Z2dlc3Rpb24pO1xuXHRcdFx0XHR0aGlzLmNsb3NlKHsgcmVhc29uOiBcInNlbGVjdFwiIH0pO1xuXHRcdFx0XHQkLmZpcmUodGhpcy5pbnB1dCwgXCJhd2Vzb21wbGV0ZS1zZWxlY3Rjb21wbGV0ZVwiLCB7XG5cdFx0XHRcdFx0dGV4dDogc3VnZ2VzdGlvblxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0ZXZhbHVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBtZSA9IHRoaXM7XG5cdFx0dmFyIHZhbHVlID0gdGhpcy5pbnB1dC52YWx1ZTtcblxuXHRcdGlmICh2YWx1ZS5sZW5ndGggPj0gdGhpcy5taW5DaGFycyAmJiB0aGlzLl9saXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuaW5kZXggPSAtMTtcblx0XHRcdC8vIFBvcHVsYXRlIGxpc3Qgd2l0aCBvcHRpb25zIHRoYXQgbWF0Y2hcblx0XHRcdHRoaXMudWwuaW5uZXJIVE1MID0gXCJcIjtcblxuXHRcdFx0dGhpcy5zdWdnZXN0aW9ucyA9IHRoaXMuX2xpc3Rcblx0XHRcdFx0Lm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBTdWdnZXN0aW9uKG1lLmRhdGEoaXRlbSwgdmFsdWUpKTtcblx0XHRcdFx0fSlcblx0XHRcdFx0LmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG1lLmZpbHRlcihpdGVtLCB2YWx1ZSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy5zb3J0ICE9PSBmYWxzZSkge1xuXHRcdFx0XHR0aGlzLnN1Z2dlc3Rpb25zID0gdGhpcy5zdWdnZXN0aW9ucy5zb3J0KHRoaXMuc29ydCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc3VnZ2VzdGlvbnMgPSB0aGlzLnN1Z2dlc3Rpb25zLnNsaWNlKDAsIHRoaXMubWF4SXRlbXMpO1xuXG5cdFx0XHR0aGlzLnN1Z2dlc3Rpb25zLmZvckVhY2goZnVuY3Rpb24odGV4dCkge1xuXHRcdFx0XHRcdG1lLnVsLmFwcGVuZENoaWxkKG1lLml0ZW0odGV4dCwgdmFsdWUpKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdGlmICh0aGlzLnVsLmNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLmNsb3NlKHsgcmVhc29uOiBcIm5vbWF0Y2hlc1wiIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5vcGVuKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5jbG9zZSh7IHJlYXNvbjogXCJub21hdGNoZXNcIiB9KTtcblx0XHR9XG5cdH1cbn07XG5cbi8vIFN0YXRpYyBtZXRob2RzL3Byb3BlcnRpZXNcblxuXy5hbGwgPSBbXTtcblxuXy5GSUxURVJfQ09OVEFJTlMgPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0cmV0dXJuIFJlZ0V4cCgkLnJlZ0V4cEVzY2FwZShpbnB1dC50cmltKCkpLCBcImlcIikudGVzdCh0ZXh0KTtcbn07XG5cbl8uRklMVEVSX1NUQVJUU1dJVEggPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0cmV0dXJuIFJlZ0V4cChcIl5cIiArICQucmVnRXhwRXNjYXBlKGlucHV0LnRyaW0oKSksIFwiaVwiKS50ZXN0KHRleHQpO1xufTtcblxuXy5TT1JUX0JZTEVOR1RIID0gZnVuY3Rpb24gKGEsIGIpIHtcblx0aWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuXHRcdHJldHVybiBhLmxlbmd0aCAtIGIubGVuZ3RoO1xuXHR9XG5cblx0cmV0dXJuIGEgPCBiPyAtMSA6IDE7XG59O1xuXG5fLklURU0gPSBmdW5jdGlvbiAodGV4dCwgaW5wdXQpIHtcblx0dmFyIGh0bWwgPSBpbnB1dC50cmltKCkgPT09IFwiXCIgPyB0ZXh0IDogdGV4dC5yZXBsYWNlKFJlZ0V4cCgkLnJlZ0V4cEVzY2FwZShpbnB1dC50cmltKCkpLCBcImdpXCIpLCBcIjxtYXJrPiQmPC9tYXJrPlwiKTtcblx0cmV0dXJuICQuY3JlYXRlKFwibGlcIiwge1xuXHRcdGlubmVySFRNTDogaHRtbCxcblx0XHRcImFyaWEtc2VsZWN0ZWRcIjogXCJmYWxzZVwiXG5cdH0pO1xufTtcblxuXy5SRVBMQUNFID0gZnVuY3Rpb24gKHRleHQpIHtcblx0dGhpcy5pbnB1dC52YWx1ZSA9IHRleHQudmFsdWU7XG59O1xuXG5fLkRBVEEgPSBmdW5jdGlvbiAoaXRlbS8qLCBpbnB1dCovKSB7IHJldHVybiBpdGVtOyB9O1xuXG4vLyBQcml2YXRlIGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBTdWdnZXN0aW9uKGRhdGEpIHtcblx0dmFyIG8gPSBBcnJheS5pc0FycmF5KGRhdGEpXG5cdCAgPyB7IGxhYmVsOiBkYXRhWzBdLCB2YWx1ZTogZGF0YVsxXSB9XG5cdCAgOiB0eXBlb2YgZGF0YSA9PT0gXCJvYmplY3RcIiAmJiBcImxhYmVsXCIgaW4gZGF0YSAmJiBcInZhbHVlXCIgaW4gZGF0YSA/IGRhdGEgOiB7IGxhYmVsOiBkYXRhLCB2YWx1ZTogZGF0YSB9O1xuXG5cdHRoaXMubGFiZWwgPSBvLmxhYmVsIHx8IG8udmFsdWU7XG5cdHRoaXMudmFsdWUgPSBvLnZhbHVlO1xufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFN1Z2dlc3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdHJpbmcucHJvdG90eXBlKSwgXCJsZW5ndGhcIiwge1xuXHRnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5sYWJlbC5sZW5ndGg7IH1cbn0pO1xuU3VnZ2VzdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPSBTdWdnZXN0aW9uLnByb3RvdHlwZS52YWx1ZU9mID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gXCJcIiArIHRoaXMubGFiZWw7XG59O1xuXG5mdW5jdGlvbiBjb25maWd1cmUoaW5zdGFuY2UsIHByb3BlcnRpZXMsIG8pIHtcblx0Zm9yICh2YXIgaSBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0dmFyIGluaXRpYWwgPSBwcm9wZXJ0aWVzW2ldLFxuXHRcdCAgICBhdHRyVmFsdWUgPSBpbnN0YW5jZS5pbnB1dC5nZXRBdHRyaWJ1dGUoXCJkYXRhLVwiICsgaS50b0xvd2VyQ2FzZSgpKTtcblxuXHRcdGlmICh0eXBlb2YgaW5pdGlhbCA9PT0gXCJudW1iZXJcIikge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSBwYXJzZUludChhdHRyVmFsdWUpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChpbml0aWFsID09PSBmYWxzZSkgeyAvLyBCb29sZWFuIG9wdGlvbnMgbXVzdCBiZSBmYWxzZSBieSBkZWZhdWx0IGFueXdheVxuXHRcdFx0aW5zdGFuY2VbaV0gPSBhdHRyVmFsdWUgIT09IG51bGw7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGluaXRpYWwgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuXHRcdFx0aW5zdGFuY2VbaV0gPSBudWxsO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGluc3RhbmNlW2ldID0gYXR0clZhbHVlO1xuXHRcdH1cblxuXHRcdGlmICghaW5zdGFuY2VbaV0gJiYgaW5zdGFuY2VbaV0gIT09IDApIHtcblx0XHRcdGluc3RhbmNlW2ldID0gKGkgaW4gbyk/IG9baV0gOiBpbml0aWFsO1xuXHRcdH1cblx0fVxufVxuXG4vLyBIZWxwZXJzXG5cbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuZnVuY3Rpb24gJChleHByLCBjb24pIHtcblx0cmV0dXJuIHR5cGVvZiBleHByID09PSBcInN0cmluZ1wiPyAoY29uIHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yKGV4cHIpIDogZXhwciB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiAkJChleHByLCBjb24pIHtcblx0cmV0dXJuIHNsaWNlLmNhbGwoKGNvbiB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChleHByKSk7XG59XG5cbiQuY3JlYXRlID0gZnVuY3Rpb24odGFnLCBvKSB7XG5cdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXG5cdGZvciAodmFyIGkgaW4gbykge1xuXHRcdHZhciB2YWwgPSBvW2ldO1xuXG5cdFx0aWYgKGkgPT09IFwiaW5zaWRlXCIpIHtcblx0XHRcdCQodmFsKS5hcHBlbmRDaGlsZChlbGVtZW50KTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoaSA9PT0gXCJhcm91bmRcIikge1xuXHRcdFx0dmFyIHJlZiA9ICQodmFsKTtcblx0XHRcdHJlZi5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlbGVtZW50LCByZWYpO1xuXHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChyZWYpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChpIGluIGVsZW1lbnQpIHtcblx0XHRcdGVsZW1lbnRbaV0gPSB2YWw7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoaSwgdmFsKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbiQuYmluZCA9IGZ1bmN0aW9uKGVsZW1lbnQsIG8pIHtcblx0aWYgKGVsZW1lbnQpIHtcblx0XHRmb3IgKHZhciBldmVudCBpbiBvKSB7XG5cdFx0XHR2YXIgY2FsbGJhY2sgPSBvW2V2ZW50XTtcblxuXHRcdFx0ZXZlbnQuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGNhbGxiYWNrKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufTtcblxuJC51bmJpbmQgPSBmdW5jdGlvbihlbGVtZW50LCBvKSB7XG5cdGlmIChlbGVtZW50KSB7XG5cdFx0Zm9yICh2YXIgZXZlbnQgaW4gbykge1xuXHRcdFx0dmFyIGNhbGxiYWNrID0gb1tldmVudF07XG5cblx0XHRcdGV2ZW50LnNwbGl0KC9cXHMrLykuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGNhbGxiYWNrKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufTtcblxuJC5maXJlID0gZnVuY3Rpb24odGFyZ2V0LCB0eXBlLCBwcm9wZXJ0aWVzKSB7XG5cdHZhciBldnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudChcIkhUTUxFdmVudHNcIik7XG5cblx0ZXZ0LmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlICk7XG5cblx0Zm9yICh2YXIgaiBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0ZXZ0W2pdID0gcHJvcGVydGllc1tqXTtcblx0fVxuXG5cdHJldHVybiB0YXJnZXQuZGlzcGF0Y2hFdmVudChldnQpO1xufTtcblxuJC5yZWdFeHBFc2NhcGUgPSBmdW5jdGlvbiAocykge1xuXHRyZXR1cm4gcy5yZXBsYWNlKC9bLVxcXFxeJCorPy4oKXxbXFxde31dL2csIFwiXFxcXCQmXCIpO1xufTtcblxuJC5zaWJsaW5nSW5kZXggPSBmdW5jdGlvbiAoZWwpIHtcblx0LyogZXNsaW50LWRpc2FibGUgbm8tY29uZC1hc3NpZ24gKi9cblx0Zm9yICh2YXIgaSA9IDA7IGVsID0gZWwucHJldmlvdXNFbGVtZW50U2libGluZzsgaSsrKTtcblx0cmV0dXJuIGk7XG59O1xuXG4vLyBJbml0aWFsaXphdGlvblxuXG5mdW5jdGlvbiBpbml0KCkge1xuXHQkJChcImlucHV0LmF3ZXNvbXBsZXRlXCIpLmZvckVhY2goZnVuY3Rpb24gKGlucHV0KSB7XG5cdFx0bmV3IF8oaW5wdXQpO1xuXHR9KTtcbn1cblxuLy8gQXJlIHdlIGluIGEgYnJvd3Nlcj8gQ2hlY2sgZm9yIERvY3VtZW50IGNvbnN0cnVjdG9yXG5pZiAodHlwZW9mIERvY3VtZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cdC8vIERPTSBhbHJlYWR5IGxvYWRlZD9cblx0aWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgIT09IFwibG9hZGluZ1wiKSB7XG5cdFx0aW5pdCgpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdC8vIFdhaXQgZm9yIGl0XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgaW5pdCk7XG5cdH1cbn1cblxuXy4kID0gJDtcbl8uJCQgPSAkJDtcblxuLy8gTWFrZSBzdXJlIHRvIGV4cG9ydCBBd2Vzb21wbGV0ZSBvbiBzZWxmIHdoZW4gaW4gYSBicm93c2VyXG5pZiAodHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0c2VsZi5Bd2Vzb21wbGV0ZSA9IF87XG59XG5cbi8vIEV4cG9zZSBBd2Vzb21wbGV0ZSBhcyBhIENKUyBtb2R1bGVcbmlmICh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gXztcbn1cblxucmV0dXJuIF87XG5cbn0oKSk7XG4iLCIvKipcbiAqIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgYXMgbG9uZyBhcyBpdCBjb250aW51ZXMgdG8gYmUgaW52b2tlZCwgd2lsbCBub3RcbiAqIGJlIHRyaWdnZXJlZC4gVGhlIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkIGFmdGVyIGl0IHN0b3BzIGJlaW5nIGNhbGxlZCBmb3JcbiAqIE4gbWlsbGlzZWNvbmRzLiBJZiBgaW1tZWRpYXRlYCBpcyBwYXNzZWQsIHRyaWdnZXIgdGhlIGZ1bmN0aW9uIG9uIHRoZVxuICogbGVhZGluZyBlZGdlLCBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZy4gVGhlIGZ1bmN0aW9uIGFsc28gaGFzIGEgcHJvcGVydHkgJ2NsZWFyJyBcbiAqIHRoYXQgaXMgYSBmdW5jdGlvbiB3aGljaCB3aWxsIGNsZWFyIHRoZSB0aW1lciB0byBwcmV2ZW50IHByZXZpb3VzbHkgc2NoZWR1bGVkIGV4ZWN1dGlvbnMuIFxuICpcbiAqIEBzb3VyY2UgdW5kZXJzY29yZS5qc1xuICogQHNlZSBodHRwOi8vdW5zY3JpcHRhYmxlLmNvbS8yMDA5LzAzLzIwL2RlYm91bmNpbmctamF2YXNjcmlwdC1tZXRob2RzL1xuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb24gdG8gd3JhcFxuICogQHBhcmFtIHtOdW1iZXJ9IHRpbWVvdXQgaW4gbXMgKGAxMDBgKVxuICogQHBhcmFtIHtCb29sZWFufSB3aGV0aGVyIHRvIGV4ZWN1dGUgYXQgdGhlIGJlZ2lubmluZyAoYGZhbHNlYClcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0LCBpbW1lZGlhdGUpe1xuICB2YXIgdGltZW91dCwgYXJncywgY29udGV4dCwgdGltZXN0YW1wLCByZXN1bHQ7XG4gIGlmIChudWxsID09IHdhaXQpIHdhaXQgPSAxMDA7XG5cbiAgZnVuY3Rpb24gbGF0ZXIoKSB7XG4gICAgdmFyIGxhc3QgPSBEYXRlLm5vdygpIC0gdGltZXN0YW1wO1xuXG4gICAgaWYgKGxhc3QgPCB3YWl0ICYmIGxhc3QgPj0gMCkge1xuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICBpZiAoIWltbWVkaWF0ZSkge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHZhciBkZWJvdW5jZWQgPSBmdW5jdGlvbigpe1xuICAgIGNvbnRleHQgPSB0aGlzO1xuICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICB2YXIgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcbiAgICBpZiAoIXRpbWVvdXQpIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICBpZiAoY2FsbE5vdykge1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGRlYm91bmNlZC5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gIH07XG4gIFxuICBkZWJvdW5jZWQuZmx1c2ggPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGltZW91dCkge1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIFxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBkZWJvdW5jZWQ7XG59O1xuIiwiLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5leHBvcnRzLnN0b3JhZ2UgPSAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lXG4gICAgICAgICAgICAgICAmJiAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgICAgICAgID8gY2hyb21lLnN0b3JhZ2UubG9jYWxcbiAgICAgICAgICAgICAgICAgIDogbG9jYWxzdG9yYWdlKCk7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnIzAwMDBDQycsICcjMDAwMEZGJywgJyMwMDMzQ0MnLCAnIzAwMzNGRicsICcjMDA2NkNDJywgJyMwMDY2RkYnLCAnIzAwOTlDQycsXG4gICcjMDA5OUZGJywgJyMwMENDMDAnLCAnIzAwQ0MzMycsICcjMDBDQzY2JywgJyMwMENDOTknLCAnIzAwQ0NDQycsICcjMDBDQ0ZGJyxcbiAgJyMzMzAwQ0MnLCAnIzMzMDBGRicsICcjMzMzM0NDJywgJyMzMzMzRkYnLCAnIzMzNjZDQycsICcjMzM2NkZGJywgJyMzMzk5Q0MnLFxuICAnIzMzOTlGRicsICcjMzNDQzAwJywgJyMzM0NDMzMnLCAnIzMzQ0M2NicsICcjMzNDQzk5JywgJyMzM0NDQ0MnLCAnIzMzQ0NGRicsXG4gICcjNjYwMENDJywgJyM2NjAwRkYnLCAnIzY2MzNDQycsICcjNjYzM0ZGJywgJyM2NkNDMDAnLCAnIzY2Q0MzMycsICcjOTkwMENDJyxcbiAgJyM5OTAwRkYnLCAnIzk5MzNDQycsICcjOTkzM0ZGJywgJyM5OUNDMDAnLCAnIzk5Q0MzMycsICcjQ0MwMDAwJywgJyNDQzAwMzMnLFxuICAnI0NDMDA2NicsICcjQ0MwMDk5JywgJyNDQzAwQ0MnLCAnI0NDMDBGRicsICcjQ0MzMzAwJywgJyNDQzMzMzMnLCAnI0NDMzM2NicsXG4gICcjQ0MzMzk5JywgJyNDQzMzQ0MnLCAnI0NDMzNGRicsICcjQ0M2NjAwJywgJyNDQzY2MzMnLCAnI0NDOTkwMCcsICcjQ0M5OTMzJyxcbiAgJyNDQ0NDMDAnLCAnI0NDQ0MzMycsICcjRkYwMDAwJywgJyNGRjAwMzMnLCAnI0ZGMDA2NicsICcjRkYwMDk5JywgJyNGRjAwQ0MnLFxuICAnI0ZGMDBGRicsICcjRkYzMzAwJywgJyNGRjMzMzMnLCAnI0ZGMzM2NicsICcjRkYzMzk5JywgJyNGRjMzQ0MnLCAnI0ZGMzNGRicsXG4gICcjRkY2NjAwJywgJyNGRjY2MzMnLCAnI0ZGOTkwMCcsICcjRkY5OTMzJywgJyNGRkNDMDAnLCAnI0ZGQ0MzMydcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBOQjogSW4gYW4gRWxlY3Ryb24gcHJlbG9hZCBzY3JpcHQsIGRvY3VtZW50IHdpbGwgYmUgZGVmaW5lZCBidXQgbm90IGZ1bGx5XG4gIC8vIGluaXRpYWxpemVkLiBTaW5jZSB3ZSBrbm93IHdlJ3JlIGluIENocm9tZSwgd2UnbGwganVzdCBkZXRlY3QgdGhpcyBjYXNlXG4gIC8vIGV4cGxpY2l0bHlcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wcm9jZXNzICYmIHdpbmRvdy5wcm9jZXNzLnR5cGUgPT09ICdyZW5kZXJlcicpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIEludGVybmV0IEV4cGxvcmVyIGFuZCBFZGdlIGRvIG5vdCBzdXBwb3J0IGNvbG9ycy5cbiAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC8oZWRnZXx0cmlkZW50KVxcLyhcXGQrKS8pKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgLy8gZG9jdW1lbnQgaXMgdW5kZWZpbmVkIGluIHJlYWN0LW5hdGl2ZTogaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL3JlYWN0LW5hdGl2ZS9wdWxsLzE2MzJcbiAgcmV0dXJuICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLldlYmtpdEFwcGVhcmFuY2UpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuY29uc29sZSAmJiAod2luZG93LmNvbnNvbGUuZmlyZWJ1ZyB8fCAod2luZG93LmNvbnNvbGUuZXhjZXB0aW9uICYmIHdpbmRvdy5jb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEpIHx8XG4gICAgLy8gZG91YmxlIGNoZWNrIHdlYmtpdCBpbiB1c2VyQWdlbnQganVzdCBpbiBjYXNlIHdlIGFyZSBpbiBhIHdvcmtlclxuICAgICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvYXBwbGV3ZWJraXRcXC8oXFxkKykvKSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuICdbVW5leHBlY3RlZEpTT05QYXJzZUVycm9yXTogJyArIGVyci5tZXNzYWdlO1xuICB9XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncyhhcmdzKSB7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybjtcblxuICB2YXIgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG4gIGFyZ3Muc3BsaWNlKDEsIDAsIGMsICdjb2xvcjogaW5oZXJpdCcpXG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EtekEtWiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG59XG5cbi8qKlxuICogSW52b2tlcyBgY29uc29sZS5sb2coKWAgd2hlbiBhdmFpbGFibGUuXG4gKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gbG9nKCkge1xuICAvLyB0aGlzIGhhY2tlcnkgaXMgcmVxdWlyZWQgZm9yIElFOC85LCB3aGVyZVxuICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuICByZXR1cm4gJ29iamVjdCcgPT09IHR5cGVvZiBjb25zb2xlXG4gICAgJiYgY29uc29sZS5sb2dcbiAgICAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTYXZlIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2F2ZShuYW1lc3BhY2VzKSB7XG4gIHRyeSB7XG4gICAgaWYgKG51bGwgPT0gbmFtZXNwYWNlcykge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZztcbiAgfSBjYXRjaChlKSB7fVxuXG4gIC8vIElmIGRlYnVnIGlzbid0IHNldCBpbiBMUywgYW5kIHdlJ3JlIGluIEVsZWN0cm9uLCB0cnkgdG8gbG9hZCAkREVCVUdcbiAgaWYgKCFyICYmIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiAnZW52JyBpbiBwcm9jZXNzKSB7XG4gICAgciA9IHByb2Nlc3MuZW52LkRFQlVHO1xuICB9XG5cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuXG4vKipcbiAqIExvY2Fsc3RvcmFnZSBhdHRlbXB0cyB0byByZXR1cm4gdGhlIGxvY2Fsc3RvcmFnZS5cbiAqXG4gKiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHNhZmFyaSB0aHJvd3NcbiAqIHdoZW4gYSB1c2VyIGRpc2FibGVzIGNvb2tpZXMvbG9jYWxzdG9yYWdlXG4gKiBhbmQgeW91IGF0dGVtcHQgdG8gYWNjZXNzIGl0LlxuICpcbiAqIEByZXR1cm4ge0xvY2FsU3RvcmFnZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvY2Fsc3RvcmFnZSgpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcbiAgfSBjYXRjaCAoZSkge31cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWJ1Zy5kZWJ1ZyA9IGNyZWF0ZURlYnVnWydkZWZhdWx0J10gPSBjcmVhdGVEZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIEFjdGl2ZSBgZGVidWdgIGluc3RhbmNlcy5cbiAqL1xuZXhwb3J0cy5pbnN0YW5jZXMgPSBbXTtcblxuLyoqXG4gKiBUaGUgY3VycmVudGx5IGFjdGl2ZSBkZWJ1ZyBtb2RlIG5hbWVzLCBhbmQgbmFtZXMgdG8gc2tpcC5cbiAqL1xuXG5leHBvcnRzLm5hbWVzID0gW107XG5leHBvcnRzLnNraXBzID0gW107XG5cbi8qKlxuICogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuICpcbiAqIFZhbGlkIGtleSBuYW1lcyBhcmUgYSBzaW5nbGUsIGxvd2VyIG9yIHVwcGVyLWNhc2UgbGV0dGVyLCBpLmUuIFwiblwiIGFuZCBcIk5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKG5hbWVzcGFjZSkge1xuICB2YXIgaGFzaCA9IDAsIGk7XG5cbiAgZm9yIChpIGluIG5hbWVzcGFjZSkge1xuICAgIGhhc2ggID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgKyBuYW1lc3BhY2UuY2hhckNvZGVBdChpKTtcbiAgICBoYXNoIHw9IDA7IC8vIENvbnZlcnQgdG8gMzJiaXQgaW50ZWdlclxuICB9XG5cbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW01hdGguYWJzKGhhc2gpICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gY3JlYXRlRGVidWcobmFtZXNwYWNlKSB7XG5cbiAgdmFyIHByZXZUaW1lO1xuXG4gIGZ1bmN0aW9uIGRlYnVnKCkge1xuICAgIC8vIGRpc2FibGVkP1xuICAgIGlmICghZGVidWcuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgdmFyIHNlbGYgPSBkZWJ1ZztcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gdHVybiB0aGUgYGFyZ3VtZW50c2AgaW50byBhIHByb3BlciBBcnJheVxuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICB9XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlT1xuICAgICAgYXJncy51bnNoaWZ0KCclTycpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXpBLVolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICAvLyBhcHBseSBlbnYtc3BlY2lmaWMgZm9ybWF0dGluZyAoY29sb3JzLCBldGMuKVxuICAgIGV4cG9ydHMuZm9ybWF0QXJncy5jYWxsKHNlbGYsIGFyZ3MpO1xuXG4gICAgdmFyIGxvZ0ZuID0gZGVidWcubG9nIHx8IGV4cG9ydHMubG9nIHx8IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgbG9nRm4uYXBwbHkoc2VsZiwgYXJncyk7XG4gIH1cblxuICBkZWJ1Zy5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7XG4gIGRlYnVnLmVuYWJsZWQgPSBleHBvcnRzLmVuYWJsZWQobmFtZXNwYWNlKTtcbiAgZGVidWcudXNlQ29sb3JzID0gZXhwb3J0cy51c2VDb2xvcnMoKTtcbiAgZGVidWcuY29sb3IgPSBzZWxlY3RDb2xvcihuYW1lc3BhY2UpO1xuICBkZWJ1Zy5kZXN0cm95ID0gZGVzdHJveTtcblxuICAvLyBlbnYtc3BlY2lmaWMgaW5pdGlhbGl6YXRpb24gbG9naWMgZm9yIGRlYnVnIGluc3RhbmNlc1xuICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuaW5pdCkge1xuICAgIGV4cG9ydHMuaW5pdChkZWJ1Zyk7XG4gIH1cblxuICBleHBvcnRzLmluc3RhbmNlcy5wdXNoKGRlYnVnKTtcblxuICByZXR1cm4gZGVidWc7XG59XG5cbmZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICB2YXIgaW5kZXggPSBleHBvcnRzLmluc3RhbmNlcy5pbmRleE9mKHRoaXMpO1xuICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgZXhwb3J0cy5pbnN0YW5jZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICBleHBvcnRzLm5hbWVzID0gW107XG4gIGV4cG9ydHMuc2tpcHMgPSBbXTtcblxuICB2YXIgaTtcbiAgdmFyIHNwbGl0ID0gKHR5cGVvZiBuYW1lc3BhY2VzID09PSAnc3RyaW5nJyA/IG5hbWVzcGFjZXMgOiAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoIXNwbGl0W2ldKSBjb250aW51ZTsgLy8gaWdub3JlIGVtcHR5IHN0cmluZ3NcbiAgICBuYW1lc3BhY2VzID0gc3BsaXRbaV0ucmVwbGFjZSgvXFwqL2csICcuKj8nKTtcbiAgICBpZiAobmFtZXNwYWNlc1swXSA9PT0gJy0nKSB7XG4gICAgICBleHBvcnRzLnNraXBzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzLnN1YnN0cigxKSArICckJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLm5hbWVzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzICsgJyQnKSk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChpID0gMDsgaSA8IGV4cG9ydHMuaW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGluc3RhbmNlID0gZXhwb3J0cy5pbnN0YW5jZXNbaV07XG4gICAgaW5zdGFuY2UuZW5hYmxlZCA9IGV4cG9ydHMuZW5hYmxlZChpbnN0YW5jZS5uYW1lc3BhY2UpO1xuICB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBkZWJ1ZyBvdXRwdXQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkaXNhYmxlKCkge1xuICBleHBvcnRzLmVuYWJsZSgnJyk7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBtb2RlIG5hbWUgaXMgZW5hYmxlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGVkKG5hbWUpIHtcbiAgaWYgKG5hbWVbbmFtZS5sZW5ndGggLSAxXSA9PT0gJyonKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmFyIGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5za2lwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLnNraXBzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5uYW1lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLm5hbWVzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ29lcmNlIGB2YWxgLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuICogQHJldHVybiB7TWl4ZWR9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBjb2VyY2UodmFsKSB7XG4gIGlmICh2YWwgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIHZhbC5zdGFjayB8fCB2YWwubWVzc2FnZTtcbiAgcmV0dXJuIHZhbDtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZmV0Y2hhZ2VudCcpO1xuIiwiLyogZ2xvYmFsIEhlYWRlcnMgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmZXRjaGFnZW50O1xuXG5bJ2dldCcsICdwdXQnLCAncG9zdCcsICdkZWxldGUnXS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZCkge1xuICBmZXRjaGFnZW50W21ldGhvZF0gPSBmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gZmV0Y2hhZ2VudChtZXRob2QudG9VcHBlckNhc2UoKSwgdXJsKTtcbiAgfTtcbn0pO1xuXG5mZXRjaGFnZW50LmRlbCA9IGZldGNoYWdlbnQuZGVsZXRlO1xuXG5mdW5jdGlvbiBzZXRBbGwoZGVzdGluYXRpb24sIHNvdXJjZSkge1xuICBPYmplY3Qua2V5cyhzb3VyY2UpLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgIGRlc3RpbmF0aW9uLnNldChwLCBzb3VyY2VbcF0pO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0VXJsKHByZWZpeCwgcXVlcnkpIHtcbiAgZnVuY3Rpb24gZW5jb2RlKHYpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheSh2KVxuICAgICAgPyB2Lm1hcChlbmNvZGVVUklDb21wb25lbnQpLmpvaW4oJywnKVxuICAgICAgOiBlbmNvZGVVUklDb21wb25lbnQodik7XG4gIH1cblxuICBpZiAoIXF1ZXJ5KSB7XG4gICAgcmV0dXJuIHByZWZpeDtcbiAgfVxuICB2YXIgcXMgPSBPYmplY3RcbiAgICAua2V5cyhxdWVyeSlcbiAgICAubWFwKGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuIG5hbWUgKyAnPScgKyBlbmNvZGUocXVlcnlbbmFtZV0pOyB9KVxuICAgIC5qb2luKCcmJyk7XG4gIGlmICghcXMpIHtcbiAgICByZXR1cm4gcHJlZml4O1xuICB9XG4gIHJldHVybiBwcmVmaXggKyAnPycgKyBxcztcbn1cblxuZnVuY3Rpb24gZGVmYXVsdENvbnRlbnRQYXJzZXIoY29udGVudFR5cGUpIHtcbiAgcmV0dXJuIGNvbnRlbnRUeXBlICYmIGNvbnRlbnRUeXBlLmluZGV4T2YoJ2pzb24nKSAhPT0gLTFcbiAgICA/ICdqc29uJ1xuICAgIDogJ3RleHQnO1xufVxuXG5mdW5jdGlvbiBmZXRjaGFnZW50KG1ldGhvZCwgdXJsKSB7XG4gIHZhciByZXEgPSB7XG4gICAgdXJsOiB1cmwsXG4gICAgcXVlcnk6IHVuZGVmaW5lZFxuICB9O1xuICB2YXIgaW5pdCA9IHtcbiAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICByZWRpcmVjdDogJ21hbnVhbCcsXG4gICAgY3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbidcbiAgfTtcbiAgdmFyIHNlbGYgPSB7XG4gICAgZW5kOiBlbmQsXG4gICAganNvbjoganNvbixcbiAgICBwYXJzZXI6IHBhcnNlcixcbiAgICBxdWVyeTogcXVlcnksXG4gICAgcmVkaXJlY3Q6IHJlZGlyZWN0LFxuICAgIHNlbmQ6IHNlbmQsXG4gICAgc2V0OiBzZXQsXG4gICAgdGV4dDogdGV4dFxuICB9O1xuICB2YXIgZXJyb3I7XG4gIHZhciBjb250ZW50UGFyc2VyID0gZGVmYXVsdENvbnRlbnRQYXJzZXI7XG5cbiAgZnVuY3Rpb24gZW5kKGZuKSB7XG4gICAgdmFyIGZldGNoZWQgPSBmZXRjaChmb3JtYXRVcmwocmVxLnVybCwgcmVxLnF1ZXJ5KSwgaW5pdCk7XG5cbiAgICBpZiAoIWZuKSB7XG4gICAgICByZXR1cm4gZmV0Y2hlZDtcbiAgICB9XG5cbiAgICBmZXRjaGVkXG4gICAgICAudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICAgaWYgKCFyZXMub2spIHtcbiAgICAgICAgICBlcnJvciA9IHtcbiAgICAgICAgICAgIHN0YXR1czogcmVzLnN0YXR1cyxcbiAgICAgICAgICAgIHJlc3BvbnNlOiByZXNcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHZhciBwYXJzZXIgPSBjb250ZW50UGFyc2VyKHJlcy5oZWFkZXJzLmdldCgnQ29udGVudC1UeXBlJykpO1xuICAgICAgICBpZiAocGFyc2VyKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc1twYXJzZXJdKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWVycm9yKSB7XG4gICAgICAgICAgZXJyb3IgPSB7XG4gICAgICAgICAgICBzdGF0dXM6ICd1bmtub3duIENvbnRlbnQtVHlwZScsXG4gICAgICAgICAgICByZXNwb25zZTogcmVzXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC50aGVuKFxuICAgICAgICBmdW5jdGlvbihib2R5KSB7IHJldHVybiBmbihlcnJvciwgYm9keSk7IH0sXG4gICAgICAgIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlcnJvciA9IGVycm9yIHx8IHt9O1xuICAgICAgICAgIGVycm9yLmVycm9yID0gZTtcbiAgICAgICAgICByZXR1cm4gZm4oZXJyb3IpO1xuICAgICAgICB9XG4gICAgICApO1xuICB9XG5cbiAgZnVuY3Rpb24ganNvbigpIHtcbiAgICByZXR1cm4gZW5kKCkudGhlbihmdW5jdGlvbihyZXMpIHsgcmV0dXJuIHJlcy5qc29uKCk7IH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gdGV4dCgpIHtcbiAgICByZXR1cm4gZW5kKCkudGhlbihmdW5jdGlvbihyZXMpIHsgcmV0dXJuIHJlcy50ZXh0KCk7IH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VuZChib2R5KSB7XG4gICAgaWYgKGJvZHkgaW5zdGFuY2VvZiBCbG9iIHx8IGJvZHkgaW5zdGFuY2VvZiBGb3JtRGF0YSB8fCB0eXBlb2YgYm9keSAhPT0gJ29iamVjdCcpIHtcbiAgICAgIGluaXQuYm9keSA9IGJvZHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluaXQuYm9keSA9IEpTT04uc3RyaW5naWZ5KGJvZHkpO1xuICAgICAgc2V0KCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIH1cbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHF1ZXJ5KHEpIHtcbiAgICByZXEucXVlcnkgPSBxO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0KGhlYWRlciwgdmFsdWUpIHtcbiAgICBpZiAoIWluaXQuaGVhZGVycykge1xuICAgICAgaW5pdC5oZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGluaXQuaGVhZGVycy5zZXQoaGVhZGVyLCB2YWx1ZSk7XG4gICAgfVxuICAgIGVsc2UgIHtcbiAgICAgIHNldEFsbChpbml0LmhlYWRlcnMsIGhlYWRlcik7XG4gICAgfVxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVkaXJlY3QoZm9sbG93KSB7XG4gICAgaW5pdC5yZWRpcmVjdCA9IGZvbGxvdyA/ICdmb2xsb3cnIDogJ21hbnVhbCc7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZXIoZm4pIHtcbiAgICBjb250ZW50UGFyc2VyID0gZm47XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICByZXR1cm4gc2VsZjtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZ2VvY29kZScpO1xuIiwidmFyIHN0cmF0ZWd5ID0gcmVxdWlyZSgnLi9zdHJhdGVneScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3NlcnZpY2UvdXRpbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1cmtvdEdlb2NvZGU7XG5cbmZ1bmN0aW9uIHNraXAob3B0aW9ucywgcXVlcnksIHJlc3VsdCkge1xuICAvLyBzb21lIG90aGVyIHNlcnZpY2UgYWxyZWFkeSByZXR1cm5lZCByZXN1bHRcbiAgLy8gb3Igc2VydmljZSBpcyBkaXNhYmxlZFxuICByZXR1cm4gKHJlc3VsdCAmJiByZXN1bHQucGxhY2VzICYmIHJlc3VsdC5wbGFjZXMubGVuZ3RoKSB8fCAhb3B0aW9ucy5lbmFibGUocXVlcnksIHJlc3VsdCk7XG59XG5cbnZhciBzZXJ2aWNlcyA9IHtcbiAgYWxnb2xpYToge1xuICAgIGluaXQ6IHJlcXVpcmUoJy4vc2VydmljZS9hbGdvbGlhJylcbiAgfSxcbiAgb3BlbmNhZ2U6IHtcbiAgICBpbml0OiByZXF1aXJlKCcuL3NlcnZpY2Uvb3BlbmNhZ2UnKVxuICB9XG59O1xuXG4vL2RlZmF1bHQgdGltZW91dCB0byBjb21wbGV0ZSBvcGVyYXRpb25cbnZhciBkZWZhdWx0VGltZW91dCA9IDIwICogMTAwMDtcbnZhciBpZCA9IDA7XG5cbmZ1bmN0aW9uIGZ1cmtvdEdlb2NvZGUob3B0aW9ucykge1xuICB2YXIgb3BlcmF0aW9ucztcblxuICBmdW5jdGlvbiBnZW9jb2RlKHF1ZXJ5LCBmbikge1xuICAgIHZhciB0aW1lb3V0SWQsIHF1ZXJ5SWQsIG9wO1xuICAgIGlmICghcXVlcnkpIHtcbiAgICAgIHJldHVybiBmbigpO1xuICAgIH1cbiAgICBvcCA9IHF1ZXJ5LmxsID8gJ3JldmVyc2UnIDogJ2ZvcndhcmQnO1xuICAgIGlmICghKG9wZXJhdGlvbnNbb3BdICYmIG9wZXJhdGlvbnNbb3BdLmxlbmd0aCkpIHtcbiAgICAgIHJldHVybiBmbigpO1xuICAgIH1cblxuICAgIGlkICs9IDE7XG4gICAgcXVlcnlJZCA9IGlkO1xuICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgICAgLy8gY2FuY2VsIG91dHN0YW5kaW5nIHJlcXVlc3RzXG4gICAgICBvcGVyYXRpb25zLmFib3J0LmZvckVhY2goZnVuY3Rpb24gKGFib3J0KSB7XG4gICAgICAgIGFib3J0KHF1ZXJ5SWQpO1xuICAgICAgfSk7XG4gICAgfSwgb3B0aW9ucy50aW1lb3V0KTtcbiAgICBzdHJhdGVneShvcGVyYXRpb25zW29wXSwgcXVlcnlJZCwgcXVlcnksIHt9LCBmdW5jdGlvbiAoZXJyLCBxdWVyeUlkLCBxdWVyeSwgcmVzdWx0KSB7XG4gICAgICBpZiAodGltZW91dElkKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICB0aW1lb3V0SWQgPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiBmbigpO1xuICAgICAgfVxuICAgICAgZm4ocmVzdWx0KTtcbiAgICB9KTtcbiAgfVxuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICB0aW1lb3V0OiBkZWZhdWx0VGltZW91dCxcbiAgICBvcmRlcjogWydvcGVuY2FnZSddLFxuICAgIHNraXA6IHNraXBcbiAgfSk7XG4gIG9wZXJhdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBhYm9ydDogW11cbiAgfSk7XG4gIFsnZm9yd2FyZCcsICdyZXZlcnNlJ10ucmVkdWNlKGZ1bmN0aW9uIChvcHRpb25zLCBvcCkge1xuICAgIGlmICghb3BlcmF0aW9uc1tvcF0pIHtcbiAgICAgIG9wZXJhdGlvbnNbb3BdID0gb3B0aW9ucy5vcmRlci5yZWR1Y2UoZnVuY3Rpb24gKHJlc3VsdCwgbmFtZSkge1xuICAgICAgICB2YXIgc2VydmljZSA9IHNlcnZpY2VzW25hbWVdO1xuICAgICAgICBpZiAoc2VydmljZSAmJiBvcHRpb25zWyhuYW1lICsgJ19lbmFibGUnKV0pIHtcbiAgICAgICAgICBpZiAoIXNlcnZpY2Uuc2VydmljZSkge1xuICAgICAgICAgICAgc2VydmljZS5zZXJ2aWNlID0gc2VydmljZS5pbml0KHV0aWwuZGVmYXVsdHMoe1xuICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICBsaW1pdGVyOiBvcHRpb25zWyhuYW1lICsgJ19saW1pdGVyJyldLFxuICAgICAgICAgICAgICBlbmFibGU6IG9wdGlvbnNbKG5hbWUgKyAnX2VuYWJsZScpXSxcbiAgICAgICAgICAgICAgc2tpcDogc2VydmljZS5za2lwXG4gICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICBvcGVyYXRpb25zLmFib3J0LnB1c2goc2VydmljZS5zZXJ2aWNlLmFib3J0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcnZpY2Uuc2VydmljZVtvcF0gJiYgc2VydmljZS5zZXJ2aWNlLmdlb2NvZGUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHNlcnZpY2Uuc2VydmljZS5nZW9jb2RlLmJpbmQodW5kZWZpbmVkLCBvcCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfSwgb3B0aW9ucyk7XG5cbiAgZ2VvY29kZS5vcHRpb25zID0gb3BlcmF0aW9ucztcbiAgcmV0dXJuIGdlb2NvZGU7XG59XG4iLCJ2YXIgc3RhdGVzID0gcmVxdWlyZSgnLi4vc3RhdGVzJyk7XG52YXIgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG5mdW5jdGlvbiBnZXRVcmwodXJsLCBrZXksIGlkKSB7XG4gIGlmIChrZXkgJiYgaWQpIHtcbiAgICB1cmwgKz0gJz94LWFsZ29saWEtYXBpLWtleT0nICsga2V5ICsgJyZ4LWFsZ29saWEtYXBwbGljYXRpb24taWQ9JyArIGlkO1xuICB9XG4gIHJldHVybiB1cmw7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KG9wLCBxdWVyeSkge1xuICB2YXIgcmVxID0ge1xuICAgIHF1ZXJ5OiBxdWVyeS5hZGRyZXNzIHx8IHF1ZXJ5LnBsYWNlLFxuICAgIGFyb3VuZExhdExuZ1ZpYUlQOiBmYWxzZVxuICB9O1xuICBpZiAocXVlcnkuYm91bmRzKSB7XG4gICAgcmVxLmFyb3VuZExhdExuZyA9IG1pZChxdWVyeS5ib3VuZHNbMF1bMV0sIHF1ZXJ5LmJvdW5kc1sxXVsxXSkgK1xuICAgICAgJywnICsgbWlkKHF1ZXJ5LmJvdW5kc1swXVswXSwgcXVlcnkuYm91bmRzWzBdWzFdKTtcbiAgfVxuICBpZiAocXVlcnkuYWRkcmVzcykge1xuICAgIHJlcS50eXBlID0gJ2FkZHJlc3MnO1xuICB9XG4gIGlmIChxdWVyeS5sYW5nKSB7XG4gICAgcmVxLmxhbmd1YWdlID0gcXVlcnkubGFuZy5zcGxpdCgnXycpLnBvcCgpO1xuICB9XG4gIHJldHVybiByZXE7XG59XG5cbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIGlmICghKHJlc3BvbnNlICYmIHJlc3BvbnNlLm5iSGl0cykpIHtcbiAgICByZXR1cm4gc3RhdHVzLmVtcHR5O1xuICB9XG4gIHJldHVybiBzdGF0dXMuc3VjY2Vzcztcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlLCBxdWVyeSwgcmVzdWx0KSB7XG4gIGlmICghKHJlc3BvbnNlICYmIHJlc3BvbnNlLmhpdHMgJiYgcmVzcG9uc2UuaGl0cy5sZW5ndGgpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHJlc3VsdC5wbGFjZXMgPSByZXNwb25zZS5oaXRzLm1hcChmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgdmFyIGdlb20gPSByZXN1bHQuX2dlb2xvYywgcmVzID0ge1xuICAgICAgbGw6IFsgZ2VvbS5sbmcsIGdlb20ubGF0IF1cbiAgICB9LCBhZGRyID0gW107XG4gICAgaWYgKHJlc3VsdC5pc19oaWdod2F5KSB7XG4gICAgICByZXMudHlwZSA9ICdyb2FkJztcbiAgICB9XG4gICAgZWxzZSBpZiAocmVzdWx0Ll90YWdzICYmIHJlc3VsdC5fdGFncy5sZW5ndGgpe1xuICAgICAgcmVzLnR5cGUgPSByZXN1bHQuX3RhZ3NbMF07XG4gICAgfVxuICAgIGlmIChyZXN1bHQubG9jYWxlX25hbWVzICYmIHJlc3VsdC5sb2NhbGVfbmFtZXMubGVuZ3RoKSB7XG4gICAgICBpZiAocmVzLnR5cGUgPT09ICdyb2FkJykge1xuICAgICAgICByZXMuc3RyZWV0ID0gcmVzdWx0LmxvY2FsZV9uYW1lc1swXTtcbiAgICAgICAgYWRkci5wdXNoKHJlcy5zdHJlZXQpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJlcy5wbGFjZSA9IHJlc3VsdC5sb2NhbGVfbmFtZXNbMF07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChyZXN1bHQuY2l0eSAmJiByZXN1bHQuY2l0eS5sZW5ndGgpIHtcbiAgICAgIHJlcy50b3duID0gcmVzdWx0LmNpdHlbMF07XG4gICAgICBhZGRyLnB1c2gocmVzLnRvd24pO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LmNvdW50eSAmJiByZXN1bHQuY291bnR5Lmxlbmd0aCkge1xuICAgICAgcmVzLmNvdW50eSA9IHJlc3VsdC5jb3VudHlbMF07XG4gICAgICBpZiAoIXJlcy50b3duKSB7XG4gICAgICAgIGFkZHIucHVzaChyZXMuY291bnR5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJlc3VsdC5hZG1pbmlzdHJhdGl2ZSAmJiByZXN1bHQuYWRtaW5pc3RyYXRpdmUubGVuZ3RoKSB7XG4gICAgICByZXMucHJvdmluY2UgPSBzdGF0ZXNbcmVzdWx0LmFkbWluaXN0cmF0aXZlWzBdXSB8fCByZXN1bHQuYWRtaW5pc3RyYXRpdmVbMF07XG4gICAgICBhZGRyLnB1c2gocmVzLnByb3ZpbmNlKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC5jb3VudHJ5KSB7XG4gICAgICByZXMuY291bnRyeSA9IHJlc3VsdC5jb3VudHJ5O1xuICAgICAgaWYgKHJlcy5jb3VudHJ5ID09PSAnVW5pdGVkIFN0YXRlcyBvZiBBbWVyaWNhJykge1xuICAgICAgICByZXMuY291bnRyeSA9ICdVU0EnO1xuICAgICAgfVxuICAgICAgYWRkci5wdXNoKHJlcy5jb3VudHJ5KTtcbiAgICB9XG4gICAgcmVzLmFkZHJlc3MgPSBhZGRyLmpvaW4oJywgJyk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGluaXQob3B0aW9ucykge1xuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBmb3J3YXJkOiB0cnVlLFxuICAgIHBvc3Q6IHRydWUsXG4gICAgdXJsOiBnZXRVcmwob3B0aW9ucy5hbGdvbGlhX3VybCB8fCAnaHR0cHM6Ly9wbGFjZXMtZHNuLmFsZ29saWEubmV0LzEvcGxhY2VzL3F1ZXJ5JyxcbiAgICAgIG9wdGlvbnMuYWxnb2xpYV9rZXksXG4gICAgICBvcHRpb25zLmFsZ29saWFfYXBwX2lkKSxcbiAgICBzdGF0dXM6IGdldFN0YXR1cyxcbiAgICBwcmVwYXJlUmVxdWVzdDogcHJlcGFyZVJlcXVlc3QsXG4gICAgcHJvY2Vzc1Jlc3BvbnNlOiBwcm9jZXNzUmVzcG9uc2VcbiAgfSk7XG4gIGlmIChvcHRpb25zLmFsZ29saWFfcGFyYW1ldGVycykge1xuICAgIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIG9wdGlvbnMuYWxnb2xpYV9wYXJhbWV0ZXJzKTtcbiAgfVxuICByZXR1cm4gcmVxdWlyZSgnLi4nKShvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gbWlkKHYxLCB2Mikge1xuICByZXR1cm4gKHYxICsgdjIpIC8gMjtcbn0iLCJ2YXIgZmV0Y2hhZ2VudCA9IHJlcXVpcmUoJ2ZldGNoYWdlbnQnKTtcbnZhciBzdGF0dXMgPSByZXF1aXJlKCcuL3N0YXR1cycpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2Z1cmtvdDpnZW9jb2RlOnNlcnZpY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xuXG52YXIgbGltaXRlcnMgPSB7fTtcblxudmFyIEVSUk9SID0gJ2lucHV0IGVycm9yJztcblxuZnVuY3Rpb24gcmVxdWVzdCh1cmwsIHJlcSwgZm4pIHtcbiAgdmFyIG9wdGlvbnMgPSB0aGlzLCBmYSA9IGZldGNoYWdlbnQ7XG4gIGlmIChvcHRpb25zLnBvc3QpIHtcbiAgICBmYSA9IGZhLnBvc3QodXJsKS5zZW5kKHJlcSk7XG4gIH1cbiAgZWxzZSB7XG4gICAgZmEgPSBmYS5nZXQodXJsKS5xdWVyeShyZXEpO1xuICB9XG4gIHJldHVybiBmYVxuICAgIC5zZXQoJ2FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAuZW5kKGZuKTtcbn1cblxuZnVuY3Rpb24gaW5pdFVybCh1cmwpIHtcbiAgaWYgKHR5cGVvZiB1cmwgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gdXJsO1xuICB9XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHVybDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG4gIHZhciBsaW1pdGVyLCBob2xkUmVxdWVzdHMsIG91dHN0YW5kaW5nID0ge307XG5cbiAgZnVuY3Rpb24gYWJvcnQocXVlcnlJZCkge1xuICAgIGRlYnVnKCdhYm9ydCcsIHF1ZXJ5SWQpO1xuICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gY2FuY2VsIGxhdGVyIHJlcXVlc3QgaWYgc2NoZWR1bGVkXG4gICAgaWYgKG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmxhdGVyVGltZW91dElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQob3V0c3RhbmRpbmdbcXVlcnlJZF0ubGF0ZXJUaW1lb3V0SWQpO1xuICAgIH1cbiAgICAvLyBjYW5jZWwgcmVxdWVzdCBpbiBwcm9ncmVzc1xuICAgIGlmIChvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzKSB7XG4gICAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5yZXFJblByb2dyZXNzLmFib3J0KCk7XG4gICAgfVxuICAgIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmNhbGxiYWNrKEVSUk9SKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdlb2NvZGUob3AsIHF1ZXJ5SWQsIHF1ZXJ5LCByZXN1bHQsIGZuKSB7XG5cbiAgICBmdW5jdGlvbiByZXF1ZXN0TGF0ZXIoKSB7XG4gICAgICBvdXRzdGFuZGluZ1txdWVyeUlkXS5sYXRlclRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAob3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgICBkZWxldGUgb3V0c3RhbmRpbmdbcXVlcnlJZF0ubGF0ZXJUaW1lb3V0SWQ7XG4gICAgICAgIH1cbiAgICAgICAgZXhlY3V0ZVF1ZXJ5KCk7XG4gICAgICB9LCBvcHRpb25zLnBlbmFsdHlUaW1lb3V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlUXVlcnkoY2FsbGJhY2spIHtcbiAgICAgIHZhciByZXE7XG5cbiAgICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgLy8gcXVlcnkgaGFzIGJlZW4gYWJvcnRlZFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoaG9sZFJlcXVlc3RzKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgICAgcmVxID0gb3B0aW9ucy5wcmVwYXJlUmVxdWVzdChvcCwgcXVlcnkpO1xuICAgICAgaWYgKCFyZXEpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICB9XG4gICAgICBpZiAocmVxID09PSB0cnVlKSB7XG4gICAgICAgIHJlcSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgbGltaXRlci50cmlnZ2VyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFvdXRzdGFuZGluZ1txdWVyeUlkXSkge1xuICAgICAgICAgIC8vIHF1ZXJ5IGhhcyBiZWVuIGFib3J0ZWRcbiAgICAgICAgICBsaW1pdGVyLnNraXAoKTsgLy8gaW1tZWRpYXRlbHkgcHJvY2VzcyB0aGUgbmV4dCByZXF1ZXN0IGluIHRoZSBxdWV1ZVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBxdWVyeS5zdGF0cyA9IHF1ZXJ5LnN0YXRzIHx8IFtdO1xuICAgICAgICBxdWVyeS5zdGF0cy5wdXNoKG9wdGlvbnMubmFtZSk7XG4gICAgICAgIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLnJlcUluUHJvZ3Jlc3MgPSBvcHRpb25zLnJlcXVlc3Qob3B0aW9ucy51cmwob3AsIHF1ZXJ5KSwgcmVxLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgIHZhciBzdCwgcmVzO1xuICAgICAgICAgIGlmICghb3V0c3RhbmRpbmdbcXVlcnlJZF0pIHtcbiAgICAgICAgICAgIC8vIHF1ZXJ5IGhhcyBiZWVuIGFib3J0ZWRcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIG91dHN0YW5kaW5nW3F1ZXJ5SWRdLnJlcUluUHJvZ3Jlc3M7XG4gICAgICAgICAgc3QgPSBvcHRpb25zLnN0YXR1cyhlcnIsIHJlc3BvbnNlKTtcbiAgICAgICAgICBpZiAoc3QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gc2hvdWxkbid0IGhhcHBlbiAoYnVnIG9yIHVuZXhwZWN0ZWQgcmVzcG9uc2UgZm9ybWF0KVxuICAgICAgICAgICAgLy8gdHJlYXQgaXQgYXMgbm8gcmVzdWx0XG4gICAgICAgICAgICBzdCA9IHN0YXR1cy5lbXB0eTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0ID09PSBzdGF0dXMuZmFpbHVyZSkge1xuICAgICAgICAgICAgLy8gZG9uJ3QgZXZlciBhc2sgYWdhaW5cbiAgICAgICAgICAgIGhvbGRSZXF1ZXN0cyA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0ID09PSBzdGF0dXMuZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIHRyeSBhZ2FpbiBsYXRlclxuICAgICAgICAgICAgbGltaXRlci5wZW5hbHR5KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVxdWVzdExhdGVyKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHN0ID09PSBzdGF0dXMuc3VjY2Vzcykge1xuICAgICAgICAgICAgcmVzID0gb3B0aW9ucy5wcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIHF1ZXJ5LCByZXN1bHQgfHwge30pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjayh1bmRlZmluZWQsIHJlcyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgb3V0c3RhbmRpbmdbcXVlcnlJZF0gPSB7XG4gICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7XG4gICAgICAgIHZhciBmaW5pc2hlZCA9IEJvb2xlYW4ocmVzdWx0KTtcbiAgICAgICAgZGVsZXRlIG91dHN0YW5kaW5nW3F1ZXJ5SWRdO1xuICAgICAgICByZXN1bHQgPSByZXN1bHQgfHwge307XG4gICAgICAgIHJlc3VsdC5zdGF0cyA9IHF1ZXJ5LnN0YXRzO1xuICAgICAgICByZXN1bHQucHJvdmlkZXIgPSBvcHRpb25zLm5hbWU7XG4gICAgICAgIGZuKGVyciwgZmluaXNoZWQsIHF1ZXJ5SWQsIHF1ZXJ5LCByZXN1bHQpO1xuICAgICAgfVxuICAgIH07XG4gICAgZXhlY3V0ZVF1ZXJ5KG91dHN0YW5kaW5nW3F1ZXJ5SWRdLmNhbGxiYWNrKTtcbiAgfVxuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBpbnRlcnZhbDogMzQwLFxuICAgIHBlbmFsdHlJbnRlcnZhbDogMjAwMCxcbiAgICBsaW1pdGVyOiBsaW1pdGVyc1tvcHRpb25zLm5hbWVdLFxuICAgIHJlcXVlc3Q6IHJlcXVlc3QsXG4gICAgYWJvcnQ6IGFib3J0XG4gIH0pO1xuICBvcHRpb25zLnVybCA9IGluaXRVcmwob3B0aW9ucy51cmwpO1xuICBsaW1pdGVyc1tvcHRpb25zLm5hbWVdID0gb3B0aW9ucy5saW1pdGVyIHx8IHJlcXVpcmUoJ2xpbWl0ZXItY29tcG9uZW50Jykob3B0aW9ucy5pbnRlcnZhbCwgb3B0aW9ucy5wZW5hbHR5SW50ZXJ2YWwpO1xuICBsaW1pdGVyID0gbGltaXRlcnNbb3B0aW9ucy5uYW1lXTtcbiAgXG4gIHJldHVybiB7XG4gICAgZm9yd2FyZDogb3B0aW9ucy5mb3J3YXJkLFxuICAgIHJldmVyc2U6IG9wdGlvbnMucmV2ZXJzZSxcbiAgICBnZW9jb2RlOiBnZW9jb2RlLFxuICAgIGFib3J0OiBvcHRpb25zLmFib3J0XG4gIH07XG59XG4iLCJ2YXIgc3RhdHVzID0gcmVxdWlyZSgnLi4vc3RhdHVzJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxudmFyIGNvZGUyc3RhdHVzID0ge1xuICAyMDA6IHN0YXR1cy5zdWNjZXNzLCAvLyBPSyAoemVybyBvciBtb3JlIHJlc3VsdHMgd2lsbCBiZSByZXR1cm5lZClcbiAgNDAwOiBzdGF0dXMuZW1wdHksICAgLy8gSW52YWxpZCByZXF1ZXN0IChiYWQgcmVxdWVzdDsgYSByZXF1aXJlZCBwYXJhbWV0ZXIgaXMgbWlzc2luZzsgaW52YWxpZCBjb29yZGluYXRlcylcbiAgNDAyOiBzdGF0dXMuZmFpbHVyZSwgLy8gVmFsaWQgcmVxdWVzdCBidXQgcXVvdGEgZXhjZWVkZWQgKHBheW1lbnQgcmVxdWlyZWQpXG4gIDQwMzogc3RhdHVzLmZhaWx1cmUsIC8vIEludmFsaWQgb3IgbWlzc2luZyBhcGkga2V5IChmb3JiaWRkZW4pXG4gIDQwNDogc3RhdHVzLmZhaWx1cmUsIC8vIEludmFsaWQgQVBJIGVuZHBvaW50XG4gIDQwODogc3RhdHVzLmVycm9yLCAgIC8vIFRpbWVvdXQ7IHlvdSBjYW4gdHJ5IGFnYWluXG4gIDQxMDogc3RhdHVzLmVtcHR5LCAgIC8vIFJlcXVlc3QgdG9vIGxvbmdcbiAgNDI5OiBzdGF0dXMuZXJyb3IsICAgLy8gVG9vIG1hbnkgcmVxdWVzdHMgKHRvbyBxdWlja2x5LCByYXRlIGxpbWl0aW5nKVxuICA1MDM6IHN0YXR1cy5lbXB0eSAgICAvLyBJbnRlcm5hbCBzZXJ2ZXIgZXJyb3Jcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcblxuLy8gcmVzcG9uc2UgY29kZXM6IGh0dHBzOi8vZ2VvY29kZXIub3BlbmNhZ2VkYXRhLmNvbS9hcGkjY29kZXNcbmZ1bmN0aW9uIGdldFN0YXR1cyhlcnIsIHJlc3BvbnNlKSB7XG4gIHZhciBjb2RlID0gcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3RhdHVzICYmIHJlc3BvbnNlLnN0YXR1cy5jb2RlO1xuICBpZiAoIXJlc3BvbnNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvZGUgPSBjb2RlMnN0YXR1c1tjb2RlXTtcbiAgaWYgKGNvZGUgPT09IHN0YXR1cy5zdWNjZXNzICYmICEocmVzcG9uc2UucmVzdWx0cyAmJiByZXNwb25zZS5yZXN1bHRzLmxlbmd0aCkpIHtcbiAgICBjb2RlID0gc3RhdHVzLmVtcHR5O1xuICB9XG4gIHJldHVybiBjb2RlIHx8IHN0YXR1cy5lcnJvcjtcbn1cblxuZnVuY3Rpb24gZ2V0VXJsKHVybCwga2V5LCBvcCwgcXVlcnkpIHtcbiAgdmFyIHE7XG4gIGlmIChvcCA9PT0gJ2ZvcndhcmQnKSB7XG4gICAgcSA9IChxdWVyeS5hZGRyZXNzIHx8IHF1ZXJ5LnBsYWNlKS5yZXBsYWNlKC8gL2csICcrJykucmVwbGFjZSgvLC9nLCAnJTJDJyk7XG4gIH1cbiAgZWxzZSB7XG4gICAgcSA9IHF1ZXJ5LmxsWzFdICsgJysnICsgcXVlcnkubGxbMF07XG4gIH1cbiAgdXJsICs9ICc/cT0nICsgcTtcbiAgaWYgKHF1ZXJ5LmJvdW5kcykge1xuICAgIHVybCArPSAnJmJvdW5kcz0nICsgcXVlcnkuYm91bmRzLm1hcChqb2luKS5qb2luKCcsJyk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmxhbmcpIHtcbiAgICB1cmwgKz0gJyZsYW5ndWFnZT0nICsgcXVlcnkubGFuZztcbiAgfVxuICB1cmwgKz0gJyZub19hbm5vdGF0aW9ucz0xJztcbiAgcmV0dXJuIHVybCArICcma2V5PScgKyBrZXk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVSZXF1ZXN0KCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG5cbiAgZnVuY3Rpb24gcHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlLCBxdWVyeSwgcmVzdWx0KSB7XG4gICAgaWYgKCEocmVzcG9uc2UgJiYgcmVzcG9uc2UucmVzdWx0cyAmJiByZXNwb25zZS5yZXN1bHRzLmxlbmd0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzdWx0LnBsYWNlcyA9IHJlc3BvbnNlLnJlc3VsdHMubWFwKGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgIHZhciBjb21wb25lbnRzID0gcmVzdWx0LmNvbXBvbmVudHMsIGdlb20gPSByZXN1bHQuZ2VvbWV0cnksIHJlcyA9IHtcbiAgICAgICAgICBsbDogWyBnZW9tLmxuZywgZ2VvbS5sYXQgXVxuICAgICAgfSwgYWRkcjtcbiAgICAgIGlmIChjb21wb25lbnRzLl90eXBlKSB7XG4gICAgICAgIHJlcy50eXBlID0gY29tcG9uZW50cy5fdHlwZTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzW2NvbXBvbmVudHMuX3R5cGVdKSB7XG4gICAgICAgIHJlcy5wbGFjZSA9IGNvbXBvbmVudHNbY29tcG9uZW50cy5fdHlwZV07XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5ob3VzZV9udW1iZXIpIHtcbiAgICAgICAgcmVzLmhvdXNlID0gY29tcG9uZW50cy5ob3VzZV9udW1iZXI7XG4gICAgICB9XG4gICAgICBpZiAoY29tcG9uZW50cy5yb2FkIHx8IGNvbXBvbmVudHMucGVkZXN0cmlhbikge1xuICAgICAgICByZXMuc3RyZWV0ID0gY29tcG9uZW50cy5yb2FkIHx8IGNvbXBvbmVudHMucGVkZXN0cmlhbjtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLm5laWdoYm91cmhvb2QgfHwgY29tcG9uZW50cy52aWxsYWdlKSB7XG4gICAgICAgIHJlcy5jb21tdW5pdHkgPSBjb21wb25lbnRzLm5laWdoYm91cmhvb2QgfHwgY29tcG9uZW50cy52aWxsYWdlO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMudG93biB8fCBjb21wb25lbnRzLmNpdHkpIHtcbiAgICAgICAgcmVzLnRvd24gPSBjb21wb25lbnRzLnRvd24gfHwgY29tcG9uZW50cy5jaXR5O1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMuY291bnR5KSB7XG4gICAgICAgIHJlcy5jb3VudHkgPSBjb21wb25lbnRzLmNvdW50eTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wb25lbnRzLnN0YXRlX2NvZGUpIHtcbiAgICAgICAgcmVzLnByb3ZpbmNlID0gY29tcG9uZW50cy5zdGF0ZV9jb2RlO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBvbmVudHMuY291bnRyeSkge1xuICAgICAgICByZXMuY291bnRyeSA9IGNvbXBvbmVudHMuY291bnRyeTtcbiAgICAgICAgaWYgKHJlcy5jb3VudHJ5ID09PSAnVW5pdGVkIFN0YXRlcyBvZiBBbWVyaWNhJykge1xuICAgICAgICAgIHJlcy5jb3VudHJ5ID0gJ1VTQSc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuZm9ybWF0dGVkKSB7XG4gICAgICAgIHJlcy5hZGRyZXNzID0gcmVzdWx0LmZvcm1hdHRlZDtcbiAgICAgICAgaWYgKHJlcy50eXBlICE9PSAncm9hZCcpIHtcbiAgICAgICAgICBhZGRyID0gcmVzLmFkZHJlc3Muc3BsaXQoJywgJyk7XG4gICAgICAgICAgaWYgKGFkZHIubGVuZ3RoID4gMSAmJiBhZGRyWzBdID09PSByZXMucGxhY2UpIHtcbiAgICAgICAgICAgIGFkZHIuc2hpZnQoKTtcbiAgICAgICAgICAgIHJlcy5hZGRyZXNzID0gYWRkci5qb2luKCcsICcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzLmNvdW50cnkgPT09ICdVU0EnKSB7XG4gICAgICAgICAgcmVzLmFkZHJlc3MgPSByZXMuYWRkcmVzcy5yZXBsYWNlKCdVbml0ZWQgU3RhdGVzIG9mIEFtZXJpY2EnLCAnVVNBJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXM7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIG9wdGlvbnMgPSB1dGlsLmRlZmF1bHRzKG9wdGlvbnMsIHtcbiAgICBmb3J3YXJkOiB0cnVlLFxuICAgIHJldmVyc2U6IHRydWUsXG4gICAgdXJsOiBnZXRVcmwuYmluZCh1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnMub3BlbmNhZ2VfdXJsIHx8ICdodHRwczovL2FwaS5vcGVuY2FnZWRhdGEuY29tL2dlb2NvZGUvdjEvanNvbicsXG4gICAgICAgIG9wdGlvbnMub3BlbmNhZ2Vfa2V5KSxcbiAgICBzdGF0dXM6IGdldFN0YXR1cyxcbiAgICBwcmVwYXJlUmVxdWVzdDogcHJlcGFyZVJlcXVlc3QsXG4gICAgcHJvY2Vzc1Jlc3BvbnNlOiBwcm9jZXNzUmVzcG9uc2VcbiAgfSk7XG4gIGlmIChvcHRpb25zLm9wZW5jYWdlX3BhcmFtZXRlcnMpIHtcbiAgICBvcHRpb25zID0gdXRpbC5kZWZhdWx0cyhvcHRpb25zLCBvcHRpb25zLm9wZW5jYWdlX3BhcmFtZXRlcnMpO1xuICB9XG4gIHJldHVybiByZXF1aXJlKCcuLicpKG9wdGlvbnMpO1xufVxuXG5mdW5jdGlvbiBqb2luKGxsKSB7XG4gIHJldHVybiBsbC5qb2luKCcsJyk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gICAgXCJBbGFiYW1hXCI6IFwiQUxcIixcbiAgICBcIkFsYXNrYVwiOiBcIkFLXCIsXG4gICAgXCJBcml6b25hXCI6IFwiQVpcIixcbiAgICBcIkFya2Fuc2FzXCI6IFwiQVJcIixcbiAgICBcIkNhbGlmb3JuaWFcIjogXCJDQVwiLFxuICAgIFwiQ29sb3JhZG9cIjogXCJDT1wiLFxuICAgIFwiQ29ubmVjdGljdXRcIjogXCJDVFwiLFxuICAgIFwiRGVsYXdhcmVcIjogXCJERVwiLFxuICAgIFwiRGlzdHJpY3Qgb2YgQ29sdW1iaWFcIjogXCJEQ1wiLFxuICAgIFwiRmxvcmlkYVwiOiBcIkZMXCIsXG4gICAgXCJHZW9yZ2lhXCI6IFwiR0FcIixcbiAgICBcIkhhd2FpaVwiOiBcIkhJXCIsXG4gICAgXCJJZGFob1wiOiBcIklEXCIsXG4gICAgXCJJbGxpbm9pc1wiOiBcIklMXCIsXG4gICAgXCJJbmRpYW5hXCI6IFwiSU5cIixcbiAgICBcIklvd2FcIjogXCJJQVwiLFxuICAgIFwiS2Fuc2FzXCI6IFwiS1NcIixcbiAgICBcIktlbnR1Y2t5XCI6IFwiS1lcIixcbiAgICBcIkxvdWlzaWFuYVwiOiBcIkxBXCIsXG4gICAgXCJNYWluZVwiOiBcIk1FXCIsXG4gICAgXCJNb250YW5hXCI6IFwiTVRcIixcbiAgICBcIk5lYnJhc2thXCI6IFwiTkVcIixcbiAgICBcIk5ldmFkYVwiOiBcIk5WXCIsXG4gICAgXCJOZXcgSGFtcHNoaXJlXCI6IFwiTkhcIixcbiAgICBcIk5ldyBKZXJzZXlcIjogXCJOSlwiLFxuICAgIFwiTmV3IE1leGljb1wiOiBcIk5NXCIsXG4gICAgXCJOZXcgWW9ya1wiOiBcIk5ZXCIsXG4gICAgXCJOb3J0aCBDYXJvbGluYVwiOiBcIk5DXCIsXG4gICAgXCJOb3J0aCBEYWtvdGFcIjogXCJORFwiLFxuICAgIFwiT2hpb1wiOiBcIk9IXCIsXG4gICAgXCJPa2xhaG9tYVwiOiBcIk9LXCIsXG4gICAgXCJPcmVnb25cIjogXCJPUlwiLFxuICAgIFwiTWFyeWxhbmRcIjogXCJNRFwiLFxuICAgIFwiTWFzc2FjaHVzZXR0c1wiOiBcIk1BXCIsXG4gICAgXCJNaWNoaWdhblwiOiBcIk1JXCIsXG4gICAgXCJNaW5uZXNvdGFcIjogXCJNTlwiLFxuICAgIFwiTWlzc2lzc2lwcGlcIjogXCJNU1wiLFxuICAgIFwiTWlzc291cmlcIjogXCJNT1wiLFxuICAgIFwiUGVubnN5bHZhbmlhXCI6IFwiUEFcIixcbiAgICBcIlJob2RlIElzbGFuZFwiOiBcIlJJXCIsXG4gICAgXCJTb3V0aCBDYXJvbGluYVwiOiBcIlNDXCIsXG4gICAgXCJTb3V0aCBEYWtvdGFcIjogXCJTRFwiLFxuICAgIFwiVGVubmVzc2VlXCI6IFwiVE5cIixcbiAgICBcIlRleGFzXCI6IFwiVFhcIixcbiAgICBcIlV0YWhcIjogXCJVVFwiLFxuICAgIFwiVmVybW9udFwiOiBcIlZUXCIsXG4gICAgXCJWaXJnaW5pYVwiOiBcIlZBXCIsXG4gICAgXCJXYXNoaW5ndG9uXCI6IFwiV0FcIixcbiAgICBcIldlc3QgVmlyZ2luaWFcIjogXCJXVlwiLFxuICAgIFwiV2lzY29uc2luXCI6IFwiV0lcIixcbiAgICBcIld5b21pbmdcIjogXCJXWVwiLFxuXG4gICAgXCJBbGJlcnRhXCI6IFwiQUJcIixcbiAgICBcIkJyaXRpc2ggQ29sdW1iaWFcIjogXCJCQ1wiLFxuICAgIFwiTWFuaXRvYmFcIjogXCJNQlwiLFxuICAgIFwiTmV3IEJydW5zd2lja1wiOiBcIk5CXCIsXG4gICAgXCJOZXdmb3VuZGxhbmQgYW5kIExhYnJhZG9yXCI6IFwiTkxcIixcbiAgICBcIk5vcnRod2VzdCBUZXJyaXRvcmllc1wiOiBcIk5UXCIsXG4gICAgXCJOb3ZhIFNjb3RpYVwiOiBcIk5TXCIsXG4gICAgXCJOdW5hdnV0XCI6IFwiTlVcIixcbiAgICBcIk9udGFyaW9cIjogXCJPTlwiLFxuICAgIFwiUHJpbmNlIEVkd2FyZCBJc2xhbmRcIjogXCJQRVwiLFxuICAgIFwiUXVlYmVjXCI6IFwiUUNcIixcbiAgICBcIlNhc2thdGNoZXdhblwiOiBcIlNLXCIsXG4gICAgXCJZdWtvblwiOiBcIllUXCJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBzdWNjZXNzOiAnc3VjY2VzcycsIC8vIHN1Y2Nlc3NcbiAgZmFpbHVyZTogJ2ZhaWx1cmUnLCAvLyB1bHRpbWF0ZSBmYWlsdXJlXG4gIGVycm9yOiAnZXJyb3InLCAvLyB0ZW1wb3JhcnkgZXJyb3JcbiAgZW1wdHk6ICdlbXB0eScgLy8gbm8gcmVzdWx0XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGRlZmF1bHRzOiBkZWZhdWx0c1xufTtcblxuZnVuY3Rpb24gZGVmYXVsdHMob2JqLCBzb3VyY2UpIHtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHNvdXJjZSwgb2JqKTtcbn1cbiIsInZhciB3YXRlcmZhbGwgPSByZXF1aXJlKCdydW4td2F0ZXJmYWxsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc3RyYXRlZ3k7XG5cbnZhciBFTkQgPSAnZW5kIHByb2Nlc3NpbmcnO1xuXG4vKipcbiAqIFByb2Nlc3MgdGhlIGxpc3Qgb2YgdGFza3Mgb25lIGJ5IG9uZSxlbmRpbmcgcHJvY2Vzc2luZyBhcyBzb29uIGFzIG9uZSB0YXNrIHNheXMgc28uXG4gKiBUaGUgbmV4dCB0YXNrIGlzIGludm9rZWQgd2l0aCBwYXJhbWV0ZXJzIHNldCBieSB0aGUgcHJldmlvdXMgdGFzay5cbiAqIEl0IGlzIGEgY3Jvc3MgYmV0d2VlbiBhc3luYyBvcGVyYXRpb25zOiB3YXRlcmZhbGwgYW5kIHNvbWVcbiAqIEBwYXJhbSB0YXNrcyBsaXN0IG9mIHRhc2tzXG4gKiBAcGFyYW0gLi4uIGFueSBudW1iZXIgb2YgcGFyYW1ldGVycyB0byBiZSBwYXNzZWQgdG8gdGhlIGZpcnN0IHRhc2tcbiAqIEBwYXJhbSBjYWxsYmFjayB0aGUgbGFzdCBhcmd1bWVudCBpcyBhbiBvcHRpb25hbCBjYWxsYmFjayBjYWxsZWQgYWZ0ZXIgdGFza3MgaGF2ZSBiZWVuIHByb2Nlc3NlZDtcbiAqICAgY2FsbGVkIHdpdGggZXJyb3IgZm9sbG93ZWQgYnkgdGhlIHBhcmFtZXRlcnMgcGFzc2VkIGZyb20gdGhlIGxhc3QgaW52b2tlZCB0YXNrXG4gKi9cbmZ1bmN0aW9uIHN0cmF0ZWd5KHRhc2tzKSB7XG4gIHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0sXG4gICAgcGFyYW1ldGVycyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCwgLTEpO1xuICBwYXJhbWV0ZXJzWzBdID0gdW5kZWZpbmVkO1xuXG4gIHRhc2tzID0gdGFza3MucmVkdWNlKGZ1bmN0aW9uIChyZXN1bHQsIHRhc2spIHtcbiAgICByZXN1bHQucHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xuICAgICAgICBwYXJhbWV0ZXJzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwLCAtMSk7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goZnVuY3Rpb24gKGVyciwgdHJ1ZVZhbHVlKSB7XG4gICAgICAgIHZhciBwYXJhbWV0ZXJzID0gW2Vycl0uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikpO1xuICAgICAgICBpZiAoIWVyciAmJiB0cnVlVmFsdWUpIHtcbiAgICAgICAgICAvLyBqdW1wIG91dCBvZiBwcm9jZXNzaW5nXG4gICAgICAgICAgcGFyYW1ldGVyc1swXSA9IEVORDtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjay5hcHBseSh1bmRlZmluZWQsIHBhcmFtZXRlcnMpO1xuICAgICAgfSk7XG4gICAgICB0YXNrLmFwcGx5KHVuZGVmaW5lZCwgcGFyYW1ldGVycyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSwgW1xuICAgIGZ1bmN0aW9uIChmbikge1xuICAgICAgZm4uYXBwbHkodW5kZWZpbmVkLCBwYXJhbWV0ZXJzKTtcbiAgICB9XG4gIF0pO1xuICB3YXRlcmZhbGwodGFza3MsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICB2YXIgcGFyYW1ldGVycyA9IFtlcnJdLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoZXJyID09PSBFTkQpIHtcbiAgICAgIHBhcmFtZXRlcnNbMF0gPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGNhbGxiYWNrLmFwcGx5KHVuZGVmaW5lZCwgcGFyYW1ldGVycyk7XG4gIH0pO1xufVxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9IGxpbWl0ZXI7XG5cbi8qZ2xvYmFsIHNldFRpbWVvdXQsIGNsZWFyVGltZW91dCAqL1xuXG5mdW5jdGlvbiBsaW1pdGVyKGludGVydmFsLCBwZW5hbHR5SW50ZXJ2YWwpIHtcblxuICB2YXIgcXVldWUgPSBbXSxcbiAgICBsYXN0VHJpZ2dlciA9IDAsXG4gICAgcGVuYWx0eUNvdW50ZXIgPSAwLFxuICAgIHNraXBDb3VudGVyID0gMCxcbiAgICB0aW1lcjtcblxuICBmdW5jdGlvbiBub3coKSB7XG4gICAgcmV0dXJuIERhdGUubm93KCk7XG4gIH1cblxuICBmdW5jdGlvbiBzaW5jZSgpIHtcbiAgICByZXR1cm4gbm93KCkgLSBsYXN0VHJpZ2dlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGN1cnJlbnRJbnRlcnZhbCgpIHtcbiAgICByZXR1cm4gcGVuYWx0eUNvdW50ZXIgPiAwID8gcGVuYWx0eUludGVydmFsIDogaW50ZXJ2YWw7XG4gIH1cblxuICBmdW5jdGlvbiBydW5Ob3coZm4pIHtcbiAgICBwZW5hbHR5Q291bnRlciA9IDA7XG4gICAgZm4oKTtcbiAgICAvLyB3YWl0IHRvIHRoZSBuZXh0IGludGVydmFsIHVubGVzcyB0b2xkIHRvIHNraXBcbiAgICAvLyB0byB0aGUgbmV4dCBvcGVyYXRpb24gaW1tZWRpYXRlbHlcbiAgICBpZiAoc2tpcENvdW50ZXIgPiAwKSB7XG4gICAgICBza2lwQ291bnRlciA9IDA7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgbGFzdFRyaWdnZXIgPSBub3coKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXF1ZSgpIHtcbiAgICB0aW1lciA9IHVuZGVmaW5lZDtcbiAgICBpZiAoc2luY2UoKSA+PSBjdXJyZW50SW50ZXJ2YWwoKSkge1xuICAgICAgcnVuTm93KHF1ZXVlLnNoaWZ0KCkpO1xuICAgIH1cbiAgICBzY2hlZHVsZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2NoZWR1bGUoKSB7XG4gICAgdmFyIGRlbGF5O1xuICAgIGlmICghdGltZXIgJiYgcXVldWUubGVuZ3RoKSB7XG4gICAgICBkZWxheSA9IGN1cnJlbnRJbnRlcnZhbCgpIC0gc2luY2UoKTtcbiAgICAgIGlmIChkZWxheSA8IDApIHtcbiAgICAgICAgcmV0dXJuIGRlcXVlKCk7XG4gICAgICB9XG4gICAgICB0aW1lciA9IHNldFRpbWVvdXQoZGVxdWUsIGRlbGF5KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0cmlnZ2VyKGZuKSB7XG4gICAgaWYgKHNpbmNlKCkgPj0gY3VycmVudEludGVydmFsKCkgJiYgIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgcnVuTm93KGZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICBzY2hlZHVsZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBlbmFsdHkoKSB7XG4gICAgcGVuYWx0eUNvdW50ZXIgKz0gMTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNraXAoKSB7XG4gICAgc2tpcENvdW50ZXIgKz0gMTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNhbmNlbCgpIHtcbiAgICBpZiAodGltZXIpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgfVxuICAgIHF1ZXVlID0gW107XG4gIH1cblxuICBwZW5hbHR5SW50ZXJ2YWwgPSBwZW5hbHR5SW50ZXJ2YWwgfHwgNSAqIGludGVydmFsO1xuICByZXR1cm4ge1xuICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgcGVuYWx0eTogcGVuYWx0eSxcbiAgICBza2lwOiBza2lwLFxuICAgIGNhbmNlbDogY2FuY2VsXG4gIH07XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHRocm93cyB7RXJyb3J9IHRocm93IGFuIGVycm9yIGlmIHZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgbnVtYmVyXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsO1xuICBpZiAodHlwZSA9PT0gJ3N0cmluZycgJiYgdmFsLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gcGFyc2UodmFsKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiBpc05hTih2YWwpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBvcHRpb25zLmxvbmcgPyBmbXRMb25nKHZhbCkgOiBmbXRTaG9ydCh2YWwpO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICtcbiAgICAgIEpTT04uc3RyaW5naWZ5KHZhbClcbiAgKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSBTdHJpbmcoc3RyKTtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobWlsbGlzZWNvbmRzP3xtc2Vjcz98bXN8c2Vjb25kcz98c2Vjcz98c3xtaW51dGVzP3xtaW5zP3xtfGhvdXJzP3xocnM/fGh8ZGF5cz98ZHx5ZWFycz98eXJzP3x5KT8kL2kuZXhlYyhcbiAgICBzdHJcbiAgKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneXJzJzpcbiAgICBjYXNlICd5cic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaHJzJzpcbiAgICBjYXNlICdocic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtaW5zJzpcbiAgICBjYXNlICdtaW4nOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAnc2Vjcyc6XG4gICAgY2FzZSAnc2VjJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtaWxsaXNlY29uZHMnOlxuICAgIGNhc2UgJ21pbGxpc2Vjb25kJzpcbiAgICBjYXNlICdtc2Vjcyc6XG4gICAgY2FzZSAnbXNlYyc6XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBmbXRTaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIH1cbiAgaWYgKG1zID49IGgpIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICB9XG4gIGlmIChtcyA+PSBtKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgfVxuICBpZiAobXMgPj0gcykge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIH1cbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGZtdExvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpIHx8XG4gICAgcGx1cmFsKG1zLCBoLCAnaG91cicpIHx8XG4gICAgcGx1cmFsKG1zLCBtLCAnbWludXRlJykgfHxcbiAgICBwbHVyYWwobXMsIHMsICdzZWNvbmQnKSB8fFxuICAgIG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG1zIDwgbiAqIDEuNSkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICB9XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBydW5XYXRlcmZhbGxcblxuZnVuY3Rpb24gcnVuV2F0ZXJmYWxsICh0YXNrcywgY2IpIHtcbiAgdmFyIGN1cnJlbnQgPSAwXG4gIHZhciBpc1N5bmMgPSB0cnVlXG5cbiAgZnVuY3Rpb24gZG9uZSAoZXJyLCBhcmdzKSB7XG4gICAgZnVuY3Rpb24gZW5kICgpIHtcbiAgICAgIGFyZ3MgPSBhcmdzID8gW10uY29uY2F0KGVyciwgYXJncykgOiBbIGVyciBdXG4gICAgICBpZiAoY2IpIGNiLmFwcGx5KHVuZGVmaW5lZCwgYXJncylcbiAgICB9XG4gICAgaWYgKGlzU3luYykgcHJvY2Vzcy5uZXh0VGljayhlbmQpXG4gICAgZWxzZSBlbmQoKVxuICB9XG5cbiAgZnVuY3Rpb24gZWFjaCAoZXJyKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG4gICAgaWYgKCsrY3VycmVudCA+PSB0YXNrcy5sZW5ndGggfHwgZXJyKSB7XG4gICAgICBkb25lKGVyciwgYXJncylcbiAgICB9IGVsc2Uge1xuICAgICAgdGFza3NbY3VycmVudF0uYXBwbHkodW5kZWZpbmVkLCBbXS5jb25jYXQoYXJncywgZWFjaCkpXG4gICAgfVxuICB9XG5cbiAgaWYgKHRhc2tzLmxlbmd0aCkge1xuICAgIHRhc2tzWzBdKGVhY2gpXG4gIH0gZWxzZSB7XG4gICAgZG9uZShudWxsKVxuICB9XG5cbiAgaXNTeW5jID0gZmFsc2Vcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZ2VvcGxldGUnKTtcbiJdfQ==
