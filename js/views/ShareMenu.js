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
var EventDispatcher = require('../events/EventDispatcher');
var Tracking = require('../Tracking');
var TextUtils = require('../utils/TextUtils');
var Utils = require('../utils/Utils');
var ExpressionModel = require('../net/ExpressionModel');
var Clipboard = require('clipboard');
var Tooltip = require('../controls/Tooltip');

var ShareMenu = function (element, docsView) {
	this.initialize(element, docsView);
};

var p = ShareMenu.prototype = new EventDispatcher();

p.element = null;

p.initialize = function (element, docsView) {
	this.docsView = docsView;
	this.element = element;

	this.showSaveLink = $.el("#showSaveLink", this.element);
	this.showSaveLink.onclick = $.bind(this, this.handleSaveClick);
	this.saveView = $.el("#savePrompt", this.element);
	this.shareLinkTxt = $.el("#shareLinkTxt", this.element);
	this.shareWrap = $.el(".share-wrap", this.element);
	this.shareExpressionTxt = $.el("#shareExpressionTxt", this.element);
	this.sharePatternTxt = $.el("#sharePatternTxt", this.element);
	this.shareJavascriptTxt = $.el("#shareJavascriptTxt", this.element);

	new Clipboard(".share-link-btn")
		.on("success", this._handleCopySuccess.bind(this))
		.on("error", this._handleCopyError.bind(this));

	new Clipboard(".share-expression-btn")
		.on("success", this._handleCopySuccess.bind(this))
		.on("error", this._handleCopyError.bind(this));

	new Clipboard(".share-javascript-btn")
		.on("success", this._handleCopySuccess.bind(this))
		.on("error", this._handleCopyError.bind(this));

	new Clipboard(".share-pattern-btn")
		.on("success", this._handleCopySuccess.bind(this))
		.on("error", this._handleCopyError.bind(this));

	this._successToolTip = new Tooltip($.el(".share-link-btn"), "", {mode: "custom"});

	var copyKeyLabels = $.els(".copyKeyLabel", this.element);
	var copyKeyLabel = $.getCtrlKey();
	for (var i = 0; i < copyKeyLabels.length; i++) {
		copyKeyLabels[i].innerHTML = copyKeyLabel;
	}
};

p._handleCopyError = function(event) {
	var copyKeyLabel = $.getCtrlKey();
	this.showCopyToolTip("Press " + copyKeyLabel +" + C to copy.", event, false);
}

p._handleCopySuccess = function(event) {
	this.showCopyToolTip("Copied!", event);
}

p.showCopyToolTip = function(content, event, autoHide) {
	var rect = event.trigger.getBoundingClientRect();

	var xOffset = 15;
	this._successToolTip.show(content, {right: rect.right+xOffset, left: rect.left+xOffset, top: rect.top, bottom: rect.bottom});
	var _this = this;

	if (autoHide !== false) {
		setTimeout(function () {
			_this._successToolTip.hide();
		}, 750);
	}
}

p.handleExpressionCopied = function (event) {
	var _this = this;
	this.hideFlyout(this.noFlashCopyView).then(function () {
		_this.showCopyCompleteFlyout(_this.noFlashCopyInput.value);
	});
};

p.handleSaveClick = function () {
	this.dispatchEvent("close");
	this.docsView.showSave();
};

p.createJavascriptCopy = function () {
	var pattern = this.docsView.getExpression();

	if (this.docsView.substEnabled) {
		var sub = this.docsView.getSubstitution();
		return "text.replace(" + pattern + ", \"" + sub + "\");";
	} else {
		return "text.match(" + pattern + ");";
	}
};

p.show = function () {
	Tracking.event("share", "show");

	Utils.removeClass(this.saveView, "visible hidden");
	Utils.removeClass(this.shareWrap, "visible hidden");

	this.shareExpressionTxt.value = this.docsView.getExpression();
	this.sharePatternTxt.value = this.docsView.getPattern();
	this.shareJavascriptTxt.value = this.createJavascriptCopy();

	if (!ExpressionModel.id) {
		Utils.addClass(this.saveView, "visible");
		Utils.addClass(this.shareWrap, "hidden");
	} else {
		this.shareLinkTxt.value = Utils.createURL($.createID(ExpressionModel.id));
		Utils.addClass(this.saveView, "hidden");
		Utils.addClass(this.shareWrap, "visible");
	}
};

p.hide = function () {

};

module.exports = ShareMenu;
