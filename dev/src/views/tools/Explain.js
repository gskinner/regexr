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
import Utils from "../../utils/Utils.js";

import ExpressionHighlighter from "../ExpressionHighlighter";

import app from "../../app";

export default class Explain {
	
	constructor(el) {
		this.el = el;
		$.addClass(el, "explain");
		this._update();
		
		this._bound_handleEvent = (evt) => this._handleEvent(evt);
		app.expression.addEventListener("change", this._bound_handleEvent);
		app.expression.highlighter.addEventListener("hover", this._bound_handleEvent);
	}
	
	
	cleanup() {
		$.empty(this.el);
		$.removeClass(this.el, "explain");
		app.expression.removeEventListener("change", this._bound_handleEvent);
		app.expression.highlighter.removeEventListener("hover", this._bound_handleEvent);
	}
	
// private methods:
	_update() {
		let el = $.empty(this.el), token = app.expression.token, expr = app.expression.value;
		this._divs = [];
		if (!token || token.next.type === "close") {
			el.innerHTML = "<span class='desc'>Enter an Expression above and it will be explained here.</span>";
			return;
		}
		el.innerHTML = "<span class='desc'>Roll-over elements below to highlight in the Expression above. Click to open in Reference.</span>";
		while ((token = token.next) && (token.type !== "close")) {
			
			if (token.proxy || (token.open && token.open.proxy)) { continue; }
			
			let groupClasses = ExpressionHighlighter.GROUP_CLASS_BY_TYPE, pre = ExpressionHighlighter.CSS_PREFIX;
			let i = token.i, end = token.i+token.l, content=expr.substring(i, end).replace("<", "&lt;");
			if (token.set) {
				let set0=token.set[0], set2=token.set[2];
				content = "<span class='"+pre+(set0.clss || set0.type)+"'>"+expr.substring(set0.i, set0.i+set0.l)+"</span>";
				content += expr.substring(i, end);
				content += "<span class='"+pre+(set2.clss || set2.type)+"'>"+expr.substring(set2.i, set2.i+set2.l)+"</span>";
			}
			
			let className = pre + (token.clss || token.type);
			content = "<code class='token "+className+"'>"+content+"</code> ";
			if (!token.open) { content += app.reference.tipForToken(token); }
			else { content += "&nbsp;"; }
			let div = $.create("div", null, content, el);
			
			if (token.close) {
				className = groupClasses[token.clss || token.type];
				if (className) {
					className = className.replace("%depth%", Math.min(4,token.depth));
					$.addClass(div, className);
				}
				if (token.depth > 3) {
					div.innerHTML = "So... you wanted to see what would happen if you just kept nesting groups, eh? Well, this is it."+
						" I was going to reward your curiosity with a RegEx joke, but a quick search on google reveals that not even"+
						" the collective wisdom of the internet can make regular expressions funny. Well, except the whole 'now you've got two problems'"+
						" shtick, but you've probably heard that one already. Wasn't really worth the effort, was it?";
					token = token.close.prv;
					this._divs.push(div);
					el = div;
					continue;
				}
				el = div;
			}
			
			div.token = token;
	
			if (token.open) {
				$.addClass(div, "close");
				div.proxy = el;
				el = el.parentNode;
			}
	
			if (token.error) {
				$.addClass(div, "error");
				if (token.error.warning) { $.addClass(div, "warning"); }
			}
	
			if (!token.open) {
				div.addEventListener("mouseover", this._handleMouseEvent);
				div.addEventListener("mouseout", this._handleMouseEvent);
				div.addEventListener("click", this._handleMouseEvent);
			}
			
			if (token.clss === "quant" || token.type === "lazy" || token.type === "possessive") {
				this._insertApplied(div);
			} else {
				this._divs.push(div);
			}
		}
	}

	_insertApplied(div) {
		let divs = this._divs, prv = div.token.prv, d, i=divs.length;
		while ((d = divs[--i]) && d.token !== prv) {} // search backwards for efficiency
		d = d.proxy||d;
		divs.splice(i, 0, div);
		d.insertAdjacentElement("afterend", div);
		$.addClass(div, "applied");
	}

	_handleHoverChange() {
		let token = app.expression.highlighter.hoverToken;
		$.removeClass($.queryAll("div.selected", this.el), "selected");
		$.removeClass($.queryAll("div.related", this.el), "related");
		if (!token) { return; }
		
		let div = this._findDiv(token);
		$.addClass(div, "selected");
		if (token.related) {
			for (let i = 0, l=token.related.length; i < l; i++) {
				$.addClass(this._findDiv(token.related[i]), "related");
			}
		}
	}
	
	_findDiv(token) {
		return Utils.find(this._divs, (div) => div.token === token);
	}

	_handleMouseEvent(evt) {
		let type = evt.type, token = evt.currentTarget.token;
		if (type == "click") { app.sidebar.showToken(token); }
		else { app.expression.highlighter.hoverToken = type === "mouseout" ? null : token; }
		evt.stopPropagation();
	}
	
	_handleEvent(evt) {
		if (evt.type === "change") { this._update(); }
		else if (evt.type === "hover") { this._handleHoverChange(); }
	}
}