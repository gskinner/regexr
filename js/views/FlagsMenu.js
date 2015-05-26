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

var EventDispatcher = require('../events/EventDispatcher');

var FlagsMenu = function (element) {
	this.initialize(element);
};
var p = FlagsMenu.prototype = new EventDispatcher();

// ui:
p.element = null;

p.initialize = function (element) {
	this.element = element;
	this.buildUI(element);
};

p.buildUI = function (el) {
	var checks = $.els(".check", el);
	for (var i = 0; i < checks.length; i++) {
		checks[i].addEventListener("click", this);
	}
};

// public methods:
p.setFlags = function (flags) {
	var checks = $.els(".check", this.element);

	for (var i = 0; i < checks.length; i++) {
		var check = checks[i];
		var index = flags.indexOf(check.getAttribute("data-flag")); // or dataset.flag - Safari 7 & up only.
		if (index == -1) {
			$.removeClass(check, "checked");
		}
		else {
			$.addClass(check, "checked");
		}
	}
};

p.getFlags = function () {
	var flags = "";
	var checks = $.els(".check.checked", this.element);
	for (var i = 0; i < checks.length; i++) {
		flags += checks[i].getAttribute("data-flag");
	}
	return flags;
};

p.handleEvent = function (evt) {
	var check = evt.currentTarget;
	if ($.hasClass(check, "checked")) {
		$.removeClass(check, "checked");
	}
	else {
		$.addClass(check, "checked");
	}
	this.dispatchEvent("change");
};

module.exports = FlagsMenu;
