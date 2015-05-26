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
var Event = require('../events/Event');

var TransitionEvents = function (target) {
	this.init(target);
};
var p = TransitionEvents.prototype;
var s = TransitionEvents;

EventDispatcher.initialize(p);

s.TRANSISTION_END = "end";
s.TRANSISTION_START = "start";
s.TRANSISTION_ITERATION = "interation";

p._endDelay;
p._startDelay;
p._intDelay;

p.init = function (target) {
	this.el = target;

	var endEvents = [
		"webkitTransitionEnd", // Safari
		"oTransitionEnd", // Opera
		"otransitionend", // Opera
		"transitionend", // Everyone else
		"webkitAnimationEnd",
		"animationend",
		"oanimationend",
		"MSAnimationEnd"
	];

	var interationEvents = [
		"animationiteration",
		"oanimationiteration",
		"MSAnimationIteration"
	];

	var startEvents = [
		"animationstart",
		"webkitAnimationStart",
		"oanimationstart", // Opera
		"MSAnimationStart", // IE10
	];

	this.endEventProxy = $.bind(this, this.handleEndEvent);
	for (var i = 0; i < endEvents.length; i++) {
		this.el.addEventListener(endEvents[i], this.endEventProxy);
	}

	var interationEventProxy = $.bind(this, this.handleIterationEvent);
	for (var i = 0; i < interationEvents.length; i++) {
		this.el.addEventListener(interationEvents[i], interationEventProxy);
	}

	var startEventProxy = $.bind(this, this.handleStartEvent);
	for (var i = 0; i < interationEvents.length; i++) {
		this.el.addEventListener(interationEvents[i], startEventProxy);
	}
};

p.handleIterationEvent = function () {
	if (this._intDelay) {
		clearTimeout(this._intDelay);
	}
	var _this = this;
	this._intDelay = setTimeout(function () {
		_this.dispatchEvent(new Event(s.TRANSISTION_ITERATION));
	}, 1);
};

p.handleStartEvent = function () {
	if (this._startDelay) {
		clearTimeout(this._startDelay);
	}

	var _this = this;
	this._startDelay = setTimeout(function () {
		_this.dispatchEvent(new Event(s.TRANSISTION_START));
	}, 1);
};

p.handleEndEvent = function (event) {
	if (this._endDelay) {
		clearTimeout(this._endDelay);
	}

	var _this = this;
	this._endDelay = setTimeout(function () {
		_this.dispatchEvent(new Event(s.TRANSISTION_END));
	}, 100);
};

module.exports = s;
