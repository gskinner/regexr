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

	var SubstMenu = function(element) {
		this.initialize(element);
	};
	var p = SubstMenu.prototype = new createjs.EventDispatcher();

	// ui:
	p.element = null;

	p.initialize = function(element) {
		this.element = element;
		this.buildUI(element);
	};

	p.buildUI = function(el) {
  var checks = $.els(".check", el);
		for (var i=0; i<checks.length; i++) {
			checks[i].addEventListener("click", this);
		}
	};

	p.handleEvent = function(evt) {
		var check = evt.currentTarget;
		if($.hasClass(check, "checked")){
   this.active = false;
		} else {
			$.removeClass($.el(".menu.subst .checked"), "checked");
			$.addClass(check, "checked");
			this.active = true;
			this.subst = this.subst === 1? 2 : 1;
		}
		this.dispatchEvent("change");
	};

	p.subst = 2;
	p.active = true;

	window.SubstMenu = SubstMenu;
})();
