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

import app from "../app";

export default class ExpressionHover {
	constructor (editor, highlighter) {
		this.editor = editor;
		this.highlighter = highlighter;
		this.isMouseDown = false;
		this.token = null;
		
		let o = editor.display.lineDiv;
		o.addEventListener("mousemove", (evt)=> this._handleMouseMove(evt));
		o.addEventListener("mouseout", (evt)=> this._handleMouseOut(evt));
		o.addEventListener("mousedown", (evt)=> this._handleMouseDown(evt));
		
	}

	
// private methods:
	_handleMouseMove(evt) {
		if (this.isMouseDown) { return; }
		
		let index, editor = this.editor, token = this.token, target = null;
		
		if (evt && token && (index = CMUtils.getCharIndexAt(editor, evt.clientX, evt.clientY + window.pageYOffset)) != null) {
			while (token) {
				if (index >= token.i && index < token.i+token.l) {
					target = token;
					break;
				}
				token = token.next;
			}
		}
		
		while (target) {
			if (target.open) { target = target.open; }
			else if (target.proxy) { target = target.proxy; }
			else { break; }
		}
	
		this.highlighter.hoverToken = target;
		let rect = (index != null) && CMUtils.getCharRect(editor, index);
		if (rect) { rect.right = rect.left = evt.clientX; }
		app.tooltip.hover.show("ExpressionHover", app.reference.tipForToken(target), evt.clientX, rect.bottom, true, 0);
	}
	
	_handleMouseOut(evt) {
		this.highlighter.hoverToken = null;
		app.tooltip.hover.hide("ExpressionHover");
	}
	
	_handleMouseDown(evt) {
		// TODO: Should this also be in TextHover?
		if (evt.which !== 1 && evt.button !== 1) { return; }
		
		this.isMouseDown = true;
		let f, t = window.addEventListener ? window : document;
		t.addEventListener("mouseup", f = () => {
			t.removeEventListener("mouseup", f);
			this.isMouseDown = false;
		});
	}
}