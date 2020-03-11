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

import EventDispatcher from "../events/EventDispatcher";

import $ from "../utils/DOMUtils"
import app from "../app";

export default class Theme extends EventDispatcher {
	constructor (el) {
		super();
		this.el = el;
		this.urlTemplate = "./assets/themes/%name%.css";
		this.targetNode = this._node = null;
		this._dark = false;
		this._initUI();
		this.dark = !!app.prefs.read("dark");
	}

	set dark(val) {
		val = !!val;
		if (this._dark === val) { return; }
		this._dark = val;
		this._load(val ? "dark" : null);
		$.toggleClass(this.themeBtn, "selected", val);
		app.prefs.write("dark", val);
	}
	
	get dark() {
		return this._dark;
	}

	_initUI() {
		this.themeBtn = $.query(".header .button.theme", this.el);
		this.themeBtn.addEventListener("click", (evt) => this._toggleTheme());
	}

	_load(id) {
		if (id === this._id) { return; }
		this._id = id;
		if (this._node) { this._node.remove(); }
		if (!id) { this._change(); return; }
		let tmpl = this.urlTemplate, n = $.create("link");
		n.addEventListener("load", () => this._change());
		n.rel = "stylesheet";
		n.type = "text/css";
		n.href = tmpl ? tmpl.replace(/%name%/g, id) : id;
		this._node = (this.targetNode || document.head).appendChild(n);
	}

	_change() {
		this.dispatchEvent("change");
	}

	_toggleTheme() {
		this.dark = !this.dark;
	}

}