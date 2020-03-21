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
import EventDispatcher from "../events/EventDispatcher";

export default class List extends EventDispatcher {
	constructor(el, opts) {
		super();
		this.el = el;
		this.multi = opts.multi;
		this.template = opts.template;
		this.data = opts.data;
		if (opts.selected) { this.selected = opts.selected; }
	}
	
	set data(data) {
		$.empty(this.el);
		this._data = data;
		if (!data || !data.length) { return; }
		for (let i=0, l=data.length; i<l; i++) {
			this.addItem(data[i]);
		}
	}

	get data() {
		return this._data;
	}
	
	set selected(ids) {
		$.removeClass($.queryAll(".selected", this.el), "selected");
		if (!(ids instanceof Array)) { ids = [ids]; }
		ids.forEach((id)=>$.addClass($.query("[data-id='"+id+"']",this.el), "selected"));
		
		if (!this.multi) { this.scrollTo(ids[0]); }
	}
	
	get selected() {
		let els = $.queryAll("li.selected", this.el);
		if (!els[0]) { return null; }
		if (!this.multi) { return els[0].dataset.id; }
		let ids = [];
		for (let i=0, l=els.length; i<l; i++) { ids.push(els[i].dataset.id); }
		return ids;
	}

	set selectedIndex(index) {
		let data = this.data;
		this.selected = data && data[index] && data[index].id;
	}

	get selectedIndex() {
		let el = this.selectedEl, id = el && el.dataset.id;
		return id === null ? -1 : this.data.findIndex((o) => o.id === id);
	}
	
	get selectedItem() {
		let el = this.selectedEl;
		return el && el.item;
	}

	get selectedEl() {
		return $.query("li.selected", this.el);
	}
	
	refresh() {
		let sel = this.selected;
		this.data = this._data;
		this.selected = sel;
	}

	addItem(o, selected=null) {
		let label, id, sel;
		let f=(evt) => this.handleClick(evt), template=this.template;
		if (typeof o === "string") {
			id = o;
			label = template ? template(o) : o;
		} else {
			if (o.hide) { return; }
			id = o.id || o.label;
			label = template ? template(o) : o.label;
			if (selected === null) { sel = o.selected; }
		}
		let item = $.create("li", sel ? "selected" : null, label, this.el);
		item.dataset.id = id;
		item.item = o;
		item.addEventListener("click", f);
		item.addEventListener("dblclick", f);

		if (selected) {
			this.selected = o.id;
		}
	}

	removeItem(id) {
		let el = $.query("[data-id='"+id+"']",this.el);
		el && el.remove();
	}

	handleClick(evt) {
		let id = evt.currentTarget.dataset.id, old = this.selected;
		if (!this.getEl(id)) { return; }
		if (evt.type === "dblclick") {
			if (id != null) { this.dispatchEvent("dblclick"); }
			return;
		} else if (this.multi) {
			$.toggleClass(evt.currentTarget, "selected");
		} else if (old === id) {
			if (id != null) { this.dispatchEvent("selclick"); }
			return;
		} else {
			this.selected = id;
		}
		if (!this.dispatchEvent("change", false, true)) { this.selected = old; }
	}
	
	scrollTo(id=this.selected) {
		let el = this.getEl(id);
		if (!el) { return; }
		//el.scrollIntoView(); // this is too jumpy, but would handle horizontal.

		let scrollEl = this.scrollEl || this.el;
		let top = el.offsetTop - scrollEl.offsetTop;
		if (top + el.offsetHeight > scrollEl.scrollTop+scrollEl.offsetHeight) {
			scrollEl.scrollTop = top+el.offsetHeight-scrollEl.offsetHeight+10;
		} else if (top < scrollEl.scrollTop) {
			scrollEl.scrollTop = top-10;
		}
	}

	getEl(id) {
		return $.query("[data-id='"+id+"']", this.el);
	}
};