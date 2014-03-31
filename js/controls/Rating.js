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

	var Rating = function (rating, count, el, interactive) {
		this.init(rating, count, el, interactive);
	};

	var p = Rating.prototype = new createjs.EventDispatcher();
	p.el = null;
	p.interactive = false;
	p.stars = null;
	p._count = null;
	p._rating = null;
	p._starIndex = null;

	p.init = function (rating, count, el, interactive) {
		rating = rating || 0;
		count = count || 5;
		this.interactive = interactive;
		this._count = count;
		this._rating = rating;

		var ratingHTML = "<div class='rating'>";
		if (interactive) {
			this.stars = [];
			ratingHTML = $.html(ratingHTML);
		}

		for (var i=0;i<count;i++) {
			var type = i<rating?"full":"empty";
			var star = "<span class='icon-star-"+type+"'></span>";

			if (interactive) {
				var dom = $.html(star);
				ratingHTML.appendChild(dom);
				this.stars.push(dom);
			} else {
				ratingHTML += star;
			}
		}

		if (interactive) {
			this.el = ratingHTML;
		} else {
			ratingHTML += "</div>";
			this.el = $.html(ratingHTML);
		}

		if (el) {
			el.parentNode.appendChild(this.el);
			el.parentNode.replaceChild(this.el, el);
		}

		if (this.interactive) {
			this.el.addEventListener("click", $.bind(this, this.handleClick));
			this.el.addEventListener("mousemove", $.bind(this, this.handleMouseMove));
			this.el.addEventListener("mouseout", $.bind(this, this.handleMouseOut));
		}
	};

	p.setValue = function(value) {
		this.drawStars(value);
	};

	p.getValue = function() {
		return this._starIndex;
	};

	p.handleClick = function(event) {
		if (this._starIndex > -1 && this._rating != this._starIndex) {
			this._rating = this._starIndex;
			this.dispatchEvent(new createjs.Event("change"));
		}
	};

	p.handleMouseMove = function(event) {
		var startIndex = this.stars.indexOf(event.target);
		if (startIndex == -1) {
			this.drawStars(-1, false);
		} else {
			startIndex = startIndex == -1?this._starIndex:++startIndex;
			this.drawStars(startIndex, true);
		}
	};

	p.handleMouseOut = function(event) {
		this.drawStars(this._rating);
	};

	p.drawStars = function(startIndex, hover) {
		var hoverClass = hover?" hover":"";
		if (startIndex != -1) {
			for (var i=0;i<this._count;i++) {
				var d = this.stars[i];
				if (i < startIndex) {
					$.swapClass(d, "icon-star empty hover", "icon-star" + hoverClass);
				} else {
					$.swapClass(d, "icon-star hover", "icon-star empty" + hoverClass);
				}
			}
			this._starIndex = startIndex;
		}
	};

	p.toHTMLString = function() {
		return this.el.innerHTML;
	};

	scope.Rating = Rating;

}(window));
