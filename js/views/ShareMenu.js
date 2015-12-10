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
var ZeroClipboard = require('zeroclipboard');

var ShareMenu = function (element, docsView) {
	this.initialize(element, docsView);
};

var p = ShareMenu.prototype = new EventDispatcher();

p.element = null;

p.initialize = function (element, docsView) {
	this.docsView = docsView;
	this.element = element;

	this.shareLink = $.el("#shareLinkTxt", this.element);
	this.copyLink = $.el("#shareCopyLink", this.element);
	this.showSaveLink = $.el("#showSaveLink", this.element);
	this.copyExpression = $.el("#copyExpression", this.element);
	this.copyPattern = $.el("#copyPattern", this.element);

	this.showSaveLink.onclick = $.bind(this, this.handleSaveClick);

	this.saveView = $.el("#savePrompt", this.element);
	this.shareLinkView = $.el("#shareLinkView", this.element);
	this.copyJavascript = $.el("#copyJavascript", this.element);

	this.noFlashCopyView = $.el("#noFlashCopyView", this.element);
	this.noFlashCopyInput = $.el("#noFlashCopyInput", this.element);

	this.hasFlash = !$.isFirefox() && !$.isIE() && !ZeroClipboard.state().flash.disabled;

	this.copyMessageView = $.el("#copyMessageView", this.element);

	if (this.hasFlash) {
		var _this = this;
		_this.initializeCopyLinks();
		$.addClass($.el("#noFlashCopyText", this.element), "hidden");
	} else {
		this.initializeNoFlashCopyLinks();
	}

	var copyKeyLabels = $.els(".copyKeyLabel", this.element);
	var copyKeyLabel = $.getCtrlKey();
	for (var i = 0; i < copyKeyLabels.length; i++) {
		copyKeyLabels[i].innerHTML = copyKeyLabel;
	}
};

p.initializeNoFlashCopyLinks = function () {
	var _this = this;

	$.addClass($.el("#shareCopyLink", this.element), "hidden");

	this.createNoFlashCopyLink(this.copyExpression, function () {
		Tracking.event("share", "copy", "expression-noflash");
		return _this.docsView.getExpression();
	});

	this.createNoFlashCopyLink(this.copyPattern, function () {
		Tracking.event("share", "copy", "pattern-noflash");
		return _this.docsView.getPattern();
	});

	this.createNoFlashCopyLink(this.copyJavascript, function () {
		Tracking.event("share", "copy", "javascript-noflash");
		return _this.createJavascriptCopy();
	});
};

p.createNoFlashCopyLink = function (el, copyFunction) {
	var _this = this;
	el.onclick = function () {
		var value = copyFunction();
		var input = _this.noFlashCopyInput;

		input.value = value;

		$.addCopyListener(input, $.bind(_this, _this.handleExpressionCopied));

		// Delay so the text actually selects
		setTimeout(function () {
			input.select();
			input.focus();
		}, 1);

		_this.hideFlyout(_this.copyMessageView);
		_this.showFlyout(_this.noFlashCopyView);
	}
};

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

p.initializeCopyLinks = function () {
	var _this = this;

	this.createCopyLink(this.copyLink, function (event) {
		var clipboard = event.clipboardData;
		clipboard.setData("text/plain", _this.shareLink.value);
		Tracking.event("share", "copy", "share");
	});

	this.createCopyLink(this.copyExpression, function (event) {
		var clipboard = event.clipboardData;
		clipboard.setData("text/plain", _this.docsView.getExpression());
		Tracking.event("share", "copy", "expression");
	});

	this.createCopyLink(this.copyPattern, function (event) {
		var clipboard = event.clipboardData;
		clipboard.setData("text/plain", _this.docsView.getPattern());
		Tracking.event("share", "copy", "pattern");
	});

	this.createCopyLink(this.copyJavascript, function (event) {
		var clipboard = event.clipboardData;
		clipboard.setData("text/plain", _this.createJavascriptCopy());
		Tracking.event("share", "copy", "javascript");
	});
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

p.createCopyLink = function (el, dataFunc) {
	var _this = this;
	return function () {
		var client = new ZeroClipboard(el);
		client.on('ready', function (event) {
			client.on("copy", dataFunc);
			client.on("aftercopy", $.bind(_this, _this.handleCopyComplete));
		});
	}();
};

p.showFlyout = function (el, time) {
	$.animate(el, "information-default", "information-show");

	if (!isNaN(time)) {
		clearTimeout(this._toastInt);
		var _this = this;
		this._toastInt = setTimeout(function () {
			_this.hideFlyout(el);
		}, time);
	}
};

p.hideFlyout = function (el) {
	$.removeClass(el, "information-show");
};

p.handleCopyComplete = function (event) {
	this.showCopyCompleteFlyout(event.data['text/plain']);
};

p.showCopyCompleteFlyout = function (expression) {
	$.el("#copyTxt", this.element).innerText = TextUtils.shorten(expression, 31);
	this.showFlyout(this.copyMessageView, 1500);
}

p.show = function () {
	Tracking.event("share", "show");

	Utils.removeClass(this.saveView, "visible hidden");
	Utils.removeClass(this.shareLinkView, "visible hidden");

	if (!ExpressionModel.id) {
		Utils.addClass(this.saveView, "visible");
		Utils.addClass(this.shareLinkView, "hidden");
	} else {
		this.shareLink.value = Utils.createURL($.createID(ExpressionModel.id));
		Utils.addClass(this.saveView, "hidden");
		Utils.addClass(this.shareLinkView, "visible");

        // This was failing in Edge, with this error: "Could not complete the operation due to error 800a025e."
        try {
            this.shareLink.focus();
            this.shareLink.select();
        } catch (err) {

        }
	}
};

p.hide = function () {
	clearTimeout(this._toastInt);
	this.hideFlyout(this.noFlashCopyView);
	this.hideFlyout(this.copyMessageView);
};

module.exports = ShareMenu;

