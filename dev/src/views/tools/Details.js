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

export default class Details {
	
	constructor(el) {
		this.el = el;
		$.addClass(el, "details");
		this._update();
		
		this._bound_handleEvent = (evt) => this._handleEvent(evt);
		app.addEventListener("result", this._bound_handleEvent);
		app.text.addEventListener("select", this._bound_handleEvent);
	}
	
	
	cleanup() {
		$.empty(this.el);
		$.removeClass(this.el, "details");
		app.removeEventListener("result", this._bound_handleEvent);
		app.text.removeEventListener("select", this._bound_handleEvent);
		Utils.defer(null, "Details._update");
	}
	
// private methods:
	_update() {
		$.empty(this.el);
		$.create("div", "desc", "Click a <span class='match'>match</span> above to display match &amp; group details. Mouse over a <code>Group</code> row to highlight it in the Expression.", this.el);
		this._addMatch(app.text.selectedMatch, app.text.value);
	}
	
	_addMatch(match, textVal) {
		if (!match) { return; }
		let groups = match.groups, l=groups&&groups.length, ext=l&&(groups[0].i != null), matchVal=this._getMatchVal(match, textVal), extStr="", me = match.i+match.l;
		let groupTokens = app.expression.lexer.captureGroups;
		
		let tableEl = $.create("table", null, null, this.el);
		let matchEl = $.create("tr", "match", "<td>Match "+match.num+"</td><td>"+this._getRangeStr(match)+"</td><td></td>", tableEl);
		
		if (l) {
			let inGroups = [], lastIndex = match.i;
			for (let i = 0; i <= l; i++) {
				let group = groups[i], index = group ? group.i : me, num = i + 1, token = groupTokens[i];
				if (ext) {
					for (let j = inGroups.length - 1; j >= 0; j--) {
						let inGroup = inGroups[j], ge = inGroup.i + inGroup.l;
						if (ge > index) { break; }
						inGroups.pop();
						extStr += Utils.htmlSafe(textVal.substring(lastIndex, ge)) + "</span>";
						lastIndex = ge;
					}
				}
				if (!group) { break; }
				if (group.l) {
					extStr += Utils.htmlSafe(textVal.substring(lastIndex, index)) + "<span class='group-" + num % 6 + " num-" + num + "'>";
					inGroups.push(group);
					lastIndex = index;
				}
				let val = "<span" + (ext ? " class='group-" + num % 6 + "'" : "") + ">" + this._getMatchVal(group, textVal) + "</span>";
				let label = token.name ? "'"+token.name+"'" : ("Group " + num);
				let tr = $.create("tr", "group", "<td>" + label + "</td><td>" + this._getRangeStr(group) + "</td><td>" + val + "</td>", tableEl);
				
				tr.token = token;
				tr.addEventListener("mouseover", this._handleMouseEvent);
				tr.addEventListener("mouseout", this._handleMouseEvent);
			}
			if (ext) { extStr += Utils.htmlSafe(textVal.substring(lastIndex, me)); }
		} else {
			$.create("tr", "nogroup", "<td colspan='3'>No groups.</td>", tableEl);
		}
		
		$.query("td:last-child", matchEl).innerHTML = extStr || matchVal;
	}
	
	_getMatchVal(match, str) {
		let val = match.s || (match.i === undefined ? "" : str.substr(match.i, match.l));
		return val ? Utils.htmlSafe(val) : "<em>&lt;empty&gt;</em>";
	}
	
	_getRangeStr(match) {
		// we could check for match.l>0 to catch empty matches, but having a weird range might be more accurate.
		return match.i != null ? match.i + "-" + (match.i+match.l-1) : "n/a";
	}

	_handleEvent(evt) {
		Utils.defer(()=>this._update(), "Details._update");
	}
	
	_handleMouseEvent(evt) {
		let type = evt.type, token = evt.currentTarget.token;
		app.expression.highlighter.hoverToken = type === "mouseout" ? null : token;
		if (type === "mouseover") { $.addClass($.query("span.num-"+token.num, this.el), "hover"); }
		else { $.removeClass($.query("span.hover", this.el), "hover"); }
		evt.stopPropagation();
	}
}