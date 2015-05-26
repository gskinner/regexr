var Event = require('./Event');

var DataEvent = function (type, data) {
	this.init(type, data);
};
var p = DataEvent.prototype = Object.create(Event.prototype);
DataEvent.prototype.constructor = DataEvent;

p.init = function (type, data) {
	this.data = data;
	this.initialize(type);
};

module.exports = DataEvent;

