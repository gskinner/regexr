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
var ServerModel = require('./ServerModel');
var Settings = require('../Settings');

var s = {};
EventDispatcher.initialize(s);

s.docView = null;
s.id = null;
s._lastSave = null;
s._lastSaveTags = null;
s._saveState = null;

s.savePattern = function (tags, name, pattern, content, replace, description, author, isPublic, id, token, state) {
	s._lastSaveTags = tags;
	return ServerModel.savePattern(tags, name, pattern, content, replace, description, author, isPublic, id, token, state).then(
			$.bind(s, s.handleSaveSuccess),
			$.bind(s, s.handleSaveFail)
	);
};

s.saveState = function () {
	s._saveState = s.docView.getStateHash();
	s._lastId = null;
};

s.isDirty = function () {
	var dirty = s._saveState !== s.docView.getStateHash();
	if (dirty && s.id) {
		s._lastId = s.id;
		s.id = null;
	} else if (!dirty && s._lastId) {
		s.id = s._lastId;
	}

	return dirty;
};

s.handleSaveSuccess = function (result) {
	s.saveState();

	var pattern = result.results[0];
	var id = pattern.id;

	if (result.token) {
		Settings.setUpdateToken(id, result.token);
	}

	s.id = id;
	s._lastSave = pattern;
	s.dispatchEvent("change");

	return result;
};

s.handleSaveFail = function (result) {
	throw result;
};

s.setLastSave = function (value) {
	if (s.id == value.id) {
		return;
	}

	s.id = value.id;
	if (Settings.getUpdateToken(s.id)) {
		s._lastSave = value;
	}
	s.dispatchEvent("change");
};

s.getLastSave = function () {
	if (s._lastSave && !s._lastSave.tags) {
		s._lastSave.tags = s._lastSaveTags;
	}
	return s._lastSave;
};

s.setID = function (value) {
	if (s.id == value) {
		return;
	}

	s.id = value;
	s.dispatchEvent("change");
}

module.exports = s;
