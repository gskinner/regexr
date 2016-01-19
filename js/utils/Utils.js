/*
 The MIT License (MIT)

 Copyright (c) 2014 gskinner.com, inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */

var TransitionEvents = require('../events/TransitionEvents');

var Utils = {};

Utils.timeoutIDs = {};

Utils.el = function (query, element) {
	return (element || document.body).querySelector(query);
};

Utils.els = function (query, element) {
	return (element || document.body).querySelectorAll(query);
};

Utils.removeClass = function (element, className) {
	if (className instanceof RegExp) {
		var arr = element.className.split(" "), re=className;
		element.className = arr.filter(function(s) { return !re.test(s); }).join(" ");
	} else {
		var list = element.classList;
		list.remove.apply(list, className.split(" "));
	}
	return element;
};

Utils.addClass = function (element, className) {
	Utils.removeClass(element, className);

	var names = className.split(" ");
	for (var i = 0; i < names.length; i++) {
		element.classList.add(names[i]);
	}

	return element;
};

Utils.swapClass = function (element, oldClass, newClass) {
	Utils.removeClass(element, oldClass);
	Utils.addClass(element, newClass);
};

Utils.remove = function (el) {
	if (el.remove) {
		el.remove();
	} else {
		el.parentNode.removeChild(el);
	}
};

Utils.animate = function (element, defaultClass, transitionClass) {
	return new Promise(function (resolve, reject) {
		Utils.addClass(element, defaultClass);
		// Always delay 1 tick, so the transition gets applied.
		setTimeout(function () {
			var events = new TransitionEvents(element);
			events.on(TransitionEvents.TRANSISTION_END, function (event) {
				events.removeAllEventListeners(TransitionEvents.TRANSISTION_END);

				// Transition events bubble, so only resolve when its the transition we initiated.
				if (event.target.el.classList.contains(transitionClass)) {
					resolve(element);
				}
			});
			Utils.addClass(element, transitionClass);
		}, 1)
	});
};

Utils.addCopyListener = function (el, callback) {
	var ctrlIsDown = false;

	var keyDownHandler = function (event) {
		if (event.which == 91 || event.metaKey || event.keyName == "Meta") {
			ctrlIsDown = true;
		}
		if (event.which == 67 && ctrlIsDown) {
			el.removeEventListener("keydown", keyDownHandler);
			callback();
		}
	};

	var keyUpHandler = function (event) {
		if (event.which == 91 || event.metaKey || event.keyName == "Meta") {
			el.removeEventListener("keydown", keyDownHandler);
			el.removeEventListener("keyup", keyUpHandler);

			$.addCopyListener(el, callback);
		}
	};

	el.addEventListener("keydown", keyDownHandler);
	el.addEventListener("keyup", keyUpHandler);
};

Utils.hasClass = function (element, className) {
	var regex = new RegExp("\\b\\s?" + className + "\\b", "g");
	return !!element.className.match(regex);
};

Utils.fillTags = function (str, data, functs) {
	var match, val, f;
	while (match = str.match(/{{[\w.()]+}}/)) {
		val = match[0].substring(2, match[0].length - 2);
		var match2 = val.match(/\([\w.]*\)/);
		if (match2) {
			f = val.substr(0, match2.index);
			val = match2[0].substring(1, match2[0].length - 1);
		} else {
			f = null;
		}
		var o = data;
		var arr = val.split(".");
		for (var i = 0; i < arr.length; i++) {
			var prop = arr[i];
			if (prop) {
				o = o[prop];
			}
		}
		val = o;
		if (f) {
			val = functs[f](val);
		}
		str = str.replace(match[0], val);
	}
	return str;
};

Utils.bind = function (o, f) {
	return function () {
		return f.apply(o, Array.prototype.slice.call(arguments));
	}
};

Utils.deferF = function (o, f, id, t) {
	t = isNaN(t) || t == null ? 1 : t;
	var ids = Utils.timeoutIDs;
	return function () {
		clearTimeout(ids[id]);
		ids[id] = setTimeout(Utils.bind(o, f), t);
	}
};

Utils.clearDefer = function (id) {
	var ids = Utils.timeoutIDs;
	clearTimeout(ids[id]);
	delete(ids[id]);
};

Utils.defer = function (o, f, id, t) {
	Utils.deferF(o, f, id, t)();
};

