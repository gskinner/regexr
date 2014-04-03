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
(function (scope) {
	"use strict";

	var Community = function (element, content) {
		this.init(element, content);
	};
	var p = Community.prototype = Object.create(Favorites.prototype);
	Community.prototype.constructor = Community;

	p.init = function (element, content) {
		this.super_init(element, content);

		this.searchTxt = $.el(".search-input", this.element);
		this.searchTxt.addEventListener("keyup", $.bind(this, this.onTextChange));

		this.tagsInput = new TagInput(this.searchTxt, $.el(".tag-list-container", this.element), $.el(".spinner.white"));
		this.tagsInput.addEventListener("close", $.bind(this, this.handleTagsClose));
	};

	p.initView = function() { };

	p.show = function() {
		this.super_show();
		$.addClass(this.spinner, "hidden");
	};

	p.handleTagsClose = function() {
		this.onTextChange();
	};

	p.onTextChange = function(evt) {
		$.defer(this, this.search, "search", 500);
	};

	p.search = function() {
		if (this.tagsInput.isListVisible()) {
			return;
		}

		var newTags = this.tagsInput.getTags().join(",");

		if (this._lastSearch == newTags) {
			$.removeClass(this.element, "hidden");
			return;
		}

		this.list.clear();
		this.showLoading();

		this._lastSearch = newTags;

		var _this = this;
		CommunityModel.search(newTags).then(function(data) {
			_this.populateResults(data.results);
		}).then(function() {}, function(err) {
			// console.log(err);
		});
	};

	p.showLoading = function(value) {
		if (!this._visible) { return; }

		if (value !== false) {
			$.swapClass($.el(".community-content", this.content), "visible", "hidden");
			this.tagsInput.showLoading(true);
		} else {
			$.swapClass($.el(".community-content", this.content), "hidden", "visible");
			this.tagsInput.showLoading(false);
		}
	};

	p.populateResults = function(data) {
		var _this = this;

		if (data && data.length > 0) {
			this.list.setData(data);
			setTimeout(function() {
				_this.list.setSelectedIndex(0);
				_this.onListChange();
			}, 100);
		} else {
			this.list.setData([{name:"No results found"}]);
			$.swapClass($.el(".community-content", this.content), "visible", "hidden");
			this.tagsInput.showLoading(false);
		}
	};
	
	p.updateFavoriteRowStyle = function() {
		// do nothing. Override Favourites.
	};

	scope.Community = Community;

}(window));
