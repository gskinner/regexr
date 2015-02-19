/*
The MIT License (MIT)

Copyright (c) 2014 gskinner.com, inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
(function() {

	var DocView = function(element) {
		this.initialize(element);
	};
	var p = DocView.prototype;

	DocView.DEFAULT_EXPRESSION = "/([A-Z])\\w+/g";
	DocView.DEFAULT_SUBSTITUTION = "\\n# $&:\\n\\t";
	DocView.VALID_FLAGS = "igm";

	p.isMac = false; // for keyboard shortcuts.
	p.ctrlKey = null;

	// ui:
	p.themeColor = null;

	p.element = null;
	p.expressionCM = null;
	p.sourceCM = null;
	p.sourceCanvas = null;
	p.sourceMeasure = null;
	p.exprResults = null;
	p.exprResultsTooltip = null;

	p.expressionHighlighter = null;
	p.expressionHover = null;

	p.sourceHighlighter = null;
	p.sourceTooltip = null;

	p.substHighlighter = null;
	p.substHover = null;
	p.substCM = null;
	p.substResCM = null;

	p.flagsTooltip = null;
	p.flagsMenu = null;

	p.shareTooltip = null;
	p.saveTooltip = null;

	// state:
	p.matches = null;
	p.error = null;
	p.hoverMatch = null;
	p.exprLexer = null;
	p.substLexer = null;
	p.substEnabled = false;
	p._state = null;

	// timers:
	p.timeoutIDs = null;

	// undo / redo:
	p.history = null;
	p.historyIndex = 0;
	p.maxHistoryDepth = 100;

	// external:
	p.libView = null;


	p.initialize = function(element) {
		this.element = element;
		this.matches = [];
		this.timeoutIDs = {};
		this.exprLexer = new RegExLexer();
		this.substLexer = new SubstLexer();
		this.isMac = Utils.isMac();
		this.themeColor = window.getComputedStyle($.el(".regexr-logo")).color;

		// Set the default state.
		this.setState();

		Docs.content.library.desc = $.el(".lib .content").innerHTML;

		window.onbeforeunload = $.bind(this, this.handleUnload);

		this.buildUI(element);
	};

	p.buildUI = function(el) {
		var expressionEditor = $.el(".editor.expr", el);
		var expCM = this.expressionCM = this.getCM(expressionEditor, {autofocus:true, maxLength:2500, singleLine:true}, "calc(100% - 5.5rem)", "auto");
		expCM.on("change", $.bind(this, this.deferUpdate));
		expCM.on("mousedown", $.bind(this, this.expressionClick));
		expCM.on("change", $.bind(this, this.handleExpressionCMChange));

		this.expressionHighlighter = new ExpressionHighlighter(expCM);
		this.expressionHover = new ExpressionHover(expCM, this.expressionHighlighter);

		this.exprResults = $.el(".expr .results", el);
		this.exprResultsTooltip = Tooltip.add(this.exprResults);

		var sourceEditor = $.el(".editor.source", el);
		var srcCM = this.sourceCM = this.getCM(sourceEditor, {lineWrapping: true});
		srcCM.on("change", $.bind(this, this.deferUpdate));
		srcCM.on("scroll", $.bind(this, this.drawSourceHighlights));

		this.sourceCanvas = $.el(".source canvas", el);
		this.sourceMeasure = $.el(".source .measure", el);

		this.sourceTooltip = Tooltip.add(srcCM.display.lineDiv);
		this.sourceTooltip.on("mousemove", this.sourceMouseMove, this);
		this.sourceTooltip.on("mouseout", this.sourceMouseOut, this);
		this.sourceHighlighter = new SourceHighlighter(srcCM, this.sourceCanvas, this.themeColor);

		var substTitle = $.el(".title.subst", el);
		substTitle.addEventListener("mousedown", $.bind(this, this.onSubstClick));

		var substEditor = $.el(".editor.subst", el);
		var substCM = this.substCM = this.getCM(substEditor, {maxLength:500, singleLine:true}, "100%", "auto");
		substCM.on("change", $.bind(this, this.deferUpdate));
		this.substHighlighter = new ExpressionHighlighter(substCM);
		this.substHover = new ExpressionHover(substCM, this.substHighlighter);

		var substResEditor = $.el(".editor.substres", el);
		this.substResCM = this.getCM(substResEditor, {readOnly:true, lineWrapping: true});

		// Flags
		var flagsBtn = $.el(".button.flags", el);
		this.flagsTooltip = Tooltip.add(flagsBtn, $.el(".menu.flags", el), {mode:"press"});
		this.flagsTooltip.on("show", this.updateFlagsMenu, this);

		this.flagsMenu = new FlagsMenu($.el(".menu.flags", el));
		this.flagsMenu.on("change", this.onFlagsMenuChange, this);
		$.el(".menu.flags .button.help").addEventListener("click", $.bind(this, this.showFlagsHelp));

		// Share
		this.shareMenu = new ShareMenu($.el(".menu.share"), this);
		var shareBtn = $.el(".button.share");
		this.shareTooltip = Tooltip.add(shareBtn, $.el(".menu.share"), {mode:"press", controller:this.shareMenu});

		// Save
		this.saveMenu = new SaveMenu($.el(".menu.save"), this);
		var saveBtn = $.el(".button.save");
		this.saveTooltip = Tooltip.add(saveBtn, $.el(".menu.save"), {mode:"press", controller:this.saveMenu, className:"save"});

		window.addEventListener("resize", $.bind(this, this.deferResize));
		this.deferResize(); // deferring this resolves some issues at certain sizes.
		this.setupUndo();

		this.setInitialExpression();
	};

	p.setInitialExpression= function() {
		var expCM = this.expressionCM;
		expCM.setValue("/./g");
		expCM.getDoc().markText({line:0,ch:0},{line:0,ch:1},{className:"exp-decorator", readOnly:true, atomic:true, inclusiveLeft:true});
		expCM.getDoc().markText({line:0,ch:2},{line:0,ch:4},{className:"exp-decorator", readOnly:false, atomic:true, inclusiveRight:true});
		this.deferUpdate();
	};


// public methods:
	p.populateAll = function(pattern, flags, content, substitution) {
		this.setPattern(pattern);
		this.setFlags(flags);
		this.setText(content);

		if (!this._state.substEnabled && (substitution == null || substitution == "")) {
			substitution = DocView.DEFAULT_SUBSTITUTION;
		}

		this.setSubstitution(substitution);

		if (
			substitution != null &&
			this._state.substEnabled || // Newer saves will have a flag saved.
			substitution != DocView.DEFAULT_SUBSTITUTION // Fallback for old patterns that don't have a saved flag.
		) {
			this.showSubstitution();
		} else {
			this.showSubstitution(false);
		}
		ExpressionModel.saveState();
	};

	p.setExpression = function(expression) {
		var o = this.decomposeExpression(expression);
		return this.setPattern(o.pattern).setFlags(o.flags);
	};

	p.getExpression = function() {
		return this.expressionCM.getValue();
	};

	p.setPattern = function(pattern) {
		var expCM = this.expressionCM;
		var index = expCM.getValue().lastIndexOf("/");
		expCM.replaceRange(pattern, {line:0, ch:1}, {line:0, ch:index});
		this.deferUpdate();
		return this;
	};

	p.getPattern = function() {
		return this.decomposeExpression(this.expressionCM.getValue()).pattern;
	};

	p.getState = function() {

	};

	p.setFlags = function(flags) {
		flags = this.validateFlags(flags);
		var expCM = this.expressionCM;
		var str = expCM.getValue();
		var index = str.lastIndexOf("/");
		expCM.replaceRange(flags, {line:0, ch:index+1}, {line:0, ch:str.length}); // this doesn't work if readOnly is false.
		this.deferUpdate();
		return this;
	};

	p.getFlags = function() {
		return this.decomposeExpression(this.expressionCM.getValue()).flags;
	};

	p.validateFlags = function(flags) {
		var fs="", valid=DocView.VALID_FLAGS;
		for (var i= 0,l=valid.length; i<l; i++) {
			var f = valid[i];
			if (flags.indexOf(f) != -1 && fs.indexOf(f) == -1) { fs+=f; }
		}
		return fs;
	};

	p.toggleFlag = function(flag) {
		var flags = this.getFlags();
		if (flags.indexOf(flag) == -1) { flags += flag; }
		else { flags = flags.replace(flag, ""); }
		this.setFlags(flags);
	};

	p.setText = function(text) {
		if (text == null || text == "") {
			text = DocView.DEFAULT_TEXT;
		}

		this.sourceCM.setValue(text);
		this.deferUpdate();
		return this;
	};

	p.getText = function() {
		return this.sourceCM.getValue();
	};

	p.setSubstitution = function(str) {
		this.substCM.setValue(str);
		this.deferUpdate();
		return this;
	};

	p.getSubstitution = function() {
		return this.substCM.getValue();
	};

	p.insertExpression = function(str) {
		this.expressionCM.replaceSelection(str, "end");
		this.deferUpdate();
		return this;
	};

	p.insertSubstitution = function(str) {
		this.substCM.replaceSelection(str, "end");
		this.deferUpdate(); // unlikely to be chained, so no real need to defer a full update.
		return this;
	};

	p.showSubstitution = function(value) {
		value = value === undefined ? true : value;
		if (this.substEnabled == value) { return; }
		this.substEnabled = value;
		if (value) {
			$.removeClass(this.element, "subst-disabled");
		} else {
			$.addClass(this.element, "subst-disabled");
		}
		this.deferUpdate();
		this.resize();
		this.substCM.refresh();
		this.sourceCM.refresh();
	};

	p.setState = function(value) {
		value = value == null || value == ""?{}:value;

		this._state = {};
		this._state.substEnabled = value.substEnabled == null?false:value.substEnabled;

		this.showSubstitution(this._state.substEnabled);
	};

	/**
	 * Arbitrary values we save with the expression.
	 * Things like substEnabled, or tools.
	 *
	 */
	p.getState = function(value) {
		return {
			substEnabled: this.substEnabled
		};
	};

	p.showSave = function() {
		this.saveTooltip.show();
	};

	p.showShare = function() {
		this.shareTooltip.show();
	};

	p.showFlags = function() {
		this.flagsTooltip.show();
	};

