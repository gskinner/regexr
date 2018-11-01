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

import EventDispatcher from "./events/EventDispatcher";

import $ from "./utils/DOMUtils";
import Utils from "./utils/Utils";
import CMUtils from "./utils/CMUtils";

import Tooltip from "./controls/Tooltip";
import List from "./controls/List";

import Server from "./net/Server";

import Expression from "./views/Expression";
import Text from "./views/Text";
import Tools from "./views/Tools";
import Sidebar from "./views/Sidebar";
import Account from "./views/Account";

import Reference from "./docs/Reference";
import reference_content from "./docs/reference_content";
import Flavor from "./Flavor";

import RefCoverage from "./RefCoverage";

export default class RegExr extends EventDispatcher {
	constructor () { super(); }
	
	init(state, account, config={}) {
		this.flavor = new Flavor("js");
		this.reference = new Reference(reference_content, this.flavor, config);
		this._migrateFavorites();
		this._initUI();

		this.account.value = account;
		if (state === false) {
			this._localInit();
		} else if (this.account.authenticated && !state) {
			this.newDoc(false);
		} else {
			this.state = state;
		}
		this._savedHash = null;

		let params = Utils.getUrlParams();
		if (params.engine) { this.flavor.value = params.engine; }
		if (params.expression) { this.expression.value = params.expression; }
		if (params.text) { this.text.value = params.text; }
		if (params.tool) { this.tools.value = {id:params.tool, input:params.input}; }
		
		window.onbeforeunload = (e) => this.unsaved ? "You have unsaved changes." : null;
		this.resetUnsaved();

		setTimeout(() => this._initAds(), 100);
	}

	_initAds() {
		_native && _native.init("CK7D65QM", { // "CK7D65QM" use "CK7D4KQE" to test Carbon ads
			carbonZoneKey: 'CK7DPKQU',
			targetClass: 'native-js'
		});
	}

	_localInit() {
		console.log("local init");
		//Server.verify().then((data) => this.account.value = data);
		new RefCoverage();
	}
	
// getter / setters:
	get state() {
		let o = {
			expression: this.expression.value,
			text: this.text.value,
			flavor: this.flavor.value,
			tool: this.tools.value
		};
		// copy share values onto the pattern object:
		return Utils.copy(this.share.value, o);
	}
	
	set state(o) {
		if (!o) { return; }
		this.flavor.value = o.flavor;
		this.expression.value = o.expression;
		this.text.value = o.text;
		this.tools.value = o.tool;
		this.share.pattern = o;
		this.resetUnsaved();
	}

	get hash() {
		let share = this.share;
		return Utils.getHashCode(
			this.expression.value+"\t"
			+ this.text.value+"\t"
			+ this.flavor.value+"\t"
			+ share.author+"\t" + share.name+"\t" + share.description+"\t" + share.keywords+"\t"
			//+ this.tools.value.input+"\t"
			//+ this.tools.value.id+"\t"
		)
	}

	get unsaved() {
		return this.hash !== this._savedHash;
	}

	get isNarrow() {
		return this._matchList.matches;
	}

// public methods:
	resetUnsaved() {
		this._savedHash = this.hash;
	}
	
	newDoc(warn=true) {
		this.load({flavor: this.flavor.value, expression: ".", text:"Text"}, warn);
		this.expression.selectAll();
	}

	load(state, warn=true) {
		if (warn === true) { warn = "You have unsaved changes. Continue without saving?"; }
		if (warn && this.unsaved && !confirm(warn)) { return; }
		this.state = Utils.clone(state);
	}
	
// private methods:
	_initUI() {
		// TODO: break into own Device class? Rename mobile.scss too?
		// mobile setup
		// keep synced with "mobile.scss":
		if (screen.width < 500) {
			document.getElementById("viewport").setAttribute("content", "width=500, user-scalable=0");
		}
		this._matchList = window.matchMedia("(max-width: 900px)");
		this._matchList.addListener((q)=>this.dispatchEvent("narrow")); // currently unused.

		// UI:
		this.el = $.query(".container");

		this.tooltip = {
			hover: new Tooltip($.query("#library #tooltip").cloneNode(true)),
			toggle: new Tooltip($.query("#library #tooltip"), true)
		};
		
		let el = $.query(".app > .doc", this.el);
		this.expression = new Expression($.query("> section.expression", el));
		this.text = new Text($.query("> section.text", el));
		this.tools = new Tools($.query("> section.tools", el));
		
		this.account = new Account();
		this.sidebar = new Sidebar($.query(".app > .sidebar", this.el));
		this.share = this.sidebar.share;
		
		this.expression.on("change", ()=> this._change());
		this.text.on("change", ()=> this._change());
		this.flavor.on("change", ()=> this._change());
		this.tools.on("change", ()=> this._change());
		this.share.on("change", ()=> this._change());
		this._change();
	}

	_migrateFavorites() {
		let ls = window.localStorage, l=ls.length;
		if (!l || ls.getItem("f_v3") >= "1") { return }
		let ids = [];
		for (let i=0; i<l; i++) {
			let key = ls.key(i), val=ls.getItem(key);
			if (key[0] === "f" && val === "1") {
				ids.push(key.substr(1));
			}
		}
		if (!ids.length) { ls.setItem("f_v3", "1"); return; }
		Server.multiFavorite(ids).then(() => ls.setItem("f_v3", "1"));
	}
	
	_change() {
		this.dispatchEvent("change");
		var solver = this.flavor.solver, exp = this.expression;
		solver.solve({pattern:exp.pattern, flags:exp.flags, text:this.text.value, tool:this.tools.value}, (result) => this._handleResult(result));
	}
	
	_handleResult(result) {
		this.result = this._processResult(result);;
		this.dispatchEvent("result");
	}
	
	_processResult(result) {
		result.matches && result.matches.forEach((o, i)=>o.num=i);
		return result;
	}
}