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
var TagsModel = require('../net/TagsModel');
var TextUtils = require('../utils/TextUtils');
var List = require('./List');

var TagInput = function (input, list, spinner) {
	this.init(input, list, spinner);
};
var p = TagInput.prototype;

EventDispatcher.initialize(p);

p.init = function (input, parent, spinner) {
	this.input = input;
	this.maxLength = input.getAttribute("maxlength") || 250;

	this.parent = parent;
	var listEL = $.el(".tag-list", parent);

	this.list = new List(
			listEL,
			$.el(".item.renderer", parent),
			this
	);

	this.hideList();

	if (spinner) {
		this.spinner = spinner;
		this.input.parentNode.appendChild(this.spinner);
	}

	input.addEventListener("keyup", $.bind(this, this.handleInputKeyup));
	input.addEventListener("keydown", $.bind(this, this.handleInputKeyDown));
	this.list.addEventListener("change", $.bind(this, this.handleListChange));
};

p.showLoading = function (value) {
	if (!this.spinner) {
		return;
	}

	if (value !== false) {
		$.removeClass(this.spinner, "hidden");
	} else {
		$.addClass(this.spinner, "hidden");
	}
};

p.getLabel = function (label) {
	return TextUtils.htmlSafe(label);
};

p.getTags = function () {
	return this.input.value.split(/(\s?)+,(\s?)+/);
};

p.setTags = function (value) {
	if (!value) {
		this.input.value = "";
		return;
	}

	if (!Array.isArray(value)) {
		value = value.split(",");
	}

	var cleanTags = [];
	for (var i = 0; i < value.length; i++) {
		var tag = value[i];
		if (tag != "") {
			cleanTags.push(tag);
		}
	}

	this.input.value = cleanTags.join(",").substr(0, this.maxLength);
};

p.handleKeyNavigation = function (key) {
	if (key == 40 && !this.isListVisible()) { // down
		this.populateTagList();
	} else if (key == 13 && this.isListVisible()) { // enter
		this.populateInput();
	} else {
		var dir = key == 38 ? -1 : 1; // up
		var currIdx = this.list.selectedIndex;

		this.list.setSelectedIndex(currIdx += dir);
	}
};

p.populateInput = function () {
	var selectedItem = this.list.selectedItem;
	if (selectedItem) {
		this.insertTag(selectedItem);
	}
	this.hideList();

	this.input.focus();

	this.dispatchEvent("close");
};

p.handleInputKeyDown = function (event) {
	// The caret by default will jump to the end or beginning of the text, stop that.
	switch (event.which) {
		case 38:
		case 40:
			event.preventDefault();
			break;
	}
};

p.handleInputKeyup = function (event) {
	switch (event.which) {
		case 13: // enter
		case 38: // up
		case 40: // down
			event.preventDefault();
			this.handleKeyNavigation(event.which);
			break;
		case 27: // Escape
			this.hideList();
			break;
		default:
			this.populateTagList();
	}
};

p.isListVisible = function () {
	return !$.hasClass(this.parent, "hidden");
};

p.hideList = function () {
	$.addClass(this.parent, "hidden");
};

p.showList = function () {
	$.removeClass(this.parent, "hidden");
};

p.populateTagList = function () {
	$.defer(this, this.searchTags, "search", 300);
};

p.searchTags = function () {
	var value = this.input.value;
	var index = this.input.selectionStart;
	var tag = this.getTag(index, value);
	var existingTags = this.getTags();

	TagsModel.search(tag, existingTags).then($.bind(this, this.handleTagsLoad));
};

p.handleTagsLoad = function (data) {
	if (window.document.activeElement != this.input) {
		return;
	}

	this.list.setData(data);

	if (data.length == 0) {
		this.hideList();
	} else {
		this.showList();
	}
};

p.insertTag = function (tag) {
	var value = this.input.value;
	var index = this.input.selectionStart;

	var array = value.split(",");
	var item = null;
	var currentLength = 0;

	for (var i = 0; i < array.length; i++) {
		var v = array[i];
		currentLength += v.length;
		if (index <= (currentLength + i)) {
			array[i] = tag;
			break;
		}
	}

	var newValue = array.join(",");
	if (newValue.charAt(newValue.length - 1) != ",") {
		newValue += ",";
	}
	this.input.value = newValue.substr(0, this.maxLength);
};

p.handleListChange = function (evt) {
	this.populateInput();
};

p.getTag = function (index, value) {
	if (index == value.length) {
		index--;
	}

	var array = value.split(",");
	var item = null;
	var currentLength = 0;

	for (var i = 0; i < array.length; i++) {
		var v = array[i];
		currentLength += v.length;
		if (index <= (currentLength + i)) {
			item = v;
			break;
		}
	}

	return item;
};

module.exports = TagInput;

