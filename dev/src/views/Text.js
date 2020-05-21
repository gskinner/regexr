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

/*
TODO:
Add analytics.
Save / load - don't forget to assign IDs on load.
Server solve.
Issue with CM not updating in Text when loading pattern in Test mode.
*/

import $ from "../utils/DOMUtils";
import Utils from "../utils/Utils";
import UID from "../utils/UID";
import CMUtils from "../utils/CMUtils";
import TextHighlighter from "./TextHighlighter";
import TextHover from "./TextHover";
import EventDispatcher from "../events/EventDispatcher";
import List from "../controls/List";
import Track from "../utils/Track";

import app from "../app";

export default class Text extends EventDispatcher {
	constructor (el) {
		super();
		this.el = el;
		this._initUI(el);
		this._initTestUI(el);
		app.on("result", () => this._setResult(app.result));
		app.theme.on("change", () => this._handleThemeChange());
	}
	
	set value(val) {
		this.editor.setValue(val || this.defaultText);
	}
	
	get value() {
		return this.editor.getValue();
	}

	set tests(val) {
		if (!(val instanceof Array)) {
			val = [];
			$.removeClass(this.testsEl, "tests-added");
		}
		this._tests = this.testList.data = val;
		this._testMatches = null;
		this._reselectTest();
	}

	get tests() {
		return this._tests;
	}

	set mode(val) {
		if (val === this.mode) { return; }
		this.modeList.selected = val || "text";
		this._handleModeChange();
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

	getEmptyTest() {
		return {
			id: UID.id,
			name: "",
			text: "Enter your test text here.",
			type: "any"
		}
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
			Utils.defer(() => this._handleResize(w, h), "text_resize", 250);
		};
		win.onresize();
		
		this.highlighter = new TextHighlighter(editor, canvas, $.getCSSValue("match", "color"), $.getCSSValue("selected-stroke", "color"));
		this.hover = new TextHover(editor, this.highlighter);
	}

	_handleThemeChange() {
		this.highlighter.fill = $.getCSSValue("match", "color");
		this.highlighter.stroke = $.getCSSValue("selected-stroke", "color");
		this.highlighter.redraw();
	}

	_handleModeChange(evt) {
		this.dispatchEvent("modechange");
		if (this.mode === "text") { this.editor.refresh(); }
		else { $.addClass(this.el, "tests-viewed"); }

		Track.page("mode/"+this.mode);
	}
	
	_setResult(val) {
		this._result = val;
		this._testMatches = null;

		if (this.mode !== val.mode) { return; }
		if (val.mode === "tests") {
			this._updateTests();
		} else { // mode === "text"
			this._updateEmptyCount();
			this._updateResult();
			this._updateSelected();
			this._deferUpdate();
		}
	}
	
	_deferUpdate() {
		Utils.defer(()=>this._update(), "Text._update");
	}
	
	_update() {
		let result = this._result, matches = result && result.matches;
		if (result && result.mode === "tests") {
			this._updateTests();
		} else { // mode === "text"
			this.hover.matches = this.highlighter.matches = matches;
		}
	}
	
	_updateResult() {
		let result = this._result, matches=result&&result.matches, l=matches&&matches.length, text;
		
		if (l && result && !result.error) {
			text = l + " match" + (l>1?"es":"") + (this._emptyCount?"*":"");
		} else if (!result || !result.error) {
			text = "No match";
		}
		this._showResult(text);
	}

