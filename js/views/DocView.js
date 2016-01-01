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

var CMUtils = require('../utils/CMUtils');
var TextUtils = require('../utils/TextUtils');
var ExpressionHighlighter = require('../ExpressionHighlighter');
var ExpressionHover = require('../ExpressionHover');
var ExpressionModel = require('../net/ExpressionModel');
var Tooltip = require('../controls/Tooltip');
var SourceHighlighter = require('../SourceHighlighter');
var FlagsMenu = require('../views/FlagsMenu');
var ShareMenu = require('../views/ShareMenu');
var SaveMenu = require('../views/SaveMenu');
var TagInput = require('../controls/TagInput');
var RegExJS = require('../RegExJS');
var Tracking = require('../Tracking');
var RegExLexer = require('../RegExLexer');
var BrowserHistory = require('../BrowserHistory');
var SubstLexer = require('../SubstLexer');

var Docs = require('../utils/Docs');
var Graph = require('../utils/Graph');
var CodeMirror = require('codemirror');

var DocView = function (element) {
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

p.toolsHighlighter = null;
p.toolsHover = null;
p.toolsCM = null;
p.toolsResCM = null;
p.toolsResults = null;

p.flagsTooltip = null;
p.flagsMenu = null;

p.shareTooltip = null;
p.saveTooltip = null;

// state:
p.matches = null;
p.error = null;
p.hoverMatch = null;
p.exprLexer = null;
p.toolsLexer = null;
p.tool = null;
p.toolEnabled = false;
p._state = null;

// timers:
p.timeoutIDs = null;

// undo / redo:
p.history = null;
p.historyIndex = 0;
p.maxHistoryDepth = 100;

// external:
p.libView = null;

p.initialize = function (element) {
	this.element = element;
	this.matches = [];
	this.timeoutIDs = {};
	this.exprLexer = new RegExLexer();
	this.toolsLexer = new SubstLexer();
	this.isMac = $.isMac();
	this.themeColor = window.getComputedStyle($.el(".regexr-logo")).color;

	Docs.content.library.desc = $.el(".lib .content").innerHTML;

	window.onbeforeunload = $.bind(this, this.handleUnload);

	this.buildUI(element);

	// Set the default state.
	this.setState();
};

p.buildUI = function (el) {
	var expressionEditor = $.el(".editor.expr", el);
	var expCM = this.expressionCM = this.getCM(expressionEditor, {
		autofocus: true,
		maxLength: 2500,
		singleLine: true
	}, "calc(100% - 5.5rem)", "auto");
	expCM.on("change", $.bind(this, this.deferUpdate));
	expCM.on("mousedown", $.bind(this, this.expressionClick));
	expCM.on("change", $.bind(this, this.handleExpressionCMChange));
    expCM.on("keydown", $.bind(this, this.handleExpressionCMKeyDown));

	this.expressionHighlighter = new ExpressionHighlighter(expCM);
	this.expressionHover = new ExpressionHover(expCM, this.expressionHighlighter);

	this.exprResults = $.el(".expr .results", el);
	this.exprResultsTooltip = Tooltip.add(this.exprResults);

	var sourceEditor = $.el(".editor.source", el);
	var srcCM = this.sourceCM = this.getCM(sourceEditor, {lineWrapping: true});
	srcCM.on("change", $.bind(this, this.deferUpdate));
	srcCM.on("scroll", $.bind(this, this.drawSourceHighlights));
	srcCM.on("cursorActivity", $.bind(this, this.handleSrcCursorActivity))

	this.sourceCanvas = $.el(".source canvas", el);
	this.sourceMeasure = $.el(".source .measure", el);

	this.sourceTooltip = Tooltip.add(srcCM.display.lineDiv);
	this.sourceTooltip.on("mousemove", this.sourceMouseMove, this);
	this.sourceTooltip.on("mouseout", this.sourceMouseOut, this);
	this.sourceHighlighter = new SourceHighlighter(srcCM, this.sourceCanvas, this.themeColor);

	var toolsTitle = $.el(".title.tools", el);
	toolsTitle.addEventListener("mousedown", $.bind(this, this.onToolsClick));

	var toolsEditor = $.el(".tools.editor.in", el);
	var toolsCM = this.toolsCM = this.getCM(toolsEditor, {
		maxLength: 500,
		singleLine: true
	}, "100%", "auto");
	toolsCM.on("change", $.bind(this, this.deferUpdate));
	this.toolsHighlighter = new ExpressionHighlighter(toolsCM);
	this.toolsHover = new ExpressionHover(toolsCM, this.toolsHighlighter);

	var toolsResEditor = $.el(".tools.editor.out", el);
	this.toolsResCM = this.getCM(toolsResEditor, {
		readOnly: true,
		lineWrapping: true
	});
	
	this.toolsResults = $.el(".tools.results");

	// Flags
	var flagsBtn = $.el(".button.flags", el);
	this.flagsTooltip = Tooltip.add(flagsBtn, $.el(".menu.flags", el), {mode: "press"});
	this.flagsTooltip.on("show", this.updateFlagsMenu, this);

	this.flagsMenu = new FlagsMenu($.el(".menu.flags", el));
	this.flagsMenu.on("change", this.onFlagsMenuChange, this);
	$.el(".menu.flags .button.help").addEventListener("click", $.bind(this, this.showFlagsHelp));

	// Share
	this.shareMenu = new ShareMenu($.el(".menu.share"), this);
	var shareBtn = $.el(".button.share");
	this.shareTooltip = Tooltip.add(shareBtn, $.el(".menu.share"), {
		mode: "press",
		controller: this.shareMenu
	});

	// Save
	this.saveMenu = new SaveMenu($.el(".menu.save"), this);
	var saveBtn = $.el(".button.save");
	this.saveTooltip = Tooltip.add(saveBtn, $.el(".menu.save"), {
		mode: "press",
		controller: this.saveMenu,
		className: "save"
	});

	window.addEventListener("resize", $.bind(this, this.deferResize));
	this.deferResize(); // deferring this resolves some issues at certain sizes.
	this.setupUndo();

	this.setInitialExpression();
};

p.setInitialExpression = function () {
	var expCM = this.expressionCM;
	expCM.setValue("/./g");
	expCM.getDoc().markText({line: 0, ch: 0}, {
		line: 0,
		ch: 1
	}, {
		className: "exp-decorator",
		readOnly: true,
		atomic: true,
		inclusiveLeft: true
	});
	expCM.getDoc().markText({line: 0, ch: 2}, {
		line: 0,
		ch: 4
	}, {
		className: "exp-decorator",
		readOnly: false,
		atomic: true,
		inclusiveRight: true
	});
	this.deferUpdate();
};

// public methods:
p.populateAll = function (pattern, flags, content, substitution) {
	this.setPattern(pattern);
	this.setFlags(flags);
	this.setText(content);

	if (!this._state.toolsEnabled && (substitution == null || substitution == "")) {
		substitution = DocView.DEFAULT_SUBSTITUTION;
	}

	this.setSubstitution(substitution);

	if (
			substitution != null &&
			this._state.toolsEnabled || // Newer saves will have a flag saved.
			substitution != DocView.DEFAULT_SUBSTITUTION // Fallback for old patterns that don't have a saved flag.
	) {
		this.showSubstitution();
	} else {
		this.showSubstitution(false);
	}
	ExpressionModel.saveState();
};

p.setExpression = function (expression) {
	var o = this.decomposeExpression(expression);
	return this.setPattern(o.pattern).setFlags(o.flags);
};

p.getExpression = function () {
	return this.expressionCM.getValue();
};

p.setPattern = function (pattern) {
	var expCM = this.expressionCM;
	var index = expCM.getValue().lastIndexOf("/");
	expCM.replaceRange(pattern, {line: 0, ch: 1}, {line: 0, ch: index});
	this.deferUpdate();
	return this;
};

p.getPattern = function () {
	return this.decomposeExpression(this.expressionCM.getValue()).pattern;
};

p.setFlags = function (flags) {
	flags = this.validateFlags(flags);
	var expCM = this.expressionCM;
	var str = expCM.getValue();
	var index = str.lastIndexOf("/");
	expCM.replaceRange(flags, {line: 0, ch: index + 1}, {
		line: 0,
		ch: str.length
	}); // this doesn't work if readOnly is false.
	this.deferUpdate();
	return this;
};

p.getFlags = function () {
	return this.decomposeExpression(this.expressionCM.getValue()).flags;
};

p.validateFlags = function (flags) {
	var fs = "", valid = DocView.VALID_FLAGS;
	for (var i = 0, l = valid.length; i < l; i++) {
		var f = valid[i];
		if (flags.indexOf(f) != -1 && fs.indexOf(f) == -1) {
			fs += f;
		}
	}
	return fs;
};

p.toggleFlag = function (flag) {
	var flags = this.getFlags();
	if (flags.indexOf(flag) == -1) {
		flags += flag;
	}
	else {
		flags = flags.replace(flag, "");
	}
	this.setFlags(flags);
};

p.setText = function (text) {
	if (text == null || text == "") {
		text = DocView.DEFAULT_TEXT;
	}

	this.sourceCM.setValue(text);
	this.deferUpdate();
	return this;
};

p.getText = function () {
	return this.sourceCM.getValue();
};

p.setSubstitution = function (str) {
	// TODO: setTool
	this.toolsCM.setValue(str);
	this.deferUpdate();
	return this;
};

p.getSubstitution = function () {
	// TODO: ??
	return this.toolsCM.getValue();
};

p.insertExpression = function (str) {
	this.expressionCM.replaceSelection(str, "end");
	this.deferUpdate();
	return this;
};

p.insertSubstitution = function (str) {
	// TODO: setTool
	this.toolsCM.replaceSelection(str, "end");
	this.deferUpdate(); // unlikely to be chained, so no real need to defer a full update.
	return this;
};

p.showTool = function (value) {
	if (this.toolEnabled == value) { return; }
	this.toolEnabled = value;
	if (value) {
		$.removeClass(this.element, "tools-disabled");
	} else {
		$.addClass(this.element, "tools-disabled");
	}
	this.deferUpdate();
	this.resize();
	this.toolsCM.refresh();
	this.sourceCM.refresh();
};

p.setTool = function(tool) {
	if (tool == this.tool) { return; }
	var el;
	if (this.tool) {
		el = $.el(".tools.title .button."+this.tool);
		$.removeClass(el,"active");
	}
	this.tool = tool;
	el = $.el(".tools.title .button."+this.tool);
	$.addClass(el,"active");
	
	if (tool == "details" || tool == "graph") {
		$.addClass(this.element, "tools-results");
	} else {
		$.removeClass(this.element, "tools-results");
	}
	
	this.updateTool();
}

p.setState = function (value) {
	value = value || {};
	var tool = value.toolsEnabled ? "subst" : value.tool;
	
	this._state = {tool:tool};
	this.showTool(!!tool);
	this.setTool(tool||"subst");
};

/**
 * Arbitrary values we save with the expression.
 * Things like toolsEnabled, or tools.
 *
 */
p.getState = function (value) {
	var tool = this.toolEnabled ? this.tool : null;
	return { tool:tool };
};

p.showSave = function () {
	this.saveTooltip.show();
};

p.showShare = function () {
	this.shareTooltip.show();
};

p.showFlags = function () {
	this.flagsTooltip.show();
};

// private:
// undo/redo:
p.setupUndo = function () {
	this.history = [];
	var srcCM = this.sourceCM, expCM = this.expressionCM, toolsCM = this.toolsCM, _this = this;
	// Note: this is dependent on CodeMirror emitting the historyAdded event from addToHistory()
	// like so: if (!last) { signal(doc, "historyAdded"); }
	srcCM.getDoc().on("historyAdded", function () {
		_this.addHistory(srcCM);
	});
	srcCM.setOption("undoDepth", this.maxHistoryDepth);
	expCM.getDoc().on("historyAdded", function () {
		_this.addHistory(expCM);
	});
	expCM.setOption("undoDepth", this.maxHistoryDepth);
	toolsCM.getDoc().on("historyAdded", function () {
		_this.addHistory(toolsCM);
	});
	toolsCM.setOption("undoDepth", this.maxHistoryDepth);
	window.addEventListener("keydown", $.bind(this, this.handleKeyDown));
};

p.handleKeyDown = function (evt) {
	var cmd = this.isMac ? evt.metaKey : evt.ctrlKey;
	if (cmd && ((evt.shiftKey && evt.which == 90) || evt.which == 89)) {
		this.redo();
		evt.preventDefault();
	}
	else if (cmd && evt.which == 90) {
		this.undo();
		evt.preventDefault();
	}
};

p.handleUnload = function (evt) {
	if (ExpressionModel.isDirty()) {
		return "You have unsaved edits, are you sure you wish to leave this page?";
	}
};

p.addHistory = function (o) {
	var stack = this.history;
	stack.length = this.historyIndex;
	stack.push(o);
	if (stack.length > this.maxHistoryDepth) {
		stack.shift();
	} else {
		this.historyIndex++;
	}
};

p.resetHistory = function () {
	this.historyIndex = this.history.length = 0;
};

p.undo = function () {
	if (this.historyIndex === 0) {
		return;
	}
	this.history[--this.historyIndex].undo();
};

p.redo = function () {
	if (this.historyIndex == this.history.length) {
		return;
	}
	this.history[this.historyIndex++].redo();
};

p.sourceMouseMove = function (evt) {
	var index, cm = this.sourceCM, oldMatch = this.hoverMatch, matches = this.matches;
	this.hoverMatch = null;

	if (matches.length && (index = CMUtils.getCharIndexAt(cm, evt.clientX, evt.clientY + window.pageYOffset)) != null) {
		this.hoverMatch = this.getMatchAt(index);
	}
	if (oldMatch != this.hoverMatch) {
		this.drawSourceHighlights();
	}
	var rect = (index != null) && CMUtils.getCharRect(cm, index);
	if (rect) {
		rect.right = rect.left = evt.clientX;
	}
	this.sourceTooltip.show(Docs.forMatch(this.hoverMatch), rect);
};

p.sourceMouseOut = function (evt) {
	if (this.hoverMatch == null) {
		return;
	}
	this.hoverMatch = null;
	this.drawSourceHighlights();
};

p.expressionClick = function (cm, evt) {
	var index = CMUtils.getCharIndexAt(cm, evt.clientX - cm.defaultCharWidth() * 0.6, evt.clientY);
	if (index >= cm.getValue().lastIndexOf("/")) {
		this.showFlags();
	}
};

p.resize = function () {
	var rect = this.sourceMeasure.getBoundingClientRect();
	this.sourceCanvas.width = rect.right - rect.left | 0;
	this.sourceCanvas.height = rect.bottom - rect.top | 0;
	$.removeClass(this.sourceCanvas, "hidden");
	this.drawSourceHighlights();
};

p.update = function () {
	this.error = null;

	var matches = this.matches;
	var str = this.sourceCM.getValue();
	var expr = this.expressionCM.getValue();
	var regex = this.getRegEx();
	this.expressionHighlighter.draw(this.exprLexer.parse(expr));
	this.expressionHover.token = this.exprLexer.token;
	matches.length = 0;
	
	// this is only ok if we are very confident we will not have false errors.
	// used primarily to handle fwdslash errors.
	if (this.exprLexer.errors.length || !regex) {
		this.error = "ERROR";
		this.updateTool();
		this.updateResults();
		return;
	}

	var _this = this;
	RegExJS.match(regex, str, function (error, matches) {
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

		_this.updateTool(str, regex);
	});
};

p.getRegEx = function(global) {
	var regex, o = this.decomposeExpression(this.expressionCM.getValue());
	
	if (global === true && o.flags.indexOf("g") === -1) { o.flags += "g"; }
	else if (global === false) { o.flags = o.flags.replace("g",""); }
	
	try {
		regex = new RegExp(o.pattern, o.flags);
	} catch (e) {}
	return regex;
}

p.updateTool = function (source, regex) {
	if (!this.toolEnabled) { return; }
	source = source||this.sourceCM.getValue();
	var result = "";
	if (this.error) {
		// nothing, empty result
	} else if (this.tool == "subst" || this.tool == "matches") {
		var str = this.toolsCM.getValue();
		var token = this.toolsLexer.parse(str, this.exprLexer.captureGroups);
	
		this.toolsHighlighter.draw(token);
		this.toolsHover.token = token;
		if (this.toolsLexer.errors.length === 0) {
			try {
				str = eval('"' + str.replace(/"/g, '\\"') + '"');
			} catch (e) {
				console.error("UNCAUGHT js string error", e);
			}
			if (this.tool == "subst") {
				result = source.replace(regex || this.getRegEx(), str);
			} else {
				var repl, ref, regex = this.getRegEx(false);
				if (str.search(/\$[&1-9`']/) === -1) { str = "$&"+str; }
				while (true) {
					ref = source.replace(regex, "\b");
					var index = ref.indexOf("\b");
					if (index === -1) { break; }
					repl = source.replace(regex, str);
					result += repl.substr(index, repl.length-ref.length+1);
					source = ref.substr(index+1);
				}
			}
		}
		this.toolsResCM.setValue(result);
	} else if (this.tool == "details") {
		var cm = this.sourceCM, match=this.getMatchAt(cm.indexFromPos(cm.getCursor()), true);
		
		if (match) {
			result += "<h1><b>Match #"+match.num+"</b>"+ 
				"  <b>Length:</b> "+(match.end-match.index+1)+ 
				"  <b>Range:</b> "+match.index+"-"+match.end+"</h1>"+
				"<p>"+TextUtils.htmlSafe(match[0])+"</p>";
				
			for (var i=1; i<match.length; i++) {
				result += "<h1><b>Group #"+i+"</b>"+
					"  <b>Length:</b> "+match[i].length+"</h1>"+
					"<p>"+TextUtils.htmlSafe(match[i])+"</p>";
			}
		} else {
			result = "<i>click a <span class='match'>match</span> above for details</i>";
		}
		$.el(".content",this.toolsResults).innerHTML = "<code><pre>"+result+"</code></pre>";
	} else if (this.tool == "graph") {
		var token = this.exprLexer.token, expr = this.expressionCM.getValue();
		result = Graph.forExpression(expr, token);
		$.empty($.el(".content",this.toolsResults)).appendChild(result);
	}
};

p.getMatchAt = function(index, inclusive) {
	var match, matches=this.matches,offset=(inclusive ? -1 : 0);
	for (var i = 0, l = matches.length; i < l; i++) {
		match = matches[i];
		if (match.end < index + offset) {
			continue;
		}
		if (match.index > index) {
			break;
		}
		return match;
	}
};

p.drawSourceHighlights = function () {
	this.sourceHighlighter.draw(this.matches, this.hoverMatch);
};

p.updateResults = function () {
	var str = "no match", div = this.exprResults, tip = null, l = this.matches.length;
	$.removeClass(div, "error");
	$.removeClass(div, "nomatch");
	if (this.error) {
		str = this.error;
		$.addClass(div, "error");
		tip = Docs.forErrorResult(str, this.exprLexer.errors);
	} else if (l > 0) {
		str = l + " match" + (l == 1 ? "" : "es");
	} else {
		$.addClass(div, "nomatch");
	}
	this.exprResultsTooltip.content = tip;
	div.innerHTML = str;
};

p.onToolsClick = function (evt) {
	var el = $.el(".tools.title .buttonbar.left");
	if (!el.contains(evt.target) && this.toolEnabled) {
		// click on the bar, not a tool.
		this.showTool(false);
		return;
	}
	if (!this.toolEnabled) { this.showTool(true); }
	Tracking.event("substitution", !this.toolEnabled ? "show" : "hide"); // TODO: update.
	var tool = evt.target.dataset.tool;
	if (tool) { this.setTool(tool); }
};

p.onFlagsMenuChange = function (evt) {
	this.setFlags(this.flagsMenu.getFlags());
};

p.handleExpressionCMKeyDown = function (cm, event) {
	// Ctrl or Command + D by default, will delete the expression and the flags field, Re: https://github.com/gskinner/regexr/issues/74
	// So we just manually reset to nothing here.
	if ((event.ctrlKey || event.metaKey) && event.keyCode == 68) {
		event.preventDefault();
		this.setExpression('//'+this.getFlags());
	}
};

p.handleExpressionCMChange = function (cm, change) {
	var str = change.text[0];
	if (str.length < 3 || !str.match(/^\/.+[^\\]\/[a-z]*$/ig)) {
		return;
	}
	if (change.from.ch != 1 || change.to.ch != 1 + change.removed[0].length) {
		return;
	}
	this.setExpression(str);
};

p.handleSrcCursorActivity = function(cm) {
	if (this.tool === "details") { this.updateTool(); }
};

p.updateFlagsMenu = function () {
	Tracking.event("flags", "show");
	this.flagsMenu.setFlags(this.getFlags());
};

p.showFlagsHelp = function (evt) {
	this.flagsTooltip.hide();
	this.libView.show("flags");
};

p.deferUpdate = function (t) {
	$.clearDefer("draw");
	$.defer(this, this.update, "update", t);
};

p.deferResize = function () {
	this.sourceHighlighter.clear();
	$.addClass(this.sourceCanvas, "hidden");
	$.defer(this, this.resize, "resize", 500);
};

p.getCM = function (target, opts, width, height) {
	var cmdKey = $.getCtrlKey();
	var keys = {};
	keys[cmdKey + "-Z"] = keys[cmdKey + "-Y"] = keys["Shift-" + cmdKey + "-Z"] = function () {
		return false;
	}; // block CM handling

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
	cm.setSize(width || "100%", height || "100%");
	if (cm.getOption("maxLength")) {
		cm.on("beforeChange", CMUtils.enforceMaxLength);
	}
	if (cm.getOption("singleLine")) {
		cm.on("beforeChange", CMUtils.enforceSingleLine);
	}
	return cm;
};

p.decomposeExpression = function (expr) {
	var index = expr.lastIndexOf("/");
	return {pattern: expr.substring(1, index), flags: expr.substr(index + 1)};
};

p.composeExpression = function (pattern, flags) {
	return "/" + pattern + "/" + flags;
};

module.exports = DocView;
