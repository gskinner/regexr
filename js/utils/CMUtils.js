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
var CMUtils = {};

CMUtils.getCharIndexAt = function (cm, winX, winY) {
	var pos = cm.coordsChar({left: winX, top: winY}, "page");
	// test current and prev character, since CM seems to use the center of each character for coordsChar:
	for (var i = 0; i <= 1; i++) {
		var rect = cm.charCoords(pos, "page");
		if (winX >= rect.left && winX <= rect.right && winY >= rect.top && winY <= rect.bottom) {
			return cm.indexFromPos(pos);
		}
		if (pos.ch-- <= 0) {
			break;
		}
	}
	return null;
};

CMUtils.getEOLPos = function (cm, pos) {
	if (!isNaN(pos)) {
		pos = cm.posFromIndex(pos);
	}
	var rect = cm.charCoords(pos, "local");
	var w = cm.getScrollInfo().width;
	return cm.coordsChar({left: w - 1, top: rect.top}, "local");
};

CMUtils.getCharRect = function (cm, index) {
	if (index == null) {
		return null;
	}
	var pos = cm.posFromIndex(index);
	var rect = cm.charCoords(pos);
	rect.x = rect.left;
	rect.y = rect.top;
	rect.width = rect.right - rect.left;
	rect.height = rect.bottom - rect.top;
	return rect;
};

CMUtils.enforceMaxLength = function (cm, change) {
	var maxLength = cm.getOption("maxLength");
	if (maxLength && change.update) {
		var str = change.text.join("\n");
		var delta = str.length - (cm.indexFromPos(change.to) - cm.indexFromPos(change.from));
		if (delta <= 0) {
			return true;
		}
		delta = cm.getValue().length + delta - maxLength;
		if (delta > 0) {
			str = str.substr(0, str.length - delta);
			change.update(change.from, change.to, str.split("\n"));
		}
	}
	return true;
};

CMUtils.enforceSingleLine = function (cm, change) {

	if (change.update) {
		var str = change.text.join("").replace(/(\n|\r)/g, "");
		change.update(change.from, change.to, [str]);
	}
	return true;
};

module.exports = CMUtils;
