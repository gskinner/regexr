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
import Utils from "../utils/Utils";
import app from "../app";

export default class LinkRow {
	constructor(el) {
		this.el = el;
		this._initUI();
		this.url = null;
	}
	
	set pattern(val) {
		let url = Utils.getPatternURLStr(val)
		this._pattern = val;
		$.query(".url", this.el).innerText = url || "";
		$.toggleClass(this.el, "disabled", !url);
		$.toggleClass(this.el, "active", !!url);
	}

	showMessage(message) {
		// for some reason this displays one line too low if it's synchronous:
		setTimeout(()=>app.tooltip.toggle.showOn("linkrow", message, $.query(".copy.icon", this.el), true, 0), 1);
	}

	_initUI() {
		this.el.onclick = (evt) => this._onClick(evt);

		let fld=$.query(".url", this.el), copyBtn = $.query(".copy", this.el);
		let clipboard = new Clipboard(copyBtn, { target: () => fld });
		clipboard.on("success", () => app.tooltip.toggle.toggleOn("copy", "Copied to clipboard.", copyBtn, true, 3));
		clipboard.on("error", (e) => app.tooltip.toggle.toggleOn("copy", Utils.getCtrlKey()+"-C to copy.", copyBtn, true, 3)); // TODO: cmd/ctrl
	}

	_onClick(evt) {
		if ($.query(".copy", this.el).contains(evt.target)) { return; }
		if (evt.which === 2 || evt.metaKey || evt.ctrlKey) {
			window.open(Utils.getPatternURL(this._pattern));
		} else {
			app.load(this._pattern);
		}
	}
};