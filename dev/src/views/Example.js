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
import Utils from "../utils/Utils.js";

import app from "../app";

export default class Example {
	constructor (title, ex) {
		this.el = $.create("div", "example");
		this.title = title;
		this.example = ex;
	}
	
	set example(ex) {
		if (ex === this._example) { return; }
		this._example = ex;
		
		let str = "", txt, exp, regex;
		if (ex) {
			exp = ex[0];
			txt = ex[1];
			regex = Utils.getRegExp(exp, "g");
			if (this.title) { str += "<h1>" + this.title + "</h1><hr>"; }
			str += "<code class='expression'><svg class='icon load'><use xlink:href='#load'><title>Load expression</title></use></svg>" + Utils.htmlSafe(exp) + "</code>";
			if (txt && regex) {
				let over=Math.max(0, txt.length-160), s=txt;
				if (over) { s = Utils.htmlSafe(s.substr(0,159)); }
				if (regex) { s = s.replace(regex, "<em>$&</em>"); }
				// TODO: this won't match on html elements:
				str += "<hr><code class='text'><svg class='icon load'><use xlink:href='#load'><title>Load text</title></use></svg>" + s + (over?"<i>\u2026</i>" : "") + "</code>";
			}
		}
		this.el.innerHTML = str;
		if (exp) {
			$.query("code.expression > .load", this.el).addEventListener("click", ()=> {
				// TODO: this will need to be updated when we support other delimiters:
				app.expression.value = exp[0] === "/" ? exp : "/"+exp+"/g";
			});
			
		}
		if (txt) { $.query("code.text > .load", this.el).addEventListener("click", ()=> app.text.value = txt); }
	}
	

}