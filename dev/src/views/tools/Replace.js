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

import $ from "../../utils/DOMUtils";
import Utils from "../../utils/Utils";
import app from "../../app";

export default class Replace {
	constructor(el, cm) {
		this.el = el;
		this.editor = cm;
		
		this._bound_handleEvent = (evt) => this._handleEvent(evt);
		app.addEventListener("result", this._bound_handleEvent);
		
		this._initUI();
		this._update();
	}
	
	cleanup() {
		$.empty(this.el);
		this.output.value = "";
		$.removeClass(this.el, "details");
		app.removeEventListener("result", this._bound_handleEvent);
		Utils.defer(null, "Replace._update");
	}
	
// private methods:
	_initUI() {
		this.output = $.create("textarea", null, null, this.el);
		this.output.readOnly = true;
	}
	
	_update() {
		let o = app.result && app.result.tool, result = o&&o.result;
		this.output.value = result || "no result";
	}

	_handleEvent(evt) {
		Utils.defer(()=>this._update(), "Replace._update");
	}
}