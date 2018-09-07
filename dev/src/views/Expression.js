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
import ExpressionLexer from "../ExpressionLexer";
import ExpressionHighlighter from "./ExpressionHighlighter";
import ExpressionHover from "./ExpressionHover";
import profiles from "../profiles/profiles";
import EventDispatcher from "../events/EventDispatcher"

import app from "../app";

export default class Expression extends EventDispatcher {
	constructor (el) {
		super();
		this.el = el;
		this.delim = "/";
		this.lexer = new ExpressionLexer();
		
		this._initUI(el);
		app.flavor.on("change", ()=> this._onFlavorChange());
		this._onFlavorChange();
	}
	
	set value(expression) {
		let regex = Utils.decomposeRegEx(expression || Expression.DEFAULT_EXPRESSION, this.delim);
		this.pattern = regex.source;
		this.flags = regex.flags;
	}
	
	get value() {
		return this.editor.getValue();
	}
	
	set pattern(pattern) {
		let index = this.editor.getValue().lastIndexOf(this.delim);
		this.editor.replaceRange(pattern, {line: 0, ch: 1}, {line: 0, ch: index});
		this._deferUpdate();
	}
	
	get pattern() {
		return Utils.decomposeRegEx(this.editor.getValue(), this.delim).source;
	}
	
	set flags(flags) {
		flags = app.flavor.validateFlagsStr(flags);
		Track.event("set_flags", "engagement", {flags:flags});
		let str = this.editor.getValue(), index = str.lastIndexOf(this.delim);
		this.editor.replaceRange(flags, {line: 0, ch: index + 1}, {line: 0, ch: str.length }); // this doesn't work if readOnly is false.
	}
	
	get flags() {
		return Utils.decomposeRegEx(this.editor.getValue(), this.delim).flags;
	}
	
	get token() {
		return this.lexer.token;
	}
	
	showFlags() {
		this.flagsList.selected = this.flags.split("");
		app.tooltip.toggle.toggleOn("flags", this.flagsEl, this.flagsBtn, true, -2);
	}

	toggleFlag(s) {
		let flags = this.flags, i = flags.indexOf(s);
		this.flags = i>=0 ? flags.replace(s, "") : flags+s;
	}
	
	showFlavors() {
		app.tooltip.toggle.toggleOn("flavor", this.flavorEl, this.flavorBtn, true, -2)
	}
	
	insert(str) {
		this.editor.replaceSelection(str, "end");
	}

	selectAll() {
		CMUtils.selectAll(this.editor);
	}
	
// private methods:
	_initUI(el) {
		this.editorEl = $.query("> .editor", el);
		let editor = this.editor = CMUtils.create(this.editorEl, {
			autofocus: true,
			maxLength: 2500,
			singleLine: true
		}, "100%", "100%");
		
		editor.on("mousedown", (cm, evt)=> this._onEditorMouseDown(cm, evt));
		editor.on("change", (cm, evt)=> this._onEditorChange(cm, evt));
		editor.on("keydown", (cm, evt)=> this._onEditorKeyDown(cm, evt));
		// hacky method to disable overwrite mode on expressions to avoid overwriting flags:
		editor.toggleOverwrite = ()=>{};
		
		this.errorEl = $.query(".icon.alert", this.editorEl);
		this.errorEl.addEventListener("mouseenter", (evt)=>this._onMouseError(evt));
		this.errorEl.addEventListener("mouseleave", (evt)=>this._onMouseError(evt));
		
		this.highlighter = new ExpressionHighlighter(editor);
		this.hover = new ExpressionHover(editor, this.highlighter);
		
		this._setInitialExpression();
		this._initTooltips(el);
		this.value = Expression.DEFAULT_EXPRESSION;
	}
	
	_setInitialExpression() {
		let editor = this.editor;
		editor.setValue("/./g");
		
		// leading /
		editor.getDoc().markText({line: 0, ch: 0}, {
			line: 0,
			ch: 1
		}, {
			className: "exp-decorator",
			readOnly: true,
			atomic: true,
			inclusiveLeft: true
		});
		
		// trailing /g
		editor.getDoc().markText({line: 0, ch: 2}, {
			line: 0,
			ch: 4
		}, {
			className: "exp-decorator",
			readOnly: false,
			atomic: true,
			inclusiveRight: true
		});
		this._deferUpdate();
	}
	
	_deferUpdate() {
		Utils.defer(()=>this._update(), "Expression._update");
	}
	
	_update() {
		let expr = this.editor.getValue();
		this.lexer.profile = app.flavor.profile;
		let token = this.lexer.parse(expr);
		$.toggleClass(this.editorEl, "error", !!this.lexer.errors.length);
		this.hover.token = token;
		this.highlighter.draw(token);
		this.dispatchEvent("change");
	}
	
