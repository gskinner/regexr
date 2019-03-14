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

import CMUtils from "../utils/CMUtils";
import $ from "../utils/DOMUtils";

import app from "../app";

export default class TextHover {
	constructor (editor, highlighter) {
		this.editor = editor;
		this.highlighter = highlighter;
		this._matches = this._x = null;
		
		let o = editor.display.lineDiv;
		o.addEventListener("mousemove", (evt)=> this._handleMouseMove(evt));
		o.addEventListener("mouseout", (evt)=> this._handleMouseOut(evt));
	}

	set matches(val) {
		this._matches = val;
		this._update();
	}

// private methods:
	_handleMouseMove(evt) {
		this._x = evt.clientX;
		this._y = evt.clientY + window.pageYOffset;
		this._update();
	}
	
	_handleMouseOut(evt) {
		this._x = null;
		this._update();
	}

	_update() {
		if (this._x === null) {
			this.highlighter.hoverMatch = null;
			app.tooltip.hover.hide("TextHover");
			return;
		}
		let index, cm = this.editor, match, matches = this._matches, x = this._x, y = this._y;
		
		if (matches && matches.length && (index = CMUtils.getCharIndexAt(cm, x, y)) != null) {
			match = this.highlighter.hoverMatch = app.text.getMatchAt(index);
		}
		let rect = (index != null) && CMUtils.getCharRect(cm, index);
		if (rect) { rect.right = rect.left = x; }
		let tip = app.reference.tipForMatch(match, cm.getValue());
		if (tip) {
			let div = $.create("div", "texthover", tip);
			app.tooltip.hover.show("TextHover", div, x, rect.bottom, true, 0);
		}
		
	}
}