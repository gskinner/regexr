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
var Rating = require('../controls/Rating');
var TextUtils = require('../utils/TextUtils');
var BrowserHistory = require('../BrowserHistory');
var List = require('../controls/List');
var ExpressionModel = require('../net/ExpressionModel');
var Settings = require('../Settings');
var ServerModel = require('../net/ServerModel');
var store = require('store');

var Favorites = function (element, content) {
	this.init(element, content);
};
var p = Favorites.prototype;

p.element = null;
p.content = null;
p.contentTemplate = null;
p.docView = null;
p.rating = null;
p._visible = false;
p._settingsChangeProxy = null;

p.init = function (element, content) {
	this.element = element;
	this.content = content;

	this.loadClickProxy = $.bind(this, this.onLoadClick);

	this.contentTemplate = $.el(".community-content", this.element);
	this.description = $.el(".description", this.contentTemplate);
	this.author = $.el(".author", this.contentTemplate);
	this.expression = $.el(".expression", this.contentTemplate);

	this.previewWrap = $.el(".preview-wrap", this.contentTemplate);
	this.preview = $.el(".preview", this.contentTemplate);

	this.toolWrap = $.el(".tool-wrap", this.contentTemplate);
	this.toolContent = $.el(".tool-content", this.contentTemplate);
	this.toolTitle = $.el(".tool-label", this.contentTemplate);

	this.favoriteBtn = $.el(".favorite", this.contentTemplate);
	this.favoriteBtn.addEventListener("mouseover", $.bind(this, this.handleFavoriteOver));
	this.favoriteBtn.addEventListener("mouseout", $.bind(this, this.handleFavoriteOut));
	this.favoriteBtn.addEventListener("click", $.bind(this, this.handleFavoriteClick));

	this.spinner = $.el(".spinner").cloneNode();
	this.element.appendChild(this.spinner);

	this.list = new List(
		$.el(".community-list", this.element),
		$.el(".community-list .item.renderer", this.element),
		this
	);

	this._settingsChangeProxy = $.bind(this, this.handleSettingsChange);

	ExpressionModel.on("change", this.handleExpressionChange, this);

	this.list.on("change", $.bind(this, this.onListChange));
	this.list.on("enter", $.bind(this, this.handleListEnter));
	this.initView();
};
p.super_init = p.init;

p.initView = function () {
	$.remove($.el(".search", this.element));
	$.remove($.el(".tag-list-container", this.element));
	$.swapClass(this.element, "community", "favorites");
};

p.show = function () {
	this._visible = true;
	$.removeClass(this.spinner, "hidden");
	$.removeClass(this.element, "hidden");

	this.content.appendChild(this.contentTemplate);
	this.content.addEventListener("click", this.loadClickProxy);

	Settings.addEventListener("change", this._settingsChangeProxy);

	if (!store.enabled) {
		$.addClass(this.favoriteBtn, "hidden");
	}

	this.createRating();
	this.search();
	this.onListChange();
};
p.super_show = p.show;

p.hide = function () {
	this._visible = false;
	$.addClass(this.element, "hidden");
	this.content.removeEventListener("click", this.loadClickProxy);
	Settings.removeEventListener("change", this._settingsChangeProxy);
};

p.createRating = function () {
	this.rating = new Rating(0, 5, $.el(".rating", this.content), true);
	this.rating.addEventListener("change", $.bind(this, this.handleRatingChange));
};

p.handleSettingsChange = function (event) {
	var data = event.data;
	var id = Number(data.type.substr(1));
	var type = data.type.charAt(0);

	if (type == "f") {
		var idx = this.getIndexByid(id);
		if (idx != -1) {
			this.updateFavorite(id);
		} else {
			this.search();
		}
	}
};

p.getIndexByid = function (id) {
	var listData = this.list.data;
	for (var i = 0; i < listData.length; i++) {
		if (listData[i].id == id) {
			return i;
		}
	}
	return -1;
};

p.showLoading = function (value) {
	if (value !== false) {
		$.addClass(this.contentTemplate, "hidden");
		$.removeClass(this.spinner, "hidden");
	} else {
		$.removeClass(this.contentTemplate, "hidden");
		$.addClass(this.spinner, "hidden");
	}
};

p.search = function () {
	var favIds = Settings.getAllFavorites();

	if (favIds.length) {
		this.showLoading();
		ServerModel.getPatternList(favIds).then($.bind(this, this.handleFavoritesLoad));
	} else {
		this.handleFavoritesLoad();
	}
};

p.handleExpressionChange = function (evt) {
	if (!this._visible) {
		return;
	}

	var index = this.list.findIndexByValue('id', ExpressionModel.id + '');
	this.list.setSelectedIndex(index);
};

p.handleFavoritesLoad = function (data) {
	if (!this._visible) {
		return;
	}

	if (!store.enabled) {
		var promotionData = {
			content: "Favorites requires local storage to be enabled.",
			description: "Your local storage may be disabled due to security restrictions, or could simply be disabled. Check your browsers settings to find out.",
			id: "-1",
			name: "Local storage is not available",
			pattern: "/(Favo)u?(rite)(s?)/ig",
			replace: "$1$2$3",
			weightedVote: "0",
			author: "gskinner.com"
		};
		this.list.setData([promotionData]);
	} else if (data && data.results) {
		this.list.setData(data.results);
	} else {
		var promotionData = {
			content: "All your favorite patterns will be saved in the favourites section.",
			description: "Click the heart icon on any community pattern to add a new favorite.",
			id: "-1",
			name: "No favourites yet",
			pattern: "/(Favo)u?(rite)(s?)/ig",
			replace: "$1$2$3",
			weightedVote: "0",
			author: "gskinner.com"
		};
		this.list.setData([promotionData]);
	}

	this.list.setSelectedIndex(0);
	setTimeout($.bind(this, this.onListChange), 100);
};

p.onLoadClick = function (evt) {
	var el = evt.target;
	var type = '';
	if ($.hasClass(el, ".expr")) {
		type = "expr";
	} else if ($.hasClass(el, ".source")) {
		type = "source";
	} else if ($.hasClass(el, ".all")) {
		type = "all";
	} else if ($.hasClass(el, ".tool")) {
		type = this.list.selectedItem.state.tool;
	}
	this.insertContent(type);
};

p.handleFavoriteOver = function () {
	var id = this.list.selectedItem.id;
	var isFav = Settings.getFavorite(id);

	if (isFav) {
		$.swapClass(this.favoriteBtn, "full", "empty")
	} else {
		$.swapClass(this.favoriteBtn, "empty", "full")
	}
};

p.handleFavoriteOut = function () {
	var id = this.list.selectedItem.id;
	var isFav = Settings.getFavorite(id);

	if (isFav) {
		$.swapClass(this.favoriteBtn, "empty", "full")
	} else {
		$.swapClass(this.favoriteBtn, "full", "empty")
	}
};

p.insertContent = function (type) {
	var data = this.list.selectedItem;

	var pattern = $.parsePattern(data.pattern);
	var expression = pattern.ex;
	var flags = pattern.flags;

	if (type == "expr") {
		this.docView.setPattern(expression);
		this.docView.setFlags(flags);
	} else if (type == "source") {
		this.docView.setText(data.content);
	} else if (type == "list") {
		this.docView.setState(data.state);
		this.docView.showTool("list");
	} else if (type == "replace") {
		this.docView.setState(data.state);
		this.docView.showTool("replace");
	} else if (type == "all") {
		if (ExpressionModel.id != data.id) {
			ExpressionModel.setID(data.id);
			this.docView.populateAll(expression, flags, data.content, data.state);
			ServerModel.trackVisit(data.id);
		}
	}
};

