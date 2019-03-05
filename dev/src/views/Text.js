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
import CMUtils from "../utils/CMUtils";
import TextHighlighter from "./TextHighlighter";
import TextHover from "./TextHover";
import EventDispatcher from "../events/EventDispatcher";
import List from "../controls/List";

import app from "../app";

export default class Text extends EventDispatcher {
	constructor (el) {
		super();
		this.el = el;
		this._initUI(el);
		app.on("result", () => this._setResult(app.result));
	}
	
	set value(val) {
		this.editor.setValue(val || this.defaultText);
	}
	
	get value() {
		return this.editor.getValue();
	}

	set mode(val) {
		this.modeList.selected = val;
		this._updateMode();
	}

	get mode() {
		return this.modeList.selected;
	}
	
	get selectedMatch() {
		let cm = this.editor;
		return this.getMatchAt(cm.indexFromPos(cm.getCursor()), true);
	}
	
	getMatchValue(match) {
		// this also works for groups.
		return match ? this.value.substr(match.i, match.l) : null;
	}
	
	getMatchAt(index, inclusive) {
		// also used by TextHover
		let match, offset=(inclusive ? -1 : 0), matches=this._result && this._result.matches;
		if (!matches) { return null; }
		for (let i = 0, l = matches.length; i < l; i++) {
			match = matches[i];
			if (match.l+match.i-1 < index + offset) { continue; }
			if (match.i > index) { break; }
			return match;
		}
		return null;
	}
	
// private methods:
	_initUI(el) {
		this.resultEl = $.query("> header .result", el);
		this.resultEl.addEventListener("mouseenter", (evt)=>this._mouseResult(evt));
		this.resultEl.addEventListener("mouseleave", (evt)=>this._mouseResult(evt));

		this.modeListEl = $.query("> header .modelist", el);
		let data = ["Text", "Tests"].map((val) => ({label:val, id:val.toLowerCase()}));
		this.modeList = new List(this.modeListEl, {data});
		this.modeList.on("change", ()=> this._handleModeChange());
		this.modeList.selected = "text";
		
		let textEl = $.query(".editor > .pad", el);
		this.defaultText = $.query("textarea", textEl).value;
		let editor = this.editor = CMUtils.create($.empty(textEl), {lineWrapping: true}, "100%", "100%");
		editor.setValue(this.defaultText);
		
		editor.on("change", ()=> this._change());
		editor.on("scroll", ()=> this._update());
		editor.on("cursorActivity", () => this._updateSelected());
		
		let detector = $.create("iframe", "resizedetector", null, textEl), win = detector.contentWindow;
		let canvas = this.canvas = $.create("canvas", "highlights", null, textEl);
		textEl.appendChild(editor.display.wrapper); // move the editor on top of the iframe & canvas.

		win.onresize = ()=> {
			let w = win.innerWidth|0, h = win.innerHeight|0;
			this._startResize();
			Utils.defer(()=>this._handleResize(w, h), "text_resize", 250);
		};
		win.onresize();
		
		this.highlighter = new TextHighlighter(editor, canvas, $.getCSSValue("match", "color"), $.getCSSValue("selected-stroke", "color"));
		this.hover = new TextHover(editor, this.highlighter);

		// test mode:
		this.testItemEl = $.query("#library > #tests_item");
		this.testListEl = $.query(".tests .list", el);
		this.testList = new List(this.testListEl, {template:(o) => this._testItemTemplate(o)});
		this.testList.data = [];

		this.testList.on("change", (evt) => this._handleTestChange(evt));

		let addTestBtn = $.query("> header .button.add", el);
		addTestBtn.addEventListener("click", ()=>this._addTest());

		let matchtypes = [
			{id:"all", label:"Match All"},
			{id:"any", label:"Match Any"},
			{id:"none", label:"Match None"},

		]
		const template = $.template`<svg class="inline check icon"><use xlink:href="#check"></use></svg> ${"label"}`;
		this.matchtypesEl = $.query("#library #tooltip-matchtypes");
		this.matchtypesList = new List($.query("ul.list", this.matchtypesEl), {data:matchtypes, template});
		this.matchtypesList.on("change", ()=> this._handleMatchtypesChange());
	}

	_updateMode() {

	}

	_handleModeChange(evt) {
		this._updateMode();
		this.dispatchEvent("modechange");
	}

	_testItemTemplate(o) {
		let el = this.testItemEl.cloneNode(true);
		let typeBtn = $.query("header .button.matchtype", el);
		typeBtn.addEventListener("click", (evt) => this._showMatchtypes(typeBtn));

		let delBtn = $.query("header .delete", el);
		delBtn.addEventListener("click", (evt) => this._deleteTest(o));
		return el;
	}

	_addTest() {
		// TODO: update data.
		this.testList.addItem({id:Math.random()+"_"}, true);
	}