Utils.populateSelector = function (selector, items) {
	var options = [];

	for (var i = 0; i < items.length; i++) {
		var data = items[i];

		var label = data.label || data;
		var value = data.value || data;

		if (data.selected) {
			options.push("<option selected id='" + value + "'>" + label + "</option>");
		} else {
			options.push("<option id='" + value + "'>" + label + "</option>");
		}
	}

	selector.innerHTML = options.join('');
};

Utils.isSupported = function () {
	// This should catch all the not supported browsers.
	return $.isCanvasSupported() && $.isCalcSupported();
};

Utils.partialSupport = function () {
	// If we're not all supported just say no.
	if (!Utils.isSupported()) {
		return false;
	}

	// iOS and Android both kind of work.
	if ($.iosType() != null || $.isAndroid()) {
		return true;
	}

	// Should never actually get here.
	return false;
}

Utils.isCalcSupported = function () {
	return this.checkCalc("-webkit-") || this.checkCalc("-moz-") || this.checkCalc();
};

Utils.isCanvasSupported = function () {
	var elem = document.createElement("canvas");
	return !!(elem.getContext && elem.getContext("2d"));
};

Utils.isIE = function () {
	var result = /MSIE/ig.test(navigator.userAgent);
	return result;
};

Utils.isFirefox = function () {
	var result = /Firefox/ig.test(navigator.userAgent);
	return result;
};

Utils.isAndroid = function () {
	var result = /android/ig.test(navigator.userAgent);
	return result;
};

Utils.iosType = function () {
	var type = null;
	var nav = window.navigator;
	var isIDevice = "platform" in nav;
	if (isIDevice) {
		type = nav.platform.match(/iphone|ipod|ipad/gi);
		if (type && type[0]) {
			type = type[0].toLowerCase();
		}
	}
	return type;
};

Utils.iosVersion = function () {
	var nav = window.navigator;
	var iosVersion = /(?:iPhone\sOS\s)([0-9_]+)/g.exec(nav.appVersion);
	if (iosVersion && iosVersion[1]) {
		iosVersion = Number(iosVersion[1].replace('_', '.'));
	} else {
		iosVersion = null;
	}
	return iosVersion;
};

Utils.checkCalc = function (prefix) {
	prefix = prefix || "";
	var el = document.createElement("div");
	el.style.cssText = "width: " + prefix + "calc(1px);";
	return !!el.style.length;
};

Utils.parsePattern = function (ex) {
	var match = ex.match(/\/(.+)(?:\/)([igm]+)?$/);

	if (match) {
		return {ex: match[1], flags: match[2] || ""}
	} else {
		return {ex: ex, flags: ""}
	}
};

Utils.createID = function (id) {
	if (id < 0) {
		return null;
	}
	return ((Number(id) + 1000000) * 3).toString(32);
};

Utils.idToNumber = function (id) {
	return parseInt(id, 32) / 3 - 1000000;
}

Utils.isIDValid = function (id) {
	var val = Utils.idToNumber(id);
	return val % 1 === 0;
};

Utils.createURL = function (id) {
	return "http://regexr.com/" + id;
};

Utils.isMac = function () {
	return !!(navigator.userAgent.match(/Mac\sOS/i))
};

Utils.getCtrlKey = function () {
	return Utils.isMac() ? "Cmd" : "Ctrl";
};

/*
 Remove all children from a element.
 When using .innerHTML = ""; IE fails when adding new dom elements via appendChild();
 */
Utils.empty = function (el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
	return el;
};

Utils.html = function (value, parent) {
	var dom = document.createElement("div");
	dom.innerHTML = value;
	return parent !== true ? dom.firstChild : dom;
};

Utils.htmlDecode = function(value) {
	var el = Utils.html(value);
	return el.nodeValue;
};

Utils.div = function(content, className) {
	var div = document.createElement("div");
	if (content) { div.innerHTML = content; }
	if (className) { div.className = className; }
	return div;
};

/**
 * Implementation of Java’s String.hashCode() method
 * Original Source: http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 *
 * @param s
 * @returns {number}
 */
Utils.getHashCode = function(s) {
	var hash = 0, l = s.length, i;
	for (i = 0; i < l; i++ ) {
		hash = ((hash << 5) - hash) + s.charCodeAt(i) | 0;
	}
	return hash;
};

module.exports = Utils;
