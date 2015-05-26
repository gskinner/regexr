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

	var s = function () {
		this.init();
	};
	var p = s.prototype = {};
	p._ctaAnimation = null;
	p.docView = null;
	p.libView = null;

	p.init = function () {

		// If the browser is not supported, don't let them in.
		if (!$.isSupported()) {
			return;
		}

		ES6Promise.polyfill();

		RegExrShared.BrowserHistory.init();
		RegExrShared.BrowserHistory.on("change", this.handleHistoryChange, this);

		if (document.location.host != "regexr.com" && document.location.host != "www.regexr.com") {
			$.removeClass($.el(".beta-banner"), "hidden");
		}

		// Setup our copy functionality.
		ZeroClipboard.config(
				{
					swfPath: "assets/ZeroClipboard.swf",
					cacheBust: false,
					forceHandCursor: true,
					hoverClass: 'a-hover'
				}
		);

		RegExrShared.List.spinner = $.el(".spinner");

		var docView = new RegExrShared.DocView($.el("#docview"));
		this.docView = docView;
		var def = $.el("#docview .default");
		RegExrShared.DocView.DEFAULT_TEXT = (def.textContent || def.innerText).trim().replace("{{ctrl}}", $.getCtrlKey().toLowerCase());
		docView.setText(); // need to do this as well as the defer below, to keep the history clean.
		$.defer(docView, docView.setText); // this fixes an issue with CodeMirror returning bad char positions at specific widths.
		def.style.display = "none";

		var cheatsheet = $.el("#cheatsheet");
		cheatsheet.style.display = "none";
		RegExrShared.Docs.getItem("cheatsheet").desc = cheatsheet.innerHTML;

		docView.setExpression(RegExrShared.DocView.DEFAULT_EXPRESSION).setSubstitution(RegExrShared.DocView.DEFAULT_SUBSTITUTION);
		docView.resetHistory();

		var libView = new RegExrShared.LibView($.el("#libview"), RegExrShared.Docs.content.library);
		this.libView = libView;

		libView.docView = docView;
		docView.libView = libView;

		RegExrShared.ExpressionModel.docView = docView;
		RegExrShared.ExpressionModel.saveState();

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
			var inTrans = new RegExrShared.TransitionEvents(_this.videoLink).on(RegExrShared.TransitionEvents.TRANSISTION_END, function () {
				var outTrans = new RegExrShared.TransitionEvents(_this.videoLink).on(RegExrShared.TransitionEvents.TRANSISTION_END, function () {
					c(c);
				}, null, true);
				$.removeClass(_this.videoLink, "cta");
			}, null, true);
			$.addClass(_this.videoLink, "cta");
		};

		if (RegExrShared.Settings.getVisitCount() == 0) {
			$.addClass(this.videoLink, "transition");
			this.videoLink.onmouseover = function () {
				anim.stop = true;
				$.removeClass(_this.videoLink, "transition");
				clearInterval(animationStopInt);
			};

			this._ctaAnimation(this._ctaAnimation);
			var animationStopInt = setTimeout(function () {
				anim.stop = true;
			}, 30000);
		}

		RegExrShared.Settings.trackVisit();
		RegExrShared.Settings.cleanSaveTokens();
		this.navigate();
	};

	p.handleHistoryChange = function (evt) {
		this.navigate();
	};

	p.navigate = function () {
		// Check for a deep-link
		var url = document.location.toString();
		var match = /[\/#\?]([\w\d]+)$/ig.exec(url);
		var id = null;
		if (match) {
			id = match[1];
		}

		if (RegExrShared.ExpressionModel.id == $.idToNumber(id) + '') {
			return;
		}

		if ($.isIDValid(id)) {
			var _this = this;
			RegExrShared.ServerModel.getPatternByID(id).then(function (data) {
				RegExrShared.ExpressionModel.setLastSave(data);
				var pattern = $.parsePattern(data.pattern);
				_this.docView.setState(data.state != null && data.state != "" ? JSON.parse(data.state) : {});
				_this.docView.populateAll(pattern.ex, pattern.flags, data.content, data.replace);
			}, function () {
				RegExrShared.BrowserHistory.go();
			});
		} else {
			RegExrShared.BrowserHistory.go();
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
