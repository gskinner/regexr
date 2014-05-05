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
/**
 * This code is minified and inserted into the end of <body /> in index.html during grunt build.
 *
 */
(function (scope) {
	"use strict";

	var s = function () {
		this.init();
	};
	var p = s.prototype = {};
	p._ctaAnimation = null;
	p.docView = null;

	p.init = function () {

		// If the browser is not supported, don't let them in.
		if (!$.isSupported()) {
			return;
		}

		BrowserHistory.init();
		BrowserHistory.on("change", this.handleHistoryChange, this);

		if (document.location.host != "regexr.com" && document.location.host != "www.regexr.com") {
			$.removeClass($.el(".beta-banner"), "hidden");
		}

		// Setup our copy functionality.
		ZeroClipboard.config(
			{
				moviePath: "assets/ZeroClipboard.swf",
				debug: false,
				useNoCache: false,
				forceHandCursor: true
			}
		);

		List.spinner = $.el(".spinner");

		var docView = new DocView($.el("#docview"));
		this.docView = docView;
		var def = $.el("#docview .default");
		DocView.DEFAULT_TEXT = (def.textContent || def.innerText).trim().replace("{{ctrl}}", Utils.getCtrlKey().toLowerCase());
		docView.setText(); // need to do this as well as the defer below, to keep the history clean.
		$.defer(docView, docView.setText); // this fixes an issue with CodeMirror returning bad char positions at specific widths.
		def.style.display = "none";
		
		var cheatsheet = $.el("#cheatsheet");
		cheatsheet.style.display = "none";
		Docs.getItem("cheatsheet").desc = cheatsheet.innerHTML;

		docView.setExpression(DocView.DEFAULT_EXPRESSION).setSubstitution(DocView.DEFAULT_SUBSTITUTION);
		docView.resetHistory();

		var libView = new LibView($.el("#libview"), Docs.content.library);

		libView.docView = docView;
		docView.libView = libView;

		ExpressionModel.docView = docView;
		ExpressionModel.saveState();

		this.videoLink = $.el(".video-link");
		this.videoLink.addEventListener("click", $.bind(this, this.showVideo));
		this.handleVideoCloseProxy = $.bind(this, this.handleVideoClick);
		var _this = this;

		// wdg:: This is more efficient then using a CSS animation.
		var anim = this._ctaAnimation = function (c) {
			if (anim.stop) {
				$.removeClass(_this.videoLink, "transition");
				return;
			}
			var inTrans = new TransitionEvents(_this.videoLink).on(TransitionEvents.TRANSISTION_END, function () {
				var outTrans = new TransitionEvents(_this.videoLink).on(TransitionEvents.TRANSISTION_END, function () {
					c(c);
				}, null, true);
				$.removeClass(_this.videoLink, "cta");
			}, null, true);
			$.addClass(_this.videoLink, "cta");
		};

		if (Settings.getVisitCount() == 0) {
			$.addClass(this.videoLink, "transition");
			this.videoLink.onmouseover = function() {
				anim.stop = true;
				$.removeClass(_this.videoLink, "transition");
				clearInterval(animationStopInt);
			};

			this._ctaAnimation(this._ctaAnimation);
			var animationStopInt = setTimeout(function() {
				anim.stop = true;
			}, 30000);
		}

		Settings.trackVisit();
		Settings.cleanSaveTokens();
		this.navigate();
	};

	p.handleHistoryChange = function(evt) {
		this.navigate();
	};

	p.navigate = function() {
		// Check for a deep-link
		var url = document.location.toString();
		var match = /[\/#\?]([\w\d]+)$/ig.exec(url);
		var id = null;
		if (match) {
			id = match[1];
		}

		if (ExpressionModel.id == $.idToNumber(id)+'') { return; }

		if ($.isIDValid(id)) {
			var _this = this;
			ServerModel.getPatternByID(id).then(function (data) {
				ExpressionModel.setLastSave(data);
				var pattern = $.parsePattern(data.pattern);
				_this.docView.populateAll(pattern.ex, pattern.flags, data.content, data.replace);
			}, function () {
				BrowserHistory.go();
			});
		} else {
			BrowserHistory.go();
		}
	};

	p.showVideo = function (value) {
		var func = null;
		var el = $.el(".video");
		if (value !== false) {
			$.removeClass(el, "hidden");
			el.addEventListener("click", this.handleVideoCloseProxy);
			func = "playVideo";
			this._ctaAnimation.stop = true;
		} else {
			$.addClass(el, "hidden");
			el.removeEventListener("click", this.handleVideoCloseProxy);
			func = "pauseVideo";
		}

		var iframe = $.el(".video iframe").contentWindow;
		iframe.postMessage('{"event":"command","func":"' + func + '","args":""}', "*");
	};

	p.handleVideoClick = function (evt) {
		this.showVideo(false);
	};

	window.RegExr = s;

})();

WebFont.load({
	 google: {
		 families: ["Source Code Pro:400,700", "Cabin:400,700"],
		 fontinactive: function (family, fvd) {
			 WebFont.load({
							  custom: {
								  families: ["Source Code Pro:400,700", "Cabin:400,700"],
								  urls: ["css/fontFallback.css"]
							  }
						  });
		 }
	 },
	 active: function () {
		window.regexr = new window.RegExr();
	 }
 });
