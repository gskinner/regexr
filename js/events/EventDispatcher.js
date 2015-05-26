/*
 * EventDispatcher
 * Visit http://createjs.com/ for documentation, updates and examples.
 *
 * Copyright (c) 2010 gskinner.com, inc.
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * @module CreateJS
 */

// namespace:
var Event = require('./Event');

/**
 * EventDispatcher provides methods for managing queues of event listeners and dispatching events.
 *
 * You can either extend EventDispatcher or mix its methods into an existing prototype or instance by using the
 * EventDispatcher {{#crossLink "EventDispatcher/initialize"}}{{/crossLink}} method.
 *
 * Together with the CreateJS Event class, EventDispatcher provides an extended event model that is based on the
 * DOM Level 2 event model, including addEventListener, removeEventListener, and dispatchEvent. It supports
 * bubbling / capture, preventDefault, stopPropagation, stopImmediatePropagation, and handleEvent.
 *
 * EventDispatcher also exposes a {{#crossLink "EventDispatcher/on"}}{{/crossLink}} method, which makes it easier
 * to create scoped listeners, listeners that only run once, and listeners with associated arbitrary data. The
 * {{#crossLink "EventDispatcher/off"}}{{/crossLink}} method is merely an alias to
 * {{#crossLink "EventDispatcher/removeEventListener"}}{{/crossLink}}.
 *
 * Another addition to the DOM Level 2 model is the {{#crossLink "EventDispatcher/removeAllEventListeners"}}{{/crossLink}}
 * method, which can be used to listeners for all events, or listeners for a specific event. The Event object also
 * includes a {{#crossLink "Event/remove"}}{{/crossLink}} method which removes the active listener.
 *
 * <h4>Example</h4>
 * Add EventDispatcher capabilities to the "MyClass" class.
 *
 *      EventDispatcher.initialize(MyClass.prototype);
 *
 * Add an event (see {{#crossLink "EventDispatcher/addEventListener"}}{{/crossLink}}).
 *
 *      instance.addEventListener("eventName", handlerMethod);
 *      function handlerMethod(event) {
 *          console.log(event.target + " Was Clicked");
 *      }
 *
 * <b>Maintaining proper scope</b><br />
 * Scope (ie. "this") can be be a challenge with events. Using the {{#crossLink "EventDispatcher/on"}}{{/crossLink}}
 * method to subscribe to events simplifies this.
 *
 *      instance.addEventListener("click", function(event) {
 *          console.log(instance == this); // false, scope is ambiguous.
 *      });
 *
 *      instance.on("click", function(event) {
 *          console.log(instance == this); // true, "on" uses dispatcher scope by default.
 *      });
 *
 * If you want to use addEventListener instead, you may want to use function.bind() or a similar proxy to manage scope.
 *
 *
 * @class EventDispatcher
 * @constructor
 **/
var EventDispatcher = function () {
	/*	this.initialize(); */ // not needed.
};
var p = EventDispatcher.prototype;

/**
 * Static initializer to mix EventDispatcher methods into a target object or prototype.
 *
 *        EventDispatcher.initialize(MyClass.prototype); // add to the prototype of the class
 *        EventDispatcher.initialize(myObject); // add to a specific instance
 *
 * @method initialize
 * @static
 * @param {Object} target The target object to inject EventDispatcher methods into. This can be an instance or a
 * prototype.
 **/
EventDispatcher.initialize = function (target) {
	target.addEventListener = p.addEventListener;
	target.on = p.on;
	target.removeEventListener = target.off = p.removeEventListener;
	target.removeAllEventListeners = p.removeAllEventListeners;
	target.hasEventListener = p.hasEventListener;
	target.dispatchEvent = p.dispatchEvent;
	target._dispatchEvent = p._dispatchEvent;
	target.willTrigger = p.willTrigger;
};

// constructor:

// private properties:
/**
 * @protected
 * @property _listeners
 * @type Object
 **/
p._listeners = null;

/**
 * @protected
 * @property _captureListeners
 * @type Object
 **/
p._captureListeners = null;

// constructor:
/**
 * Initialization method.
 * @method initialize
 * @protected
 **/
p.initialize = function () {
};

// public methods:
/**
 * Adds the specified event listener. Note that adding multiple listeners to the same function will result in
 * multiple callbacks getting fired.
 *
 * <h4>Example</h4>
 *
 *      displayObject.addEventListener("click", handleClick);
 *      function handleClick(event) {
	 *         // Click happened.
	 *      }
 *
 * @method addEventListener
 * @param {String} type The string type of the event.
 * @param {Function | Object} listener An object with a handleEvent method, or a function that will be called when
 * the event is dispatched.
 * @param {Boolean} [useCapture] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
 * @return {Function | Object} Returns the listener for chaining or assignment.
 **/
