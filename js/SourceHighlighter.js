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
(function() {
	"use strict";

	var SourceHighlighter = function(cm, canvas, fill) {
		this.initialize(cm, canvas, fill);
	};
	var p = SourceHighlighter.prototype;

	p.cm = null;
	p.canvas = null;
	p.fill =  "#6CF";

	p.initialize = function(cm, canvas, fill) {
		this.cm = cm;
		this.canvas = canvas;
		this.fill = fill||this.fill;
	};

	p.draw = function(matches, activeMatch) {
		this.clear();
		if (this.error || !matches.length) { return; }

		var cm = this.cm;
		var doc = cm.getDoc();
		var ctx = this.canvas.getContext("2d");
		ctx.fillStyle = this.fill;

		// find the range of the visible text:
		var scroll = cm.getScrollInfo();
		var top = cm.indexFromPos(cm.coordsChar({left:0, top:scroll.top}, "local"));
		var bottom = cm.indexFromPos(cm.coordsChar({left:scroll.clientWidth, top:scroll.top+scroll.clientHeight}, "local"));

		for (var i=0,l=matches.length; i<l; i++) {
			var match = matches[i];
			var active = (match == activeMatch);
			var start = match.index;
			var end = match.end;
			if (start > bottom) { break; } // all done.
			if (end < top) { continue; } // not visible, so don't mark.
			var startPos = match.startPos || (match.startPos = doc.posFromIndex(start));
			var endPos = match.endPos || (match.endPos = doc.posFromIndex(end));

			if (active) { ctx.globalAlpha = 0.6; }
			var startRect = cm.charCoords(startPos, "local");
			var endRect = cm.charCoords(endPos, "local");
			if (startRect.bottom == endRect.bottom) {
				this.drawHighlight(ctx, startRect.left, startRect.top, endRect.right, endRect.bottom, scroll.top);
			} else {
				var lw = cm.getScrollInfo().width;
				var lh = cm.defaultTextHeight();
				// render first line:
				this.drawHighlight(ctx, startRect.left, startRect.top, lw-2, startRect.bottom, scroll.top, false, true); // startRect.top+lh
				// render lines in between:
				var y = startRect.top;
				while ((y+=lh) < endRect.top-1) { // the -1 is due to fractional issues on FF
					this.drawHighlight(ctx, 0, y, lw-2, y+startRect.bottom-startRect.top, scroll.top, true, true); // lh
				}
				// render last line:
				this.drawHighlight(ctx, 0, endRect.top, endRect.right, endRect.bottom, scroll.top, true);
				// CMUtils.getEOLPos(this.sourceCM, startPos);
			}
			if (active) { ctx.globalAlpha = 1; }
		}
	};

	p.drawHighlight = function(ctx, left, top, right, bottom, scrollY, startCap, endCap) {
		var capW = 4;
		var a = ctx.globalAlpha;
		if (startCap) {
			ctx.globalAlpha = a*0.5;
			ctx.fillRect(left+1|0, top-scrollY, capW+1, bottom-top);
			left += capW;
		}
		if (endCap) {
			ctx.globalAlpha = a*0.5;
			ctx.fillRect(right-capW-1|0, top-scrollY, capW+1, bottom-top);
			right -= capW;
		}
		ctx.globalAlpha = a;
		ctx.fillRect(left+1, top-scrollY, right-left-1, bottom-top); // flooring these values with |0 looks great on Chrome, but not other browsers.
	};

	p.clear = function() {
		this.canvas.width = this.canvas.width;
	};

	window.SourceHighlighter = SourceHighlighter;
})();
