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
	"use strict";

	var LibView = function(element, docs) {
		this.initialize(element, docs);
	};
	var p = LibView.prototype;

	p.element = null;
	p.list = null;
	p.content = null;
	p.docs = null;
	p.dir = null;
	p.docView = null;
	p.item = null;
	p.community = null;

	p.initialize = function(element, docs) {
		this.element = element;

		this.title = $.el(".title", element);
		this.titleButton = $.el(".button", this.title);

		this.title.addEventListener("click", this);

		this.buildUI(element);
		this.showItem(this.docs = docs);
	};

// public:
	p.show = function(id) {
		this.showItem(Docs.getItem(id));
	};

// private:
	p.buildUI = function(el) {
		this.list = new List($.el(".list", el), $.el(".list .item.renderer", el), this);
		this.list.on("change", this.onListChange, this);
		this.content = $.el(".content", el);

		var communityEl = $.el(".community", this.element);
		var favoritesEl = communityEl.cloneNode(true);
		communityEl.parentNode.appendChild(favoritesEl);

		this.favorites = new Favorites(favoritesEl, this.content);
		this.community = new Community(communityEl, this.content);

		var _this = this;
		setTimeout(function() {
			_this.community.docView = _this.docView;
			_this.favorites.docView = _this.docView;
		},1);
	};

	p.handleEvent = function(evt) {
		this.goBack();
	};

	p.goBack = function() {
		this.showItem(this.dir.parent);
	};

	p.showItem = function(item) {
		if (!item || item == this.item) { return; }

		$.swapClass(this.content, "hidden", "visible");

		if (this.item && this.item.id == "community") {
			this.community.hide();
			$.removeClass(this.list.element, "hidden");
		} else
		if (this.item && this.item.id == "favorites") {
			this.favorites.hide();
			$.removeClass(this.list.element, "hidden");
		}

		this.item = item;

		$.empty(this.content);

		var content = this.getContent(item);
		this.content.appendChild($.html(content, true));

		this.setupContent(this.content);
		if (!item.kids) { item = item.parent; }
		if (this.dir == item) { return; }
		this.dir = item;
		if (item.parent) {
			$.swapClass(this.title, "cursor none", "cursor pointer");
			$.removeClass(this.titleButton, "noicon");
		} else {
			$.swapClass(this.title, "cursor pointer", "cursor none");
			$.addClass(this.titleButton, "noicon");
		}
		this.titleButton.innerHTML = this.getLabel(item);
		this.list.setData(item.kids);

		if (item.id == "community") {
			this.community.show();
			$.addClass(this.list.element, "hidden");
		} else if (item.id == "favorites") {
			this.favorites.show();
			$.addClass(this.list.element, "hidden");
		}
		
		if (item.max) {
			$.addClass(this.content, "maximized");
		} else {
			$.removeClass(this.content, "maximized");
		}

		$.removeClass(this.element, "hidden");
	};

	p.setupContent = function(el) {
		var els = $.els("code .load.icon", el);
		if (!els) { return; }
		for (var i=0; i<els.length; i++) {
			el = els[i];
			el.addEventListener("click", $.bind(this, this.onLoadClick));
		}
	};

	p.onListChange = function(evt) {
		var item = this.list.selectedItem;
		if (item == evt.relatedItem) {
			if (!this.docView) { return; }
			var o = item, target = item.target;
			while (!target && o) {
				target = o.target;
				o = o.parent;
			}

			if (item.parent && item.parent.id == "examples") {
				this.docView.setPattern(item.example[0]);
				this.docView.setText(item.example[1]);
			}

			if (target == "expr") { this.docView.insertExpression(item.token); }
			else if (target == "flags") { this.docView.showFlags(); } // alternately: .toggleFlag(item.token);
			else if (target == "subst") {
				this.docView.insertSubstitution(item.token.replace(/\$\$/g,"$"));
				this.docView.showSubstitution();
			}
		} else {
			this.showItem(item, true);
			var parent = item.parent;
			var parentPath = [];
			while (parent && parent.label) {
				parentPath.push(parent.label);
				parent = parent.parent;
			}
			var parent = parentPath.length?parentPath.join("/")+"/":"";
			Tracking.page(parent + item.label || item.id);
		}
	};

	p.onLoadClick = function(evt) {
		var el = evt.currentTarget, ex=this.item.example;
		// TODO: also support subst.
		// TODO: what about flags? Maybe use .setExpression if the first char is /?
		if ($.hasClass(el, ".expr")) { this.docView.setPattern(ex[0]); }
		else if ($.hasClass(el, ".source")) { this.docView.setText(ex[1]); }
	};

	p.getLabel = function(o) {
		return o.label || o.id;
	};

	p.getIcon = function(o) {
		return o.icon ? o.icon+"&nbsp;" : "";
	};

	p.getDetail = function(o) {
		if (o.kids) { return "<span class='icon'>&#xE224;</span>"; }
		else if (o.token) { return "<code>"+o.token+"</code>"; }
		return "";
	};

	p.getContent = function(data) {
		var str = $.fillTags((data.desc||"") + (data.ext||""), data, Docs);
		if (data.example) {
			// TODO: evaluate assembling this with a template from the html instead?
			var ex = data.example;
			var regex = new RegExp(ex[0], "g");
			str += "<div class='example'><h1>Example</h1>";
			str += "<hr/>";
			str += "<code><div class='load icon expr'></div>"+ex[0]+"</code>";
			str += "<hr/>";
			str += "<code><div class='load icon source'></div>"+ex[1].replace(regex, "<em>$&</em>")+"</code>";
			str += "</div>";
		}
		return str;
	};
	
	window.LibView = LibView;
})();
