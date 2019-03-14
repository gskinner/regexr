/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import Utils from "../utils/Utils";

export default class TextHighlighter {
	constructor(editor, canvas, fill = "#6CF", stroke="#888") {
		this.lineSpacing = 2;
		this.capWidth = 4;
		this.lastBottom = -1;
		this.lastRight = -1;
		this.editor = editor;
		this.canvas = canvas;
		this.fill = fill;
		this.stroke = stroke;
	}
	
	set matches(val) {
		this._matches = val;
		this._deferUpdate();
	}
	
	set hoverMatch(val) {
		this._hoverMatch = val;
		this._deferUpdate();
	}
	
	set selectedMatch(val) {
		this._selectedMatch = val;
		this._deferUpdate();
	}

	redraw() {
		this._update();
	}
	
	_deferUpdate() {
		Utils.defer(()=>this._update(), "TextHighlighter._update");
	}
	
	_update() {
		this.clear();
		let matches = this._matches, hoverMatch = this._hoverMatch, selectedMatch = this._selectedMatch;
		if (!matches || !matches.length) { return; }
		
	
		let cm = this.editor, doc = cm.getDoc()
		let ctx = this.canvas.getContext("2d");
		ctx.fillStyle = this.fill;
		ctx.strokeStyle = this.stroke;
		ctx.lineWidth = 2;
	
		// find the range of the visible text:
		let scroll = cm.getScrollInfo();
		let top = cm.indexFromPos(cm.coordsChar({
			left: 0,
			top: scroll.top
		}, "local"));
		let bottom = cm.indexFromPos(cm.coordsChar({
			left: scroll.clientWidth,
			top: scroll.top + scroll.clientHeight
		}, "local"));
	
		for (let i = 0, l = matches.length; i < l; i++) {
			let match = matches[i], start = match.i, end = match.i+match.l-1;
			
			if (start > bottom) { break; } // all done.
			if (end < top || end < start) { continue; } // not visible, so don't mark.
			let startPos = match.startPos || (match.startPos = doc.posFromIndex(start));
			let endPos = match.endPos || (match.endPos = doc.posFromIndex(end));
			let emphasis = match === hoverMatch || match === selectedMatch;
	
			let startRect = cm.charCoords(startPos, "local"), endRect = cm.charCoords(endPos, "local");
	
			if (startRect.bottom === endRect.bottom) {
				this.drawHighlight(ctx, startRect.left, startRect.top, endRect.right, endRect.bottom, scroll.top, false, false, emphasis);
			} else {
				let lw = cm.getScrollInfo().width, lh = cm.defaultTextHeight();
				// render first line:
				this.drawHighlight(ctx, startRect.left, startRect.top, lw - 2, startRect.bottom, scroll.top, false, true, emphasis); // startRect.top+lh
				// render lines in between:
				let y = startRect.top;
				while ((y += lh) < endRect.top - 1) { // the -1 is due to fractional issues on FF
					this.drawHighlight(ctx, 0, y, lw - 2, y + startRect.bottom - startRect.top, scroll.top, true, true, emphasis); // lh
				}
				// render last line:
				this.drawHighlight(ctx, 0, endRect.top, endRect.right, endRect.bottom, scroll.top, true, false, emphasis);
				// CMUtils.getEOLPos(this.sourceCM, startPos);
			}
		}
	}
	
	drawHighlight(ctx, left, top, right, bottom, scrollY, startCap, endCap, emphasis) {
		let capW = this.capWidth;
	
		if (right < 0 || left + 1 >= right) { return; } // weird bug in CodeMirror occasionally returns negative values
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
		
		let a = ctx.globalAlpha;
		if (startCap) {
			ctx.globalAlpha = a * 0.5;
			ctx.fillRect(left + 1 | 0, top - scrollY, capW + 1, bottom - top);
			left += capW;
		}
		if (endCap) {
			ctx.globalAlpha = a * 0.5;
			ctx.fillRect(right - capW - 1 | 0, top - scrollY, capW + 1, bottom - top);
			right -= capW;
		}
		ctx.globalAlpha = a;
		ctx.fillRect(left + 1, top - scrollY, right - left - 1, bottom - top);

		if (emphasis) {
			ctx.strokeRect(left + 1, top - scrollY, right - left - 1, bottom - top);
		}
	}
	
	clear() {
		this.canvas.width = this.canvas.width;
		this.lastBottom = -1;
	}
}