// private:
	// undo/redo:
	p.setupUndo = function() {
		this.history = [];
		var srcCM = this.sourceCM, expCM = this.expressionCM, substCM = this.substCM, _this = this;
		// Note: this is dependent on CodeMirror emitting the historyAdded event from addToHistory()
		// like so: if (!last) { signal(doc, "historyAdded"); }
		srcCM.getDoc().on("historyAdded", function() { _this.addHistory(srcCM); });
		srcCM.setOption("undoDepth", this.maxHistoryDepth);
		expCM.getDoc().on("historyAdded", function() { _this.addHistory(expCM); });
		expCM.setOption("undoDepth", this.maxHistoryDepth);
		substCM.getDoc().on("historyAdded", function() { _this.addHistory(substCM); });
		substCM.setOption("undoDepth", this.maxHistoryDepth);
		window.addEventListener("keydown", $.bind(this, this.handleKeyDown));
	};

	p.handleKeyDown = function(evt) {
		var cmd = this.isMac ? evt.metaKey : evt.ctrlKey;
		if (cmd && ((evt.shiftKey && evt.which == 90) || evt.which==89)) { this.redo(); evt.preventDefault(); }
		else if (cmd && evt.which == 90) { this.undo(); evt.preventDefault(); }
	};

	p.handleUnload = function(evt) {
		if (ExpressionModel.isDirty()) {
			return "You have unsaved edits, are you sure you wish to leave this page?";
		}
	};

	p.addHistory = function(o) {
		var stack = this.history;
		stack.length = this.historyIndex;
		stack.push(o);
		if (stack.length > this.maxHistoryDepth) { stack.shift(); }
		else { this.historyIndex++; }
	};

	p.resetHistory = function() {
		this.historyIndex = this.history.length = 0;
	};

	p.undo = function() {
		if (this.historyIndex === 0) { return; }
		this.history[--this.historyIndex].undo();
	};

	p.redo = function() {
		if (this.historyIndex == this.history.length) { return; }
		this.history[this.historyIndex++].redo();
	};

	p.sourceMouseMove = function(evt) {
		var index, cm=this.sourceCM, oldMatch = this.hoverMatch, matches = this.matches;
		this.hoverMatch = null;

		if (matches.length && (index = CMUtils.getCharIndexAt(cm, evt.clientX, evt.clientY+window.pageYOffset)) != null) {
			for (var i=0,l=matches.length; i<l; i++) {
				var match = matches[i];
				if (match.end < index) { continue; }
				if (match.index > index) { break; }
				this.hoverMatch = match;
			}
		}
		if (oldMatch != this.hoverMatch) { this.drawSourceHighlights(); }
		var rect = (index != null) && CMUtils.getCharRect(cm, index);
		if (rect) { rect.right = rect.left = evt.clientX; }
		this.sourceTooltip.show(Docs.forMatch(this.hoverMatch), rect);
	};

	p.sourceMouseOut = function(evt) {
		if (this.hoverMatch == null) { return; }
		this.hoverMatch = null;
		this.drawSourceHighlights();
	};


	p.expressionClick = function(cm, evt) {
		var index = CMUtils.getCharIndexAt(cm, evt.clientX-cm.defaultCharWidth()*0.6, evt.clientY);
		if (index >= cm.getValue().lastIndexOf("/")) { this.showFlags(); }
	};

	p.resize = function() {
		var rect = this.sourceMeasure.getBoundingClientRect();
		this.sourceCanvas.width = rect.right-rect.left|0;
		this.sourceCanvas.height = rect.bottom-rect.top|0;
		$.removeClass(this.sourceCanvas, "hidden");
		this.drawSourceHighlights();
	};

	p.update = function() {
		this.error = null;

		var regex, matches=this.matches;
		var str = this.sourceCM.getValue();
		var expr = this.expressionCM.getValue();
		var o = this.decomposeExpression(expr);
		var g = o.flags.indexOf("g") != -1;
		this.expressionHighlighter.draw(this.exprLexer.parse(expr));
		this.expressionHover.token = this.exprLexer.token;

		// this is only ok if we are very confident we will not have false errors.
		// used primarily to handle fwdslash errors.
		if (this.exprLexer.errors.length) { this.error = "ERROR"; }

		try { regex = new RegExp(o.pattern, o.flags); }
		catch (e) { this.error = "ERROR"; }
		matches.length = 0;

		var _this = this;
		RegExJS.match(regex, str, function(error, matches) {
			_this.error = error;
			_this.matches = matches;

			_this.updateResults();
			$.defer(_this, _this.drawSourceHighlights, "draw");

			if (ExpressionModel.isDirty()) {
				BrowserHistory.go();
			}

			if (ExpressionModel.id) {
				BrowserHistory.go($.createID(ExpressionModel.id));
			}

			_this.updateSubst(str, regex);
		});
	};

	p.updateSubst = function(source, regex) {
		if (!this.substEnabled) { return; }
		var str = this.substCM.getValue();
		var token = this.substLexer.parse(str, this.exprLexer.captureGroups);

		this.substHighlighter.draw(token);
		this.substHover.token = token;
		if (!this.error && this.substLexer.errors.length === 0) {
			try {  str = eval('"'+str.replace(/"/g,'\\"')+'"'); } catch (e) {
				console.error("UNCAUGHT js string error", e);
			}
			source = source.replace(regex, str);
		}
		this.substResCM.setValue(source);
	};

	p.drawSourceHighlights = function() {
		this.sourceHighlighter.draw(this.matches, this.hoverMatch);
	};

	p.updateResults = function() {
		var str="no match", div=this.exprResults, tip=null, l=this.matches.length;
		$.removeClass(div, "error");
		$.removeClass(div, "nomatch");
		if (this.error) {
			str = this.error;
			$.addClass(div, "error");
			tip = Docs.forErrorResult(str, this.exprLexer.errors);
		} else if (l > 0) {
			str = l+" match"+(l==1 ? "" : "es");
		} else {
			$.addClass(div, "nomatch");
		}
		this.exprResultsTooltip.content = tip;
		div.innerHTML = str;
	};

	p.onSubstClick = function(evt) {
		Tracking.event("substitution", !this.substEnabled?"show":"hide");
		this.showSubstitution(!this.substEnabled);
	};

	p.onFlagsMenuChange = function(evt) {
		this.setFlags(this.flagsMenu.getFlags());
	};

	p.handleExpressionCMChange = function(cm, change) {
		var str = change.text[0];
		if (str.length < 3 || !str.match(/^\/.+[^\\]\/[a-z]*$/ig)) { return; }
		if (change.from.ch != 1 || change.to.ch != 1+change.removed[0].length) { return; }
		this.setExpression(str);
	};

	p.updateFlagsMenu = function() {
		Tracking.event("flags", "show");
		this.flagsMenu.setFlags(this.getFlags());
	};

	p.showFlagsHelp = function(evt) {
		this.flagsTooltip.hide();
		this.libView.show("flags");
	};

	p.deferUpdate = function(t) {
		$.clearDefer("draw");
		$.defer(this, this.update, "update", t);
	};

	p.deferResize = function() {
		this.sourceHighlighter.clear();
		$.addClass(this.sourceCanvas, "hidden");
		$.defer(this, this.resize, "resize", 500);
	};

	p.getCM = function(target, opts, width, height) {
		var cmdKey = Utils.getCtrlKey();
		var keys = {};
		keys[cmdKey+"-Z"] = keys[cmdKey+"-Y"] = keys["Shift-"+cmdKey+"-Z"] = function() { return false; }; // block CM handling

		var o = {
			lineNumbers: false,
			tabSize: 3,
			indentWithTabs: true,
			extraKeys: keys
		};
		if (opts) {
			for (var n in opts) {
				o[n] = opts[n];
			}
		}
		var cm = CodeMirror(target, o);
		cm.setSize(width||"100%", height||"100%");
		if (cm.getOption("maxLength")) { cm.on("beforeChange", CMUtils.enforceMaxLength); }
		if (cm.getOption("singleLine")) { cm.on("beforeChange", CMUtils.enforceSingleLine); }
		return cm;
	};

	p.decomposeExpression = function(expr) {
		var index = expr.lastIndexOf("/");
		return {pattern:expr.substring(1, index), flags:expr.substr(index+1)};
	};

	p.composeExpression = function(pattern, flags) {
		return "/"+pattern+"/"+flags;
	};

window.DocView = DocView;
})();