p.addEventListener = function (type, listener, useCapture) {
	var listeners;
	if (useCapture) {
		listeners = this._captureListeners = this._captureListeners || {};
	} else {
		listeners = this._listeners = this._listeners || {};
	}
	var arr = listeners[type];
	if (arr) {
		this.removeEventListener(type, listener, useCapture);
	}
	arr = listeners[type]; // remove may have deleted the array
	if (!arr) {
		listeners[type] = [listener];
	}
	else {
		arr.push(listener);
	}
	return listener;
};

/**
 * A shortcut method for using addEventListener that makes it easier to specify an execution scope, have a listener
 * only run once, associate arbitrary data with the listener, and remove the listener.
 *
 * This method works by creating an anonymous wrapper function and subscribing it with addEventListener.
 * The created anonymous function is returned for use with .removeEventListener (or .off).
 *
 * <h4>Example</h4>
 *
 *        var listener = myBtn.on("click", handleClick, null, false, {count:3});
 *        function handleClick(evt, data) {
	 * 			data.count -= 1;
	 * 			console.log(this == myBtn); // true - scope defaults to the dispatcher
	 * 			if (data.count == 0) {
	 * 				alert("clicked 3 times!");
	 * 				myBtn.off("click", listener);
	 * 				// alternately: evt.remove();
	 * 			}
	 * 		}
 *
 * @method on
 * @param {String} type The string type of the event.
 * @param {Function | Object} listener An object with a handleEvent method, or a function that will be called when
 * the event is dispatched.
 * @param {Object} [scope] The scope to execute the listener in. Defaults to the dispatcher/currentTarget for function listeners, and to the listener itself for object listeners (ie. using handleEvent).
 * @param {Boolean} [once=false] If true, the listener will remove itself after the first time it is triggered.
 * @param {*} [data] Arbitrary data that will be included as the second parameter when the listener is called.
 * @param {Boolean} [useCapture=false] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
 * @return {Function} Returns the anonymous function that was created and assigned as the listener. This is needed to remove the listener later using .removeEventListener.
 **/
p.on = function (type, listener, scope, once, data, useCapture) {
	if (listener.handleEvent) {
		scope = scope || listener;
		listener = listener.handleEvent;
	}
	scope = scope || this;
	return this.addEventListener(type, function (evt) {
		listener.call(scope, evt, data);
		once && evt.remove();
	}, useCapture);
};

/**
 * Removes the specified event listener.
 *
 * <b>Important Note:</b> that you must pass the exact function reference used when the event was added. If a proxy
 * function, or function closure is used as the callback, the proxy/closure reference must be used - a new proxy or
 * closure will not work.
 *
 * <h4>Example</h4>
 *
 *      displayObject.removeEventListener("click", handleClick);
 *
 * @method removeEventListener
 * @param {String} type The string type of the event.
 * @param {Function | Object} listener The listener function or object.
 * @param {Boolean} [useCapture] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
 **/
p.removeEventListener = function (type, listener, useCapture) {
	var listeners = useCapture ? this._captureListeners : this._listeners;
	if (!listeners) {
		return;
	}
	var arr = listeners[type];
	if (!arr) {
		return;
	}
	for (var i = 0, l = arr.length; i < l; i++) {
		if (arr[i] == listener) {
			if (l == 1) {
				delete(listeners[type]);
			} // allows for faster checks.
			else {
				arr.splice(i, 1);
			}
			break;
		}
	}
};

/**
 * A shortcut to the removeEventListener method, with the same parameters and return value. This is a companion to the
 * .on method.
 *
 * @method off
 * @param {String} type The string type of the event.
 * @param {Function | Object} listener The listener function or object.
 * @param {Boolean} [useCapture] For events that bubble, indicates whether to listen for the event in the capture or bubbling/target phase.
 **/
p.off = p.removeEventListener;

/**
 * Removes all listeners for the specified type, or all listeners of all types.
 *
 * <h4>Example</h4>
 *
 *      // Remove all listeners
 *      displayObject.removeAllEventListeners();
 *
 *      // Remove all click listeners
 *      displayObject.removeAllEventListeners("click");
 *
 * @method removeAllEventListeners
 * @param {String} [type] The string type of the event. If omitted, all listeners for all types will be removed.
 **/