p.handleListEnter = function () {
	var id = this.list.selectedItem.id;
	if (ExpressionModel.id == id) {
		return;
	}

	this.insertContent("all");

	ExpressionModel.setID(id);
	if (id > -1) {
		BrowserHistory.go($.createID(id));
	} else {
		BrowserHistory.go();
	}
};

p.onListChange = function (evt) {
	var item = this.list.selectedItem;
	if (evt && item == evt.relatedItem) {
		this.handleListEnter();
		return;
	}

	var data = this.list.selectedItem;
	if (!data || isNaN(data.weightedVote)) {
		return;
	}

	this.description.innerHTML = TextUtils.htmlSafe(data.description);

	if (data.author) {
		this.author.innerHTML = TextUtils.htmlSafe(data.author);
	} else {
		this.author.innerHTML = "Anonymous";
	}
	this.expression.innerHTML = TextUtils.htmlSafe(data.pattern);

	if (data.content) {
		var pattern = $.parsePattern(data.pattern);
		var expression = pattern.ex;
		var flags = pattern.flags;
		var regex = new RegExp(expression, flags);

		// encode html, while inserting our own html for highlighting
		var preview = TextUtils.shorten(data.content, 125).replace(regex, "\v\fem\f\v$&\v\f/em\f\v");
		this.preview.innerHTML = TextUtils.htmlSafe(preview).replace(/\v\f(\/?)em\f\v/g, "<$1em>");
		$.removeClass(this.previewWrap, "hidden");
	} else {
		$.addClass(this.previewWrap, "hidden");
	}

	this.rating.setValue(Settings.getRating(data.id));

	this.updateFavorite(data.id);

	if (data.state && data.state.tool && data.state[data.state.tool]) {
		this.toolContent.innerHTML = TextUtils.htmlSafe(data.state[data.state.tool]);
		this.toolTitle.innerText = data.state.tool.substr(0, 1).toUpperCase() + data.state.tool.substr(1);

		$.removeClass(this.toolWrap, "hidden");
	} else {
		$.addClass(this.toolWrap, "hidden");
	}


	if (this._visible) {
		$.removeClass(this.element, "hidden");
		this.showLoading(false);
	}
};

p.getLabel = function (o) {
	return TextUtils.htmlSafe(o.name);
};

p.getStaticRating = function (data) {
	if (!data || isNaN(data.weightedVote)) {
		return "";
	} else {
		return "<span class='inline-rating icon-star small'>" + Number(data.weightedVote).toFixed(1) + "</span>";
	}
};

p.handleRatingChange = function (evt) {
	var id = this.list.selectedItem.id;
	if (id == -1) {
		return;
	}

	var rating = this.rating.getValue();
	ServerModel.rate(id, rating);

	Settings.setRating(id, rating);
};

p.handleFavoriteClick = function () {
	var id = this.list.selectedItem.id;
	if (id == -1) {
		return;
	}
	Settings.setFavorite(id, !Settings.getFavorite(id));
	this.updateFavorite(id);
};

p.updateFavorite = function (id) {
	var selData = this.list.getDataAt(this.list.selectedIndex);
	if (selData.id == id) {
		var isFav = Settings.getFavorite(id);
		if (isFav) {
			$.swapClass(this.favoriteBtn, "empty", "full")
		} else {
			$.swapClass(this.favoriteBtn, "full", "empty")
		}
	}

	this.updateFavoriteRowStyle(this.getIndexByid(id));
};

p.updateFavoriteRowStyle = function (index) {
	if (index < 0) {
		return false;
	}

	var el = this.list.getElementAt(index);
	if (!el) {
		return;
	}

	var data = this.list.getDataAt(index);

	if (!Settings.getFavorite(data.id)) {
		$.addClass(el, "removed");
	} else {
		$.removeClass(el, "removed");
	}

	return true;
};

module.exports = Favorites;