	_handleTestChange() {
		let el, o, typeBtn;
		if (this._selTest) {
			// clean up?
		}

		el = this.testList.selectedEl;
		o = this.testList.selectedItem;

		this._getTestEditor($.query("article .editor .pad", el), o);
		this._selTest = o;
	}

	_handleMatchtypesChange() {
		// TODO: update data.
		let el = this.testList.selectedEl;
		let typeBtn = $.query("header .button.matchtype", el);
		$.query(".label", typeBtn).innerText = this.matchtypesList.selectedItem.label;
		app.tooltip.toggle.hide("matchtypes");
	}

	_showMatchtypes(el) {
		app.tooltip.toggle.toggleOn("matchtypes", this.matchtypesEl, el, true, -2);
	}

	_deleteTest(o) {
		this.testList.removeItem(o.id);
		// TODO: figure out which is next and select it.
		// TODO: update data.
		// TODO: confirm?
		console.log(this.testList.data[0].id);
		this.testList.selected = this.testList.data[0].id;
	}

	_getTestEditor(el, o) {
		let editor = this.testEditor;
		if (!editor) {
			editor = this.testEditor = CMUtils.create($.empty(el), {lineWrapping: true}, "100%", "100%");;
		} else {
			el.appendChild(editor.getWrapperElement());
		}
		editor.setValue("id: "+o.id);
	}
	
	_setResult(val) {
		this._result = val;
		this._updateEmptyCount();
		this._updateResult();
		this._deferUpdate();
	}
	
	_updateResult() {
		let result = this._result, matches=result&&result.matches, l=matches&&matches.length, el = this.resultEl;
		$.removeClass(el, "error warning matches");
		if (result && result.error) {
			el.innerText = result.error.warning ? "WARNING" : "ERROR";
			$.addClass(el, "error");
			if (result.error.warning) { $.addClass(el, "warning"); }
		} else if (l) {
			el.innerHTML = l + " match" + (l>1?"es":"") + (this._emptyCount?"*":"");
			$.addClass(el, "matches");
		} else {
			el.innerText = "No match";
		}
		if (result.time != null) {  el.innerHTML += "<em> ("+parseFloat(result.time).toFixed(1)+"ms)</em>"; }
		this._updateSelected();
	}
	
	_updateSelected() {
		let match = this.selectedMatch;
		if (this.highlighter.selectedMatch === match) { return; }
		this.highlighter.selectedMatch = match;
		this.dispatchEvent("select");
	}
	
	_change() {
		this.dispatchEvent("change");
	}
	
	_deferUpdate() {
		Utils.defer(()=>this._update(), "Text._update");
	}
	
	_update() {
		let result = this._result, matches = result && result.matches;
		this.hover.matches = this.highlighter.matches = matches;
	}

	_startResize() {
		let canvas = this.canvas, style=canvas.style;
		style.visibility = "hidden";
		style.opacity = 0;
		// keeps it from causing scrollbars:
		canvas.width = canvas.height = 1;
	}
	
	_mouseResult(evt) {
		let tt = app.tooltip.hover, res=this._result, err = res&&res.error, str="";
		if (evt.type === "mouseleave") { return tt.hide("result"); }
		if (err && !err.warning) {
			str = "<span class='error'>EXEC ERROR:</span> " + this._errorText(err);
		} else {
			if (err && err.warning) {
				str = "<span class='error warning'>WARNING:</span> "+ this._errorText(err) + "<hr>";
			}
			let l = res&&res.matches&&res.matches.length;
			str += (l||"No")+" match"+(l>1?"es":"")+" found in "+this.value.length+" characters";
			str += this._emptyCount  ? ", including "+this._emptyCount+" empty matches (* not displayed)." : ".";
			let cm = this.editor, sel = cm.listSelections()[0], pos = sel.head;
			let i0 = cm.indexFromPos(pos), i1=cm.indexFromPos(sel.anchor), range=Math.abs(i0-i1);
			str += "<hr>Insertion point: line "+pos.line+", col "+pos.ch+", index "+i0;
			str += (range>0 ? " ("+range+" character"+(range===1?"":"s")+" selected)" : "")
		}
		tt.showOn("result", str, this.resultEl, false, -2);
	}

	_updateEmptyCount() {
		let result = this._result, matches = result && result.matches;
		this._emptyCount = matches ? matches.reduce((v,o)=>v+(o.l?0:1),0) : 0;
	}
	
	_errorText(err) {
		return err.message || app.reference.getError(err);
	}
	
	_handleResize(w, h) {
		let canvas = this.canvas, style=canvas.style;
		style.visibility = style.opacity = "";
		canvas.width = w;
		canvas.height = h;
		this.editor.refresh();
		this._deferUpdate();
	}
}