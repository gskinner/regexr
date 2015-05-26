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
var TagInput = require('../controls/TagInput');
var Tracking = require('../Tracking');
var BrowserHistory = require('../BrowserHistory');
var ExpressionModel = require('../net/ExpressionModel');
var Settings = require('../Settings');

var s = function (element, docsView) {
	this.initialize(element, docsView);
};
var p = s.prototype = new EventDispatcher();

// How long should we show the Saving... text for?
s.MIN_SAVE_TIME = 1500;
s.SAVE_LABEL = "Save";
s.UPDATE_LABEL = "Update";

p.element = null;
p.docsView = null;
p.titleInput = null;
p.categoriesSel = null;
p.submitBtn = null;
p.saveStartTime = 0;
p.saveElements = null;

p.initialize = function (element, docsView) {
	this.element = element;
	this.docsView = docsView;

	this.saveView = $.el("#saveView", element);
	this.saveSuccessView = $.el(".success", element);
	this.noChangesView = $.el(".no-changes", element);

	this.titleInput = $.el("#titleTxt", element);
	this.descriptionTxt = $.el("#descriptionTxt", element);
	this.authorTxt = $.el("#authorTxt", element);

	this.submitBtn = $.el(".save-button", element);
	this.submitBtn.onclick = $.bind(this, this.handleClick);

	this.updateBtn = $.el(".update-button", element);
	this.updateBtn.onclick = $.bind(this, this.handleUpdateClick);

	this.publicChk = $.el('#publicChk', element);
	this.publicChk.addEventListener("click", $.bind(this, this.handleCheckClick));

	this.favouriteChk = $.el('#favouriteChk', element);
	this.favouriteChk.addEventListener("click", $.bind(this, this.handleCheckClick));

	this.tagsTxt = $.el("#tagsTxt", element);

	this.showShare = $.el("#showShareLink", element);
	this.showShare.onclick = $.bind(this, this.showShareMenu);

	this.tagsInput = new TagInput(this.tagsTxt, $.el(".tag-list-container", element));

	this.errorMessage = $.el("#errorMessage", this.element);

	this.saveDetails = $.el(".save-details-wrap", this.el);

	this.saveElements = [this.titleInput, this.descriptionTxt, this.authorTxt, this.tagsTxt, this.submitBtn];
};

p.handleCheckClick = function (event) {
	if ($.hasClass(event.target, "checked")) {
		$.removeClass(event.target, "checked");
	} else {
		$.addClass(event.target, "checked");
	}

	this.updateSaveDetailsState();
};

p.updateSaveDetailsState = function () {
	if ($.hasClass(this.publicChk, "checked") || $.hasClass(this.favouriteChk, "checked")) {
		$.removeClass(this.saveDetails, "hidden");
	} else {
		$.addClass(this.saveDetails, "hidden");
	}
};

p.showShareMenu = function () {
	this.dispatchEvent("close");
	this.docsView.showShare();
};

p.handleClick = function () {
	if (!$.hasClass(this.submitBtn, "disabled")) {
		this.submit();
	}
};

p.handleUpdateClick = function () {
	if (!$.hasClass(this.updateBtn, "disabled")) {
		var lastSave = ExpressionModel.getLastSave();
		var token = Settings.getUpdateToken(lastSave.id);

		this.submit(lastSave.id, token.id);
	}
};

p.submit = function (id, token) {
	var name = null;
	var description = null;
	var author = null;
	var tags = null

	// Only save for info if its not hidden.
	if (!$.hasClass(this.saveDetails, "hidden")) {
		name = this.titleInput.value;
		description = this.descriptionTxt.value;
		author = this.authorTxt.value;
		tags = this.tagsInput.getTags();

		if (!name || name.length < 2) {
			this.titleInput.focus();
			$.addClass(this.titleInput, "error-input");
			$.addClass($.el("#titleTxt-req", this.element), "error-text");
			return;
		}
	}

	this.saveStartTime = Date.now();

	if (id && token) {
		this._saveType = "update";
		this.updateBtn.value = "Updating...";
		Tracking.event("save", "update-click");
	} else {
		this._saveType = "save";
		this.submitBtn.value = "Saving...";
		Tracking.event("save", "save-click");
	}

	$.addClass(this.updateBtn, "disabled");
	$.addClass(this.submitBtn, "disabled");

	$.removeClass(this.titleInput, "error-input");
	$.removeClass($.el("#titleTxt-req", this.element), "error-text");

	var pattern = this.docsView.getExpression();
	var content = this.docsView.getText();
	var replace = null;
	var state = this.docsView.getState();

	if (this.docsView.substEnabled) {
		replace = this.docsView.getSubstitution();
	}

	this.enableElements(this.saveElements, false);
	this.submitBtn.removeAttribute("disabled");

	var isPublic = $.hasClass(this.publicChk, "checked");

	ExpressionModel.savePattern(tags, name, pattern, content, replace, description, author, isPublic, id, token, state).then(
			$.bind(this, this.handleSaveSuccess),
			$.bind(this, this.handleSaveFail)
	);
};

p.handleSaveSuccess = function (result) {
	var isFav = $.hasClass(this.favouriteChk, "checked");
	var id = result.results[0].id;

	var _this = this;
	setTimeout(function () {
		_this.showSaveSuccessView();
		Settings.setFavorite(id, isFav);
	}, (this.saveStartTime + s.MIN_SAVE_TIME) - Date.now());
};

p.resetForm = function () {
	this.titleInput.value = "";
	this.descriptionTxt.value = "";
	this.authorTxt.value = "";
	this.tagsTxt.value = "";
	$.removeClass(this.favouriteChk, "checked");
	$.removeClass(this.publicChk, "checked");
};

p.showSaveSuccessView = function () {
	this.resetForm();

	BrowserHistory.go($.createID(ExpressionModel.id));

	$.removeClass(this.saveView, "view-show view-show-visible");

	var _this = this;
	$.animate(this.saveView, "view-hide", "view-hide-hidden").then(function (el) {
		_this.submitBtn.value = s.SAVE_LABEL;
	});

	$.removeClass(this.saveSuccessView, "view-hide view-hide-hidden hidden");
	$.animate(this.saveSuccessView, "view-show", "view-show-visible");
};

p.handleSaveFail = function (error) {
	if (this._saveType == "update") {
		this.updateBtn.value = s.UPDATE_LABEL;
	} else {
		this.submitBtn.value = s.SAVE_LABEL;
	}

	$.addClass(this.errorMessage, "error-show");

	var _this = this;
	setTimeout(function () {
		$.removeClass(_this.errorMessage, "error-show");
		$.removeClass(_this.updateBtn, "disabled");
		$.removeClass(_this.submitBtn, "disabled");

		_this.enableElements(_this.saveElements, true);
	}, 4000);
};

p.show = function () {
	Tracking.event("save", "show");

	if (!ExpressionModel.isDirty()) {
		$.removeClass(this.noChangesView, "hidden");
		$.swapClass(this.saveView, "view-show view-show-visible", "hidden");
		$.swapClass(this.saveSuccessView, "view-show view-show-visible", "hidden");
		return;
	}

	$.addClass(this.noChangesView, "hidden");
	$.swapClass(this.saveView, "hidden", "view-show view-show-visible");

	var _this = this;
	setTimeout(function () {
		_this.titleInput.focus();
	});
	$.removeClass(this.saveSuccessView, "view-show view-show-visible");
	$.addClass(this.saveSuccessView, "hidden");

	$.removeClass(this.saveView, "view-hide view-hide-hidden hidden");
	$.addClass(this.saveView, "view-show view-show-visible");

	this.enableElements(this.saveElements, true);

	this.submitBtn.value = s.SAVE_LABEL;
	this.updateBtn.value = s.UPDATE_LABEL;

	$.removeClass(this.updateBtn, "disabled");
	$.removeClass(this.submitBtn, "disabled");

	var lastSave = ExpressionModel.getLastSave();
	if (lastSave) {
		$.removeClass(this.updateBtn, "hidden");

		this.titleInput.value = lastSave.name;
		this.descriptionTxt.value = lastSave.description;
		this.tagsInput.setTags(lastSave.tags);
		this.authorTxt.value = lastSave.author;

		if (lastSave.community == "1") {
			$.addClass(this.publicChk, "checked");
		} else {
			$.removeClass(this.publicChk, "checked");
		}

		if (Settings.getFavorite(lastSave.id)) {
			$.addClass(this.favouriteChk, "checked");
		} else {
			$.removeClass(this.favouriteChk, "checked");
		}

		this.updateSaveDetailsState();
	} else {
		$.addClass(this.updateBtn, "hidden");
	}
};

p.hide = function () {

};

p.enableElements = function (els, enable) {
	for (var i = 0; i < els.length; i++) {
		if (!enable) {
			els[i].setAttribute("disabled", "disabled");
		} else {
			els[i].removeAttribute("disabled");
		}
	}
};

module.exports = s;

