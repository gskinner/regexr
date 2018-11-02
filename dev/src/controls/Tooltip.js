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

import $ from "../utils/DOMUtils";

export default class Tooltip {
	
	constructor(el, transition=false) {
		this.el = $.remove(el);
		this.transition = transition;
		this.contentEl = $.query(".content", el);
		this.tipEl = $.query(".tip", el);
		this.hideF = (evt)=> Date.now()>this._showT && this.handleBodyClick(evt);
		this.curId = null;
	}
	
	toggle(id, content, x, y, autohide, th) {
		if (id === this.curId) { return this.hide(id); }
		this.show(id, content, x, y, autohide, th);
	}
	
	toggleOn(id, content, el, autohide, th) {
		if (id === this.curId) { return this.hide(id); }
		this.showOn(id, content, el, autohide, th);
		this.toggleEl = el;
		$.addClass(el, "selected");
	}
	
	hide(id) {
		if (id && this.curId !== id) { return; }
		let el = this.el, elStyle = el.style;
		$.empty($.query(".content", $.remove(el)));
		$.removeClass(el, "flipped");
		document.body.removeEventListener("mousedown", this.hideF);
		
		if (this.toggleEl) {
			$.removeClass(this.toggleEl, "selected");
			this.toggleEl = null;
		}
		
		// reset position and width so that content wrapping resolves properly:
		elStyle.left = elStyle.top = "0";
		elStyle.width = "";
		if (this.transition) {
			elStyle.opacity = 0;
			elStyle.marginTop = "-0.25em";
		}
		this.curId = null;
	}

	show(id, content, x, y, autohide = false, th = 0) {
		this.hide();
		if (!content) { return; }

		let el = this.el, elStyle = el.style, contentEl = this.contentEl, body = document.body, pad = 8;
		if (content instanceof HTMLElement) { contentEl.appendChild(content); }
		else { contentEl.innerHTML = content; }

		if (autohide) {
			this._showT = Date.now()+30; // ignore double clicks and events in the current stack.
			body.addEventListener("mousedown", this.hideF);
		}

		body.appendChild(el);

		let wh = window.innerHeight, ww = window.innerWidth;
		let rect = el.getBoundingClientRect(), w = rect.right - rect.left, h = rect.bottom - rect.top, off = 0;
		if (y + h > wh - pad) {
			$.addClass(el, "flipped");
			y -= th;
		}
		if (x - w / 2 < pad) { off = pad - x + w / 2; }
		else if (x + w / 2 > ww - pad) { off = ww - pad - x - w / 2; }
		this.tipEl.style.marginRight = Math.max(-w / 2 + 10, Math.min(w / 2 - 10, off)) * 2 + "px";
		elStyle.width = Math.ceil(w/2)*2 + "px";
		elStyle.top = Math.round(y) + "px";
		elStyle.left = Math.round(x + off) + "px";
		if (this.transition) {
			elStyle.opacity = 1;
			elStyle.marginTop = 0;
		}
		
		this.curId = id;
	}
	
	showOn(id, content, el, autohide, th=0) {
		let rect = el.getBoundingClientRect();
		let x = Math.round((rect.left+rect.right)/2);
		let y = rect.bottom+th;
		let h = rect.bottom-rect.top;
		this.show(id, content, x, y, autohide, h);
	}

	handleBodyClick(evt) {
		let id = this.curId;
		if (this.el.contains(evt.target) || (this.toggleEl && this.toggleEl.contains(evt.target))) { return; }
		this.hide(id);
	}
}