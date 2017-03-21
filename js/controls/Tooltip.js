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
var $ = require('../utils/Utils');

var Tooltip = function (target, content, config) {
	this.initialize(target, content, config);
};
var p = Tooltip.prototype = new EventDispatcher();

Tooltip.add = function (target, content, config) {
	return new Tooltip(target, content, config);
};

Tooltip.remove = function (target) {
	target.__tooltip.remove();
};

p.target = null;
p.content = null;
p.visible = false;
p.element = null;
p.tip = null;
p.currentContent = null;
p.rect = null;
p.config = null;
p.x = -1000;
p.y = -1000;
p._wait = false;

p.initialize = function (target, content, config) {
	this.target = target;
	this.config = config = config || {};
	target.__tooltip = this;
	this.content = content;
	if (config.mode == "press") {
		target.addEventListener("mousedown", this);
	} else if (config.mode == "over" || !config.mode) {
		target.addEventListener("mouseover", this);
		target.addEventListener("mousemove", this);
	}

	if (this.config.controller) {
		this.config.controller.addEventListener("close", $.bind(this, this.remove));
	}
};

p.handleEvent = function (evt) {
	var targ = this.target;
	if (evt.type == "mouseout" && !targ.contains(evt.relatedTarget)) {
		this.dispatchEvent(evt);
		this.hide();
	}
	if (evt.type == "mouseover" && !targ.contains(evt.relatedTarget)) {
		this.show();
		this.dispatchEvent(evt);
	}
	if (evt.type == "mousemove") {
		this.dispatchEvent(evt);
	}
	if (evt.type == "mousedown") {
		if (!this.visible) {
			this.show();
		}
		// HTMLEmbedElement will be our copy text swf files.
		else if (!(evt.target instanceof HTMLObjectElement) && !this.element.contains(evt.target)) {
			this.hide();
		}
	}
};

p.show = function (content, rect) {
	content = content || this.content;
	if (content == null || this._wait) {
		return this.hide();
	}
	if (!this.visible) {
		this.create();
		var el = this.element, tip = this.tip;

		if (this.config.controller) {
			this.config.controller.show();
		}

		if (this.config.mode == "press") {
			document.body.addEventListener("mousedown", this, true);
			$.addClass(this.target, "active");
			this._wait = true;
		} else {
			document.body.addEventListener("mouseout", this);
		}

		el.style.pointerEvents = this.config.mouseEnabled !== false;

		el.className = "regexr-tooltip" + ((this.config && this.config.className) ? " " + this.config.className : "");
		tip.className = "regexr-tooltip-tip";
		document.body.appendChild(this.element);
		document.body.appendChild(this.tip);

		var _this = this;
		setTimeout(function () { // needs to be delayed for transition to work
			el.className += " regexr-tooltip-visible";
			tip.className += " regexr-tooltip-visible";
		}, 0);
	}

	if (content != this.currentContent) {
		this.showContent(content);
	}
	rect = rect || (this.target && this.target.getBoundingClientRect());
	if (rect) {
		this.position(rect);
	}

	if (!this.visible) {
		this.visible = true;
		this.dispatchEvent("show");
	}
	return this;
};

p.remove = function () {
	this.hide();
	this.target.__tooltip = null;
	this.target.removeEventListener("mouseover", this);
	this.target.removeEventListener("mousemove", this);
	this.tip = this.element = null;
	return this;
};

p.hide = function () {
	if (!this.visible) {
		return this;
	}
	this.element.parentNode.removeChild(this.element);
	this.tip.parentNode.removeChild(this.tip);
	document.body.removeEventListener("mouseout", this);
	document.body.removeEventListener("mousedown", this, true);
	if (this.config.mode == "press") {
		$.removeClass(this.target, "active");
		var _this = this;
		setTimeout(function () {
			_this._wait = false;
		}, 0);
	}
	this.visible = false;
	this.currentContent = null;

	if (this.config.controller && this.config.controller.hide) {
		this.config.controller.hide();
	}

	this.dispatchEvent("hide");
	return this;
};

p.position = function (rect) {
	var el = this.element, tip = this.tip;
	var elRect = el.getBoundingClientRect();
	var elW = elRect.right - elRect.left;
	var elH = elRect.bottom - elRect.top;

	var tipRect = tip.getBoundingClientRect();
	var tipW = tipRect.right - tipRect.left >> 1;
	var tipH = tipRect.bottom - tipRect.top;

	var docW = document.body.clientWidth;

	var elX = (rect.right + rect.left) / 2 - elW / 2 | 0;
	var elY = rect.bottom - window.pageYOffset + tipH;

	var tipX = Math.max(3 + tipW, Math.min(docW - tipW * 2 - 10 - 3, elX + elW / 2 - tipW));
	var tipY = elY - tipH;
	var tipScaleY = 1;

	elX = Math.max(10, Math.min(docW - elW - 10, elX));

	if (elY + elH + 10 > window.innerHeight) {
		elY = rect.top - elH - window.pageYOffset - tipH;
		tipScaleY = -1;
		tipY = rect.top - window.pageYOffset - tipH;
	}
	el.style.left = elX + "px"; // TODO: window.innerWidth doesn't account for scrollbar
	el.style.top = elY + "px";

	tip.style.left = tipX + "px";
	tip.style.top = tipY + "px";
	this.setPrefixedCss(tip, "transform", "scale(1," + tipScaleY + ")");

	return this;
};

p.create = function () {
	if (this.element) {
		return this;
	}

	this.element = document.createElement("div");
	this.tip = document.createElement("div");

	return this;
};

p.showContent = function (content) {
	this.currentContent = content;
	if (typeof content == "string") {
		this.element.innerHTML = content;
	} else if (content instanceof HTMLElement) {
		this.element.appendChild(content);
		content.style.display = "block";
	} else {
		this.element.innerHTML = ""; // clear
	}
};

p.setPrefixedCss = function (target, name, value) {
	var n = name[0].toUpperCase() + name.substr(1);
	var style = target.style;
	style[name] = value;
	style["webkit" + n] = style["Moz" + n] = style["ms" + n] = style["O" + n] = value;
};

module.exports = Tooltip;
