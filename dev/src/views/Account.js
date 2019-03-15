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
import Track from "../utils/Track"

import List from "../controls/List";
import Server from "../net/Server";

import app from "../app";

export default class Account extends EventDispatcher {
	constructor () {
		super();
		this._value = {};
		this._initUI();
	}
	
	get value() {
		return this._value;
	}

	set value(val={}) {
		this._value = val;
		this._updateUI();
		this.dispatchEvent("change");
	}

	get userId() { return this._value.userId; }
	get author() { return this._value.author || this._value.username || ""; }
	get username() { return this._value.username || ""; }
	get authenticated() { return !!this._value.username; } // this._value.authenticated;
	get type() { return this._value.type; }
	
	showTooltip() {
		app.tooltip.toggle.toggleOn("signin", this.tooltipEl, this.signinBtn, true, 20);
	}
	
// private methods:
	_initUI() {
		let template = (o) => '<svg class="icon inline"><use xlink:href="#'+o.toLowerCase()+'"></use></svg>'+o;
		this.signinBtn = $.query(".header .signin");
		this.tooltipEl = $.query("#library > #tooltip-signin");
		this.signinEl = $.query(".signin", this.tooltipEl);
		this.signoutEl = $.query(".signout", this.tooltipEl);
		$.query(".signoutbtn", this.signoutEl).addEventListener("click", (evt) => this._doSignout());
		this.signinBtn.addEventListener("click", (evt) => this.showTooltip());
		$.query(".icon.help", this.signinEl).addEventListener("click", ()=> app.sidebar.goto("signin"));
		this.signinList = new List($.query("ul.list", this.signinEl), {data:["GitHub","Facebook", "Google"], template});
		this.signinList.on("change", ()=>this._signinListChange());
	}

	_updateUI() {
		let auth = this.authenticated;
		$.toggleClass(this.tooltipEl, "authenticated", auth);
		$.query(".label", this.signinBtn).innerText = auth ? "Sign Out" : "Sign In";
		if (auth) {
			$.query(".username", this.signoutEl).innerText = this.username;
			$.query(".type", this.signoutEl).innerText = this.type;
		}
	}

	_doSignout() {
		$.addClass(this.tooltipEl, "wait");
		Server.logout().then((data) => { this._handleSignout(data); }).finally(()=>this._cleanSignout());
	}

	_handleSignout(data) {
		this.value = data;
	}

	_cleanSignout(err) {
		$.removeClass(this.tooltipEl, "wait");
	}
	
	_signinListChange() {
		let service = this.signinList.selected.toLowerCase();
		$.addClass(this.tooltipEl, "wait");
		Track.event("login", "access", service);
		setTimeout(() => Server.login(service), 100);
	}
}