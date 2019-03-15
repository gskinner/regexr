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

import List from "../controls/List";
import content from "../docs/sidebar_content";
import Track from "../utils/Track";
import Server from "../net/Server";
import Community from "./Community";
import Example from "./Example";
import Share from "./Share";

import app from "../app";

export default class Sidebar {
	constructor (el) {
		this.el = el;
		this.itemEl = null;
		this.openReq = null;
		this._initUI(el);
		this._content = this._prepContent(content);
		this.minList.data = [{id: "menu", label:"Menu"}].concat(content.kids);
		app.flavor.on("change", ()=>this._onFlavorChange());
		let id = app.prefs.read("side");
		if (!id || !this._idMap[id] || id === "share") { id = "home"; }
		this.goto(id);
		if (app.isNarrow) { setTimeout(() => this.minimize(true, false), 1500); }
	}

	minimize(val=true, track=true) {
		if (val === this._minimized) { return; }
		if (val && track) { Track.event("minimize_menu", "engagement"); }
		$.togglePanel(this.el, '.full', '.min', !val);
		this._minimized = val;
		this._updateUI();
	}
	
	goto(id) {
		this.show(this._idMap[id]);
	}
	
	showToken(token) {
		this.goto(app.reference.idForToken(token));
	}
	
	show(item) {
		if (!item) { return; }
		if (item.hide) { return this.show(item.parent); }
		if (!item || item.id === "menu") { return; } // expand button on the min menu
		this.minimize(false);
		if (item.id) {
			Track.page("sidebar/"+item.id);
			if (item.id === "home" || (item.parent && item.parent.id === "home") || this._isInReference(item)) {
				app.prefs.write("side", item.id);
			}
		}
		
		if (!item.el && !item.kids) {
			if (this.searchMode || !item.parent || item.parent === this.curItem) {
				// in a search, community / favorites, of selecting a leaf child from a list.
				this.selItem = item;
				this.menuList.selected = item.id;
				return this._showContent(item);
			} else if (item.parent !== this.curItem) {
				// trying to jump to a leaf child without previously showing parent.
				this.show(item.parent);
				return this.show(item);
			}
		}
		
		this._resetFull();
		
		this.curItem = item;
		$.query("h1", this.titleEl).innerText = item.label;
		$.query("svg.back.icon use", this.titleEl).setAttribute("xlink:href", "#"+(item.parent ? "arrowleft" : "menu"));
		if (item.el) {
			this._showEl($.query("#library "+item.el));
		} else {
			this._showContent(item);
		}
		
		if (item.kids && item.list !== false) {
			$.removeClass(this.fullEl, "no-list");
			this.menuList.data = item.kids || item.parent.kids;
		}
		if (item.search) { $.removeClass(this.fullEl, "no-search"); }
		
		// special handling:
		if (item.id === "community") {
			this.menuList.template = this.communityListTemplate;
			this._onSearchSubmit();
		} else if (item.id === "favorites") {
			this.menuList.template = this.communityListTemplate;
			this._loadFavorites();
		}
	}
	
	back() {
		if (this.curItem.parent) { this.show(this.curItem.parent); }
		else { this.minimize(true); }
	}
	
	menuListTemplate(o) {
		return (o.parent && o.parent.id === "home" ? '<svg class="icon"><use xlink:href="#'+ o.id +'"></use></svg>' : "") + 
			   '<span class="label">'+ (o.label||o.id) +"</span>" + 
			   (o.token ? '<span class="token">'+ o.token.replace("<", "&lt;") + '</span>' : "") +
			   (o.kids || o.el ? '<svg class="small icon"><use xlink:href="#arrowright"></use></svg>' : "");
	}
	
	communityListTemplate(o) {
		return '<span class="label">'+ Utils.htmlSafe(o.name) +"</span>" +
			   '<span class="rating">' +
			   (o.favorite ? '<svg class="small icon favorites"><use xlink:href="#favorites"></use></svg>' : '') +
			   '<svg class="small icon thumb"><use xlink:href="#thumb"></use></svg>'+o.rating.toFixed(1)+'</span>';
	}
	
// private methods:
	_initUI(el) {
		// set up full width content:
		this.fullEl = $.query("> .full", el);
		
		// title bar:
		this.titleEl = $.query("> header", this.fullEl);
		$.query("> .close.icon", this.titleEl).addEventListener("click", () => this.minimize(true));
		$.query("> .backrow", this.titleEl).addEventListener("click", () => this.back());
		
		// search:
		this.searchEl = $.query("> .search", this.fullEl);
		this.searchFld = $.query("> .search > input", this.fullEl);
		this.searchFld.addEventListener("input", ()=>this._onSearchChange());
		this.searchFld.addEventListener("keyup", (evt)=>(evt.keyCode === 13)&&this._onSearchSubmit());
		let searchBtn = $.query("> svg.icon.search", this.searchEl);
		searchBtn.addEventListener("click", ()=>this._onSearchSubmit());
		
		// list & content:
		this.listEl = $.query("> .list", this.fullEl);
		this.menuList = new List(this.listEl, {data:content.kids, template:this.menuListTemplate});
		this.menuList.on("change", ()=> this.show(this.menuList.selectedItem));
		this.menuList.on("dblclick", ()=> this._onDblClick(this.menuList.selectedItem));
		this.contentEl = $.query("> .content", this.fullEl);
		
		// set up minimized sidebar:
		this.minEl = $.query("> .min", el);
		this.minEl.addEventListener("click", () => this.minimize(false));
		
		let template = $.template`<svg class="icon"><use xlink:href="#${"id"}"></use></svg>`;
		this.minList = new List($.query("> .list", this.minEl), {template});
		this.minList.on("change", (evt)=> { this.show(this.minList.selectedItem); evt.preventDefault(); });
		
		// set up special content:
		this.community = new Community($.query("#library > #community"));
		this.share = new Share($.query("#library > #share"));
		this._prepCheatsheet(); // TODO: switch to a Cheatsheet class.

		$.query(".doc > .blocker").addEventListener("mousedown", (evt) => {
			this.minimize(true);
		})
	}

	_updateUI() {
		// TODO: this is cheating a bit:
		let doc = $.query(".doc");
		$.toggleClass(doc, "fadeback", !this._minimized);
	}

	_resetFull() {
		if (this.itemEl) {
			$.query("#library").appendChild(this.itemEl);
			this.itemEl = null;
		}
		this._abortReq();
		$.addClass(this.fullEl, "no-search no-list");
		this.searchFld.value = "";
		this.searchMode = false;
		this.menuList.template = this.menuListTemplate;
		$.removeClass(this.searchEl, "wait");
	}
	
	_showContent(o) {
		if ((this.curItem.id === "community" || this.curItem.id === "favorites") && o !== this.curItem) {
			this._showEl(this.community.el);
			this.community.item = o;
		} else {
			let ref = app.reference;
			this.contentEl.innerHTML = this._isInReference(o) ? ref.getContent(o.id) : ref.fillTags((o.desc || "") + (o.ext || ""), o, ref);
			if (o.example) { this.contentEl.appendChild(new Example("Example", o.example).el); }
		}
	}

	_isInReference(o) {
		return this._isIn(o, "reference");
	}
	
	_isIn(o, id) {
		do { if (o.id === id) { return true; } } while (o = o.parent);
		return false;
	}
	
	_onDblClick(o) {
		if (o.token) {
			let expr = app.expression;
			if (o.parent.id === "flags") { expr.toggleFlag(o.token); }
			else { expr.insert(o.token); }
		} else if (this.curItem.id === "community" || this.curItem.id === "favorites") {
			app.load(o);
		}
	}
	
	_showEl(el) {
		if (this.itemEl === el) { return; }
		this.itemEl = el;
		$.empty(this.contentEl).appendChild(el);
	}

	_prepContent(content) {
		// inject reference:
		let i = Utils.findIndex(content.kids, (o)=>o.id==="reference");
		content.kids.splice(i, 1, app.reference.content);
		// grab home content from HTML:
		content.desc = this.contentEl.innerHTML;
		// build idMap:
		this._idMap = {home:content};
		return Utils.prepMenuContent(content, this._idMap);
	}
	
	_prepCheatsheet() {
		let els = $.queryAll("#cheatsheet *[data-id]");
		let f = (evt)=>this.goto(evt.target.dataset.id);
		for (let i=0, l=els.length; i<l; i++) {
			els[i].addEventListener("click", f);
		}
		els = $.queryAll("#cheatsheet tr td:first-child");
		f = (evt)=>app.expression.insert(evt.target.innerText);
		for (let i=0, l=els.length; i<l; i++) {
			let el = els[i], tokens = el.innerText.split(" ");
			$.empty(el);
			for (let j=0; j<tokens.length; j++) {
				let span = $.create("a", null, tokens[j], el);
				span.addEventListener("click", f);
			}
		}
	}
	
	_onSearchChange() {
		let id = this.curItem.id, search = this.searchFld.value;
		if (id === "reference") { this._searchReference(search); }
		else if (id === "favorites") { this._searchFavorites(search); }
		else { return; }
		// TODO: this is a hacky way to reset the content:
		this.contentEl.innerHTML = this.curItem.desc;
		this.itemEl = null;
	}

	_searchReference(search) {
		let result = app.reference.search(search);
		this.searchMode = !!search;
		this.menuList.data = search ? result : this.curItem.kids;
		// TODO: would be nice to show a "no match" message, but difficult to do with `hide=true` entries
	}

	_searchFavorites(search) {
		let data = this.menuList.data, rank = Utils.searchRank;
		data.forEach((o) => o.hide = !rank(o, search));
		this.menuList.data = data;
	}
	
	_onFlavorChange() {
		let item = this.selItem || this.curItem;
		if (!this._isInReference(item)) { return; }
		this.selItem = this.curItem = null;
		this.show(item);
	}
	
	_onSearchSubmit() {
		this._abortReq();
		let val = this.searchFld.value;
		if (this.curItem.id === "community") {
			if (val) { Track.event("search", "engagement", {search_term:val, target:"community"}); }
			$.addClass(this.searchEl, "wait");
			this._showListMsg();
			this.openReq = Server.communitySearch(val)
				.then((data)=>this._showServerResults(data))
				.catch((msg)=>this._showListMsg(msg))
				.finally(()=>this._reqCleanup());
		}
		this.searchFld.select();
	}
	
	_loadFavorites() {
		this._abortReq();
		let val = this.searchFld.value;
		this.openReq = Server.patterns()
			.then((data)=>this._showServerResults(data))
			.catch((msg)=>this._showListMsg(msg))
			.finally(()=>this._reqCleanup());
		this._showListMsg();
	}

	_showListMsg(msg="Loading...") {
		this.listEl.innerHTML = "<li class='loading'>"+msg+"</li>";
	}
	
	_abortReq() {
		if (this.openReq) { this.openReq.abort(); }
		this.openReq = null;
	}
	
	_showServerResults(data) {
		this.menuList.data = data.results;
		if (data.results.length === 0) {
			this._showListMsg(this.curItem.id === "community" ? "No matches." : "No patterns created or favorited.");
		}
	}
	
	_reqCleanup(msg) {
		$.removeClass(this.searchEl, "wait");
	}

}