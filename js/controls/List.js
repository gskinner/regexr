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
var Event = require('../events/Event');

var List = function (element, renderer, helpers) {
	this.initialize(element, renderer, helpers);
};
var p = List.prototype = new EventDispatcher();

List.defaultRenderer = "{{getLabel()}}";
List.defaultHelpers = {
	getLabel: function (data) {
		return !data ? "" : (data.label || data.data || data.toString());
	}
};

p.element = null;
p.data = null;
p.renderer = null;
p.helpers = null;
p.selectedIndex = -1;
p.selectedItem = null;
p.selectedElement = null;

p.focusProxy = null;
p.keyupProxy = null;
p.blurProxy = null;

p.initialize = function (element, renderer, helpers) {
	this.element = element;
	this.setRenderer(renderer, helpers);

	this.focusProxy = $.bind(this, this.handleFocus);
	this.blurProxy = $.bind(this, this.handleBlur);

	this.keyDownProxy = $.bind(this, this.handleKeyDown);

	this.element.addEventListener("focus", this.focusProxy);
	this.element.addEventListener("blur", this.blurProxy);
};

p.focus = function () {
	this.element.focus();
};

p.blur = function () {
	this.element.blur();
};

p.handleBlur = function (event) {
	window.removeEventListener("keydown", this.keyDownProxy);
	if (event) {
		this.dispatchEvent(event);
	}
};

p.handleFocus = function () {
	this.handleBlur();
	window.addEventListener("keydown", this.keyDownProxy);
};

p.handleKeyDown = function (evt) {
	var idx = -1;
	var dir = 0;

	switch (evt.which) {
		case 38: // up
			idx = Math.max(0, this.selectedIndex - 1);
			dir = 1;
			break;
		case 40: // down
			idx = Math.min(this.data.length - 1, this.selectedIndex + 1);
			dir = -1;
			break;
		case 13: // enter
			this.dispatchEvent(new Event("enter"));
			break;
	}

	if (idx > -1 && idx != this.selectedIndex || evt.which == 13) {
		evt.preventDefault();
		this.triggerChange(idx, dir);
	}
};

p.setRenderer = function (renderer, helpers) {
	this.renderer = renderer instanceof HTMLElement ? renderer.innerHTML : renderer;
	this.helpers = helpers;
	this.draw();
};

p.setData = function (data) {
	this.data = data;
	this.clear();
	this.draw();
};

p.clear = function () {
	this.clearItems();
	this.selectedIndex = -1;
	this.selectedItem = null;
};

p.setSelectedIndex = function (idx, dir) {
	if (!this.data) {
		return;
	}

	var el = this.element.childNodes[idx];

	if (!el) {
		return;
	}

	var div = $.el(".item.selected", this.element);
	if (div) {
		$.removeClass(div, "selected");
	}

	$.addClass(el, "selected");

	this.selectedIndex = idx;
	this.selectedItem = this.data[this.selectedIndex];
	this.selectedElement = el;

	var rowRect = el.getBoundingClientRect();
	var elRect = this.element.getBoundingClientRect();

	var parentOffsetTop = this.getOffsetTop(this.element);
	var rowOffsetTop = this.getOffsetTop(el);

	// Where the next scroll will take us.
	var scrollTopY = rowOffsetTop - parentOffsetTop;
	var scrollBottomY = (rowOffsetTop - parentOffsetTop) + rowRect.height - elRect.height;

	// Current visible bounds.
	var topY = this.element.scrollTop;
	var bottomY = topY + elRect.height;

	// Selected row position.
	var rowTopY = rowOffsetTop - parentOffsetTop;
	var rowBottomY = rowTopY + rowRect.height;

	// Selection is visible, so don't move it.
	if (rowTopY >= topY && rowBottomY <= bottomY) {
		return;
	}

	this.element.scrollTop = dir > 0 ? scrollTopY : scrollBottomY;
};

p.getOffsetTop = function (el) {
	var offset = 0;
	while (el) {
		offset += el.offsetTop;
		el = el.offsetParent;
	}
	return offset;
};

p.draw = function () {
	this.clearItems();
	var data = this.data, el = this.element;
	if (!data || !el) {
		return;
	}
	for (var i = 0, l = data.length; i < l; i++) {
		var item = this.getItem(data[i]);
		item.index = i;
		el.appendChild(item);
	}
};

p.clearItems = function () {
	var el = this.element;
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
};

p.getItem = function (data) {
	var item = document.createElement("div");
	item.className = "item";
	item.innerHTML = $.fillTags(this.renderer || List.defaultRenderer, data, this.helpers || List.defaultHelpers);
	item.addEventListener("click", this);
	return item;
};

p.getElementAt = function (idx) {
	return this.element.childNodes[idx];
};

p.getDataAt = function (idx) {
	return this.data[idx];
};

p.findIndexByValue = function (key, value) {
	for (var i = 0; i < this.data.length; i++) {
		if (this.data[i][key] == value) {
			return i;
		}
	}
	return -1;
};

p.handleEvent = function (evt) {
	this.triggerChange(evt.currentTarget.index);
};

p.triggerChange = function (index, dir) {
	var event = new Event("change");
	event.relatedIndex = this.selectedIndex;
	event.relatedItem = this.selectedItem;

	this.setSelectedIndex(index, dir);

	this.dispatchEvent(event);
};

module.exports = List;
