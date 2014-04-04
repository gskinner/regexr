(function (scope) {
	"use strict";

	var DataEvent = function (type, data) {
		this.init(type, data);
	};
	var p = DataEvent.prototype = Object.create(createjs.Event.prototype);
	DataEvent.prototype.constructor = DataEvent;

	p.init = function (type, data) {
		this.data = data;
		this.initialize(type);
	};

	scope.DataEvent = DataEvent;

}(window));
