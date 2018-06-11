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
import app from "../app";

export default class Status {
	constructor(el) {
		if (!el) { el = document.createElement("div"); }
		this.el = el;
		$.addClass(el, "status");

		el.addEventListener("mouseover", () => this._showTooltip());
		el.addEventListener("mouseout", () => this._hideTooltip());
	}

	distract() {
		this.el.innerHTML = '<svg class="icon distractor anim-spin"><use xlink:href="#distractor"></use></svg>';
		this._show();
		return this;
	}

	hide(t=0) {
		this._clearTimeout();
		if (t) {
			this._timeoutId = setTimeout(()=>this._hide(), t*1000);
		} else { this._hide(); }
		return this;
	}

	success() {
		this.el.innerHTML = '<svg class="icon success"><use xlink:href="#check"></use></svg>';
		this._show();
		return this;
	}

	error(msg) {
		let el = this.el;
		el.innerHTML = '<svg class="icon alert"><use xlink:href="#alert"></use></svg>';
		this._show();
		this._ttMsg = msg;
		return this;
	}

	_showTooltip() {
		if (!this._ttMsg) { return; }
		app.tooltip.hover.showOn("status", this._ttMsg, this.el, true, 0);
	}

	_hideTooltip() {
		app.tooltip.hover.hide("status");
	}

	_show() {
		this.el.style.display = null;
		this._ttMsg = null;
		this._hideTooltip();
		this._clearTimeout();
	}

	_hide() {
		this.el.style.display = "none";
		this._hideTooltip();
		this._clearTimeout();
	}

	_clearTimeout() {
		if (this._timeoutId == null) { return; }
		clearTimeout(this._timeoutId);
		this._timeoutId = null;
	}
}