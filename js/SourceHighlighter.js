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

var SourceHighlighter = function (cm, canvas, fill) {
	this.initialize(cm, canvas, fill);
};
var p = SourceHighlighter.prototype;

p.cm = null;
p.canvas = null;
p.fill = "#6CF";
p.lineSpacing = 2;
p.lastBottom = -1;
p.lastRight = -1;

p.initialize = function (cm, canvas, fill) {
	this.cm = cm;
	this.canvas = canvas;
	this.fill = fill || this.fill;
};

p.draw = function (matches, activeMatch, selectedMatch) {
	this.clear();
	if (!matches || !matches.length) {
		return;
	}


	var cm = this.cm;
	var doc = cm.getDoc();
	var ctx = this.canvas.getContext("2d");
	ctx.fillStyle = this.fill;

	// find the range of the visible text:
	var scroll = cm.getScrollInfo();
	var top = cm.indexFromPos(cm.coordsChar({
		left: scroll.left,
		top: scroll.top
	}, "local"));
	var bottom = cm.indexFromPos(cm.coordsChar({
		left: scroll.left + scroll.clientWidth,
		top: scroll.top + scroll.clientHeight
	}, "local"));

	for (var i = 0, l = matches.length; i < l; i++) {
		var match = matches[i];
		var start = match.index;
		var end = match.end;
		if (start > bottom) {
			break;
		} // all done.
		if (end < top) {
			continue;
		} // not visible, so don't mark.
		var startPos = match.startPos || (match.startPos = doc.posFromIndex(start));
		var endPos = match.endPos || (match.endPos = doc.posFromIndex(end));
		var active = (match === activeMatch);
		var selected = (match === selectedMatch);

		if (active || selected) { ctx.globalAlpha = 0.45; }

		var startRect = cm.charCoords(startPos, "local");
		var endRect = cm.charCoords(endPos, "local");

		if (startRect.bottom == endRect.bottom) {
			this.drawHighlight(ctx, startRect.left, startRect.top, endRect.right, endRect.bottom, scroll.left, scroll.top);
		} else {
			var lw = cm.getScrollInfo().width;
			var lh = cm.defaultTextHeight();
			// render first line:
			this.drawHighlight(ctx, startRect.left, startRect.top, lw - 2, startRect.bottom, scroll.left, scroll.top, false, true); // startRect.top+lh
			// render lines in between:
			var y = startRect.top;
			while ((y += lh) < endRect.top - 1) { // the -1 is due to fractional issues on FF
				this.drawHighlight(ctx, 0, y, lw - 2, y + startRect.bottom - startRect.top, scroll.left, scroll.top, true, true); // lh
			}
			// render last line:
			this.drawHighlight(ctx, 0, endRect.top, endRect.right, endRect.bottom, scroll.left, scroll.top, true);
			// CMUtils.getEOLPos(this.sourceCM, startPos);
		}

		if (active || selected) { ctx.globalAlpha = 1; }
	}
};

p.drawHighlight = function (ctx, left, top, right, bottom, scrollX, scrollY, startCap, endCap) {
	var capW = 4;

	if (right < 0 || left + 1 >= right) {
		return;
	} // weird bug in CodeMirror occasionally returns negative values
	left = left + 0.5 | 0;
	right = right + 0.5 | 0;
	top = (top + 0.5 | 0) + this.lineSpacing;
	bottom = bottom + 0.5 | 0;

	if (top + 1 > this.lastBottom) {
		this.lastBottom = bottom;
	}
	else if (left < this.lastRight) {
		left = this.lastRight;
	}
	this.lastRight = right;

	var a = ctx.globalAlpha;
	if (startCap) {
		ctx.globalAlpha = a * 0.5;
		ctx.fillRect((left + 1 || 0) - scrollX, top - scrollY, capW + 1, bottom - top);
		left += capW;
	}
	if (endCap) {
		ctx.globalAlpha = a * 0.5;
		ctx.fillRect((right - capW - 1 || 0) - scrollY, top - scrollY, capW + 1, bottom - top);
		right -= capW;
	}
	ctx.globalAlpha = a;
	ctx.fillRect(left + 1 - scrollX, top - scrollY, right - left - 1, bottom - top);
};

p.clear = function () {
	this.canvas.width = this.canvas.width;
	this.lastBottom = -1;
};

module.exports = SourceHighlighter;