	_showResult(text, clss) {
		let result = this._result, el = this.resultEl;
		$.removeClass(el, "error warning matches pass fail");

		if (result && result.error) {
			if (!text) { text = result.error.warning ? "WARNING" : "ERROR"; }
			$.addClass(el, "error");
			if (result.error.warning) { $.addClass(el, "warning"); }
		}

		if (clss) { $.addClass(el, clss); }
		el.innerHTML = text;
		if (result.time != null) {  el.innerHTML += "<em> ("+parseFloat(result.time).toFixed(1)+"ms)</em>"; }
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
			let l = this._tests.length;
			if (this.mode === "tests") {
				if (this._tests.length === 0) {
					str += "Use the 'Add Test' button to create a new test.";
				} else if (this._testFails) {
					str += this._testFails+" out of "+l+" tests failed.";
				} else {
					str += "All "+l+" tests passed.";
				}
			} else {
				str += (l||"No")+" match"+(l>1?"es":"")+" found in "+this.value.length+" characters";
				str += this._emptyCount  ? ", including "+this._emptyCount+" empty matches (* not displayed)." : ".";
				let cm = this.editor, sel = cm.listSelections()[0], pos = sel.head;
				let i0 = cm.indexFromPos(pos), i1=cm.indexFromPos(sel.anchor), range=Math.abs(i0-i1);
				str += "<hr>Insertion point: line "+pos.line+", col "+pos.ch+", index "+i0;
				str += (range>0 ? " ("+range+" character"+(range===1?"":"s")+" selected)" : "");
			}
			
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

// Test mode:
	_initTestUI(el) {
		const types = [
			{id:"all", label:"Match Full"},
			{id:"any", label:"Match Any"},
			// {id:"start", label:"Match Start"},
			{id:"none", label:"Match None"},
		];
		this.typeLabels = types.reduce((o, t) => { o[t.id] = t.label; return o; }, {});

		this.testsEl = $.query(".tests", el);
		this.testItemEl = $.query("#library > #tests_item");
		this.testListEl = $.query(".list", this.testsEl);
		this.testList = new List(this.testListEl, {template:(o) => this._testItemTemplate(o)});
		this.testList.scrollEl = this.testsEl;

		this.testList.on("change", (evt) => this._handleTestChange(evt));

		$.on($.queryAll(".button.add", el), "click", ()=>this._addTest());

		const template = $.template`<svg class="inline check icon"><use xlink:href="#check"></use></svg> ${"label"}`;
		this.typesEl = $.query("#library #tooltip-testtypes");
		this.typesList = new List($.query("ul.list", this.typesEl), {data:types, template});
		this.typesList.on("change", ()=> this._handleTypesChange());

		this.tests = null;
	}

	_updateTests() {
		let result = this._result;
		if (result.error) { return this._showResult(); }

		let data = this._tests, l=data.length;
		if (!data || !l) { return this._showResult("No tests."); }
		
		let matches = result.matches.reduce((o, t) => { o[t.id] = t; return o; }, {}), fails=0;
		for (let i=0; i<l; i++) {
			let test = data[i], match=matches[test.id], pass=false, el=this.testList.getEl(test.id);
			if (test.type === "none") {
				pass = (match.i == null);
			} else if (test.type === "all") {
				pass = (match.l === test.text.length);
			} else if (test.type === "start") {
				pass = (match.i === 0);
			} else { // any
				pass = (match.i != null);
			}
			$.toggleClass(el, "fail", !pass);
			if (!pass) { fails++; }
		}

		this._testFails = fails;
		this._testMatches = matches;
		if (fails) {
			this._showResult(fails+" FAILED", "fail");
		} else {
			this._showResult("PASSED", "pass");
		}
		
		this._updateSelTest();
	}

	_updateSelTest() {
		if (this._testMark) { this._testMark.clear(); }
		let matches = this._testMatches, el = this.testList.selectedEl;
		if (!el || !matches) { return; }
		let match = matches[this.testList.selected], cm = this.testEditor;
		if (match && match.i != null) {
			let pos = CMUtils.calcRangePos(cm, match.i, match.l);
			this._testMark = this.testEditor.getDoc().markText(pos.startPos, pos.endPos, {className:"match"});
		}
	}

	_testItemTemplate(o) {
		let el = this.testItemEl.cloneNode(true);
		let typeBtn = $.query("header .button.type", el);
		typeBtn.addEventListener("click", (evt) => this._showTypes(typeBtn, o));

		let delBtn = $.query("header .delete", el);
		delBtn.addEventListener("click", (evt) => this._deleteTest(o));

		let nameFld = $.query("header .name", el);
		nameFld.addEventListener("input", () => this._handleTestNameChange(nameFld, o));

		this._updateTestHeader(o, el, false);

		return el;
	}

	_updateTestHeader(o, el, edit) {
		let nameFld = $.query("header .name", el);
		nameFld.value = o.name||"";
		nameFld.placeholder = o.text && !edit ? o.text.substr(0, 100) : "Untitled Test";

		let typeLbl = $.query("header .button.type .label", el);
		typeLbl.innerText = this.typeLabels[o.type];
	}

	_addTest() {
		const o = this.getEmptyTest();
		this._tests.push(o);
		this.testList.addItem(o, true);
		this._handleTestChange();
		this.testEditor.execCommand("selectAll");
		$.addClass(this.testsEl, "tests-added");
		this._change();
	}

	_reselectTest() {
		if (this._selTest) {
			this.testList.selected = this._selTest.id;
		}
		if (!this._selTest || this.testList.selected == null) {
			this.testList.selectedIndex = 0;
		}
		this._selTest = null;
		this._handleTestChange();
	}

	_handleTestChange() {
		let el, o;
		if (this._selTest) {
			o = this._selTest;
			el = this.testList.getEl(o.id);
			this._updateTestHeader(o, el, false);
		}

		el = this.testList.selectedEl;
		o = this._selTest = this.testList.selectedItem;

		if (!o) { return; }

		this._getTestEditor($.query("article .editor .pad", el), o);
		this._updateTestHeader(o, el, true);
		this._updateSelTest();
		this.testEditor.focus();
		this.testEditor.setCursor(this.testEditor.lineCount(), 0);
	}

	_handleTestNameChange(fld, o) {
		o.name = fld.value;
		this._change();
	}

	_handleTypesChange() {
		let el = this.testList.selectedEl, o = this.testList.selectedItem;
		o.type = this.typesList.selectedItem.id;
		app.tooltip.toggle.hide("testtypes");
		this._updateTestHeader(o, el, true);
		this._change();
	}

	_handleTestTextChange(change) {
		this._selTest.text = this.testEditor.getValue();
		if (change.origin !== "setValue") { this._change(); }
	}

	_showTypes(el, o) {
		this.typesList.selected = o.type;
		app.tooltip.toggle.toggleOn("testtypes", this.typesEl, el, true, -2);
	}

	_deleteTest(o) {
		let data = this._tests;
		let i = data.indexOf(o);
		data.splice(i, 1);
		this._selTest = null;
		this.testList.removeItem(o.id);
		if (data.length) { this.testList.selected = data[Math.min(i, data.length-1)].id; }
		this._updateTests();
		this._handleTestChange();
		this._change();
	}

	_getTestEditor(el, o) {
		let cm = this.testEditor;
		if (!cm) {
			cm = this.testEditor = CMUtils.create($.empty(el), {lineWrapping: true}, "100%", "100%");
			cm.on("change", (a, b) => this._handleTestTextChange(b));
		} else {
			el.appendChild(cm.getWrapperElement());
		}
		cm.setValue(o.text);
	}
}