p.removeAllEventListeners = function (type) {
	if (!type) {
		this._listeners = this._captureListeners = null;
	}
	else {
		if (this._listeners) {
			delete(this._listeners[type]);
		}
		if (this._captureListeners) {
			delete(this._captureListeners[type]);
		}
	}
};

/**
 * Dispatches the specified event to all listeners.
 *
 * <h4>Example</h4>
 *
 *      // Use a string event
 *      this.dispatchEvent("complete");
 *
 *      // Use an Event instance
 *      var event = new createjs.Event("progress");
 *      this.dispatchEvent(event);
 *
 * @method dispatchEvent
 * @param {Object | String | Event} eventObj An object with a "type" property, or a string type.
 * While a generic object will work, it is recommended to use a CreateJS Event instance. If a string is used,
 * dispatchEvent will construct an Event instance with the specified type.
 * @param {Object} [target] The object to use as the target property of the event object. This will default to the
 * dispatching object. <b>This parameter is deprecated and will be removed.</b>
 * @return {Boolean} Returns the value of eventObj.defaultPrevented.
 **/
p.dispatchEvent = function (eventObj, target) {
	if (typeof eventObj == "string") {
		// won't bubble, so skip everything if there's no listeners:
		var listeners = this._listeners;
		if (!listeners || !listeners[eventObj]) {
			return false;
		}
		eventObj = new Event(eventObj);
	}
	// TODO: deprecated. Target param is deprecated, only use case is MouseEvent/mousemove, remove.
	try {
		eventObj.target = target || this;
	} catch (e) {
	} // allows redispatching of native events

	if (!eventObj.bubbles || !this.parent) {
		this._dispatchEvent(eventObj, 2);
	} else {
		var top = this, list = [top];
		while (top.parent) {
			list.push(top = top.parent);
		}
		var i, l = list.length;

		// capture & atTarget
		for (i = l - 1; i >= 0 && !eventObj.propagationStopped; i--) {
			list[i]._dispatchEvent(eventObj, 1 + (i == 0));
		}
		// bubbling
		for (i = 1; i < l && !eventObj.propagationStopped; i++) {
			list[i]._dispatchEvent(eventObj, 3);
		}
	}
	return eventObj.defaultPrevented;
};

/**
 * Indicates whether there is at least one listener for the specified event type.
 * @method hasEventListener
 * @param {String} type The string type of the event.
 * @return {Boolean} Returns true if there is at least one listener for the specified event.
 **/
p.hasEventListener = function (type) {
	var listeners = this._listeners, captureListeners = this._captureListeners;
	return !!((listeners && listeners[type]) || (captureListeners && captureListeners[type]));
};

/**
 * Indicates whether there is at least one listener for the specified event type on this object or any of its
 * ancestors (parent, parent's parent, etc). A return value of true indicates that if a bubbling event of the
 * specified type is dispatched from this object, it will trigger at least one listener.
 *
 * This is similar to {{#crossLink "EventDispatcher/hasEventListener"}}{{/crossLink}}, but it searches the entire
 * event flow for a listener, not just this object.
 * @method willTrigger
 * @param {String} type The string type of the event.
 * @return {Boolean} Returns `true` if there is at least one listener for the specified event.
 **/
p.willTrigger = function (type) {
	var o = this;
	while (o) {
		if (o.hasEventListener(type)) {
			return true;
		}
		o = o.parent;
	}
	return false;
};

/**
 * @method toString
 * @return {String} a string representation of the instance.
 **/
p.toString = function () {
	return "[EventDispatcher]";
};

// private methods:
/**
 * @method _dispatchEvent
 * @param {Object | String | Event} eventObj
 * @param {Object} eventPhase
 * @protected
 **/
p._dispatchEvent = function (eventObj, eventPhase) {
	var l, listeners = (eventPhase == 1) ? this._captureListeners : this._listeners;
	if (eventObj && listeners) {
		var arr = listeners[eventObj.type];
		if (!arr || !(l = arr.length)) {
			return;
		}
		try {
			eventObj.currentTarget = this;
		} catch (e) {
		}
		try {
			eventObj.eventPhase = eventPhase;
		} catch (e) {
		}
		eventObj.removed = false;
		arr = arr.slice(); // to avoid issues with items being removed or added during the dispatch
		for (var i = 0; i < l && !eventObj.immediatePropagationStopped; i++) {
			var o = arr[i];
			if (o.handleEvent) {
				o.handleEvent(eventObj);
			}
			else {
				o(eventObj);
			}
			if (eventObj.removed) {
				this.off(eventObj.type, o, eventPhase == 1);
				eventObj.removed = false;
			}
		}
	}
};

module.exports = EventDispatcher;
