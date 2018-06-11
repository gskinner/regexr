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
import CMUtils from "../utils/CMUtils";
import Utils from "../utils/Utils";
import Track from "../utils/Track";

import List from "../controls/List";
import ExpressionHighlighter from "./ExpressionHighlighter";
import ExpressionHover from "./ExpressionHover";
import Explain from "./tools/Explain";
import Details from "./tools/Details";
import Replace from "./tools/Replace";

import SubstLexer from "../SubstLexer";
import EventDispatcher from "../events/EventDispatcher";

import app from "../app";

export default class Tools extends EventDispatcher {
	constructor (el) {
		super();
		this.el = el;
		this._initUI();
		this.value = null;
	}
	
	set value(o) {
		if (!o) {
			this.show("explain");
			this._toolValues = Utils.copy({}, Tools.DEFAULT_VALUES);
		} else {
			this.show(o.id);
			if (o.input != null) { this.editor.setValue(o.input); }
		}
	}
	
	get value() {
		return {
			id: this._toolId,
			input: this.input
		};
	}
	
	get input() {
		return this.hasInput ? this.editor.getValue() : null;
	}
	
	get hasInput() {
		let id = this._toolId;
		return (id === "replace" || id === "list");
	}
	
	show(id) {
		if (!id || id === this._toolId) { return; }
		Track.page("tool/"+id);

		this.toolList.selected = this._toolId = id;
		let input = (id === "replace" || id === "list");
		
		if (this._tool) { this._tool.cleanup(); }
		
		$.toggleClass($.query("> article", this.el), "showinput", input);
		if (input) {
			this.editor.setValue(this._toolValues[id]);
			this.editor.refresh();
			this.editor.focus();
		}
		
		if (id === "explain") { this._tool = new Explain(this.contentEl); }
		else if (id === "details") { this._tool = new Details(this.contentEl); }
		else if (id === "replace" || id === "list") { this._tool = new Replace(this.resultEl, this.editor); }
		
		this._toolId = id;
		this._updateHighlights();
	}
	
	_initUI() {
		let el = this.el;
		this.headerEl = $.query("header", this.el);
		this.headerEl.addEventListener("click", (evt) => this._handleHeaderClick(evt));
		
		this.contentEl = $.query("> article > .content", el);
		this.resultEl = $.query("> article > .inputtool > .result", el);
		
		this.toolListEl = $.query(".toollist", this.headerEl);
		let data = ["Replace", "List", "Details", "Explain"].map((val) => ({label:val, id:val.toLowerCase()}));
		this.toolList = new List(this.toolListEl, {data});
		this.toolList.on("change", ()=> this._handleListChange());
		
		let editor = this.editor = CMUtils.create($.query(".inputtool .editor", el), {
			maxLength: 2500,
			singleLine: true
		}, "100%", "100%");

		$.query(".help.icon", el).addEventListener("click", () => app.sidebar.goto(this._toolId));
		
		// TODO: evaluate this living here or in Replace:
		editor.on("change", ()=> this._handleEditorChange());
		
		app.flavor.on("change", () => this._updateHighlights());
		app.expression.on("change", () => this._updateHighlights());
		
		this.lexer = new SubstLexer();
		this.highlighter = new ExpressionHighlighter(editor);
		this.hover = new ExpressionHover(editor, this.highlighter);
	}
	
	_handleEditorChange() {
		this._updateHighlights();
		this._toolValues[this._toolId] = this.editor.getValue();
		this.dispatchEvent("change");
	}
	
	_updateHighlights() {
		if (!this.hasInput) { return; } // only for Replace & List
		this.lexer.profile = app.flavor.profile;
		let token = this.lexer.parse(this.editor.getValue());
		this.highlighter.draw(token);
		this.hover.token = token;
	}
	
	_handleListChange() {
		this.show(this.toolList.selected);
	}
	
	_handleHeaderClick(evt) {
		if ($.hasClass(this.el, "closed") || !this.toolListEl.contains(evt.target)) {
			$.togglePanel(this.el, 'article');
		}
	}
}
Tools.DEFAULT_VALUES = {
	replace: "<< $& >>",
	list: "$&\\n"
};