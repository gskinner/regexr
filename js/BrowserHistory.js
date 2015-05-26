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

var s = {};

var EventDispatcher = require('./events/EventDispatcher');

EventDispatcher.initialize(s);
// public properties:

// private properties:
s._currentPath = null;
s._currentLocation = null;

// public methods:
s.go = function (url) {
	if (s._currentPath === url) {
		return;
	}
	s._currentPath = url;

	if (window.history.pushState) {
		History.pushState(null, null, url || "/");
	} else {
		window.location.hash = url || "";
	}

	s._currentLocation = document.location.toString();
};

s.init = function () {
	History.init();

	// Use history.js for modern browsers
	if (window.history.pushState) {
		History.Adapter.bind(window, 'statechange', $.bind(s, s.handleHistoryChange));
	} else {
		// Custom support for #tags (for ie9)
		window.addEventListener("hashchange", $.bind(s, s.handleHashChange));
	}
};

s.handleHistoryChange = function (evt) {
	s.dispatchEvent("change");
};

s.handleHashChange = function (evt) {
	var path = document.location.hash.substr(1);
	if (s._currentPath === path) {
		return;
	}
	s._currentPath = path;

	s.dispatchEvent("change");
};

// private methods:
module.exports = s;