	_initTooltips(el) {
		const template = $.template`<svg class="inline check icon"><use xlink:href="#check"></use></svg> ${"label"}`;
		let flavorData = app.flavor.profiles.map((o)=>({id:o.id, label:o.label+" ("+(o.browser?"Browser":"Server")+")"}));
		
		this.flavorBtn = $.query("section.expression .button.flavor", el);
		this.flavorEl = $.query("#library #tooltip-flavor");
		this.flavorList = new List($.query("ul.list", this.flavorEl), {data:flavorData, template});
		this.flavorList.on("change", ()=>this._onFlavorListChange());
		this.flavorBtn.addEventListener("click", (evt) => this.showFlavors());
		$.query(".icon.help", this.flavorEl).addEventListener("click", ()=> app.sidebar.goto("engine"));
		
		this.flagsBtn = $.query("section.expression .button.flags", el);
		this.flagsEl = $.query("#library #tooltip-flags");
		this.flagsList = new List($.query("ul.list", this.flagsEl), {data:[], multi:true, template});
		this.flagsList.on("change", ()=> this._onFlagListChange());
		this.flagsBtn.addEventListener("click", (evt) => this.showFlags());
		$.query(".icon.help", this.flagsEl).addEventListener("click", ()=> app.sidebar.goto("flags"));
	}

// event handlers:
	_onFlavorListChange() {
		app.tooltip.toggle.hide("flavor");
		app.flavor.value = this.flavorList.selected;
	}
	
	_onFlagListChange() {
		let sel = this.flagsList.selected;
		this.flags = sel ? sel.join("") : "";
	}
	
	_onFlavorChange() {
		let flavor = app.flavor, profile = flavor.profile;
		this.flavorList.selected = profile.id;
		$.query("> .label", this.flavorBtn).innerText = profile.label;
		
		let supported = Expression.FLAGS.split("").filter((n)=>!!profile.flags[n]);
		let labels = Expression.FLAG_LABELS;
		this.flagsList.data = supported.map((n)=>({id:n, label:labels[n]}));
		this.flags = this.flags.split("").filter((n)=>!!profile.flags[n]).join("");
	}
	
	_onEditorMouseDown(cm, evt) {
		// offset by half a character to make accidental clicks less likely:
		let index = CMUtils.getCharIndexAt(cm, evt.clientX - cm.defaultCharWidth() * 0.6, evt.clientY);
		if (index >= cm.getValue().lastIndexOf(this.delim)) {
			this.showFlags();
		}
	}
		
	
	_onEditorChange(cm, evt) {
		// catches pasting full expressions in.
		// TODO: will need to be updated to work with other delimeters
		this._deferUpdate();
		let str = evt.text[0];
		if (str.length < 3 || !str.match(/^\/.+[^\\]\/[a-z]*$/ig) || evt.from.ch !== 1 || evt.to.ch != 1 + evt.removed[0].length) {
			// not pasting a full expression.
			return;
		}
		this.value = str;
	}
	
	_onEditorKeyDown(cm, evt) {
		// Ctrl or Command + D by default, will delete the expression and the flags field, Re: https://github.com/gskinner/regexr/issues/74
		// So we just manually reset to nothing here.
		if ((evt.ctrlKey || evt.metaKey) && evt.keyCode == 68) {
			evt.preventDefault();
			this.pattern = "";
		}
	}
	
	_onMouseError(evt) {
		let tt = app.tooltip.hover, errs = this.lexer.errors;
		if (evt.type === "mouseleave") { return tt.hide("error"); }
		if (errs.length === 0) { return; }
		let err = errs.length === 1 && errs[0].error;
		let str = err ? app.reference.getError(err, errs[0]) : "Problems in the Expression are underlined in <span class='exp-error'>red</span>. Roll over them for details.";
		let label = err && err.warning ? "WARNING" : "PARSE ERROR";
		tt.showOn("error", "<span class='error'>"+label+":</span> "+str, this.errorEl);
	}
	
}

Expression.DEFAULT_EXPRESSION = "/([A-Z])\\w+/g";

Expression.FLAGS = "gimsuxyU"; // for flag order
Expression.FLAG_LABELS = {
	"g": "<em>g</em>lobal",
	"i": "case <em>i</em>nsensitive",
	"m": "<em>m</em>ultiline",
	"s": "<em>s</em>ingle line (dotall)",
	"u": "<em>u</em>nicode",
	"x": "e<em>x</em>tended",
	"y": "stick<em>y</em>",
	"U": "<em>U</em>ngreedy"
};