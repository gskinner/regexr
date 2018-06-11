/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

let DOMUtils = {}, $ = DOMUtils;
export default DOMUtils;
	
$.query = function(query, element = document.body) {
	return (query[0] === ">") ? $._childQuery(query, element, $.query) : element.querySelector(query);
};

$.queryAll = function(query, element = document.body) {
	return (query[0] === ">") ? $._childQuery(query, element, $.queryAll) : element.querySelectorAll(query);
};

$.removeClass = function(element, className) {
	if ($._runOnNodeList($.removeClass, element, className)) { return element; }
	if (className instanceof RegExp) {
		let arr = (element.getAttribute("class")||"").split(" "), re = className;
		element.setAttribute("class", arr.filter((s)=> !re.test(s)).join(" "));
	} else {
		let list = element.classList;
		list.remove.apply(list, className.split(" "));
	}
	return element;
};

$.addClass = function(element, className) {
	if ($._runOnNodeList($.addClass, element, className)) { return element; }
	
	$.removeClass(element, className);

	let names = className.split(" ");
	for (let i = 0; i < names.length; i++) {
		element.classList.add(names[i]);
	}
	return element;
};

$.toggleClass = function(element, className, value) {
	if ($._runOnNodeList($.toggleClass, element, className, value)) { return element; }
	let curValue = $.hasClass(element, className);
	if (value == null) { value = !curValue; }
	else if (value === curValue) { return; }
	if (value) { $.addClass(element, className); }
	else { $.removeClass(element, className); }
};

$.hasClass = function(element, className) {
	return !!(element.getAttribute("class")||"").match(new RegExp("\\b\\s?" + className + "\\b", "g"));
};

$.swapClass = function(element, oldClass, newClass) {
	$.removeClass(element, oldClass);
	$.addClass(element, newClass);
	return element;
};

$.remove = function(element) {
	if ($._runOnNodeList($.remove, element)) { return element; }
	
	if (element.remove) {
		element.remove();
	} else if (element.parentNode) {
		element.parentNode.removeChild(element);
	}
	return element;
};

/*
 Remove all children from an element.
 When using .innerHTML = ""; IE fails when adding new dom elements via appendChild();
 */
$.empty = function(element) {
	if ($._runOnNodeList($.empty, element)) { return element; }
	
	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}
	return element;
};

$.create = function(type, className, content, parent) {
	let element = document.createElement(type || "div");
	if (className) { element.className = className; }
	if (content) { element.innerHTML = content; }
	if (parent) { parent.appendChild(element); }
	return element;
};

$.getEl = function(query, scope) {
	if (query instanceof HTMLElement || !query) { return query; }
	return $.query(query, scope);
};

$.togglePanel = function(element, openEl, closedEl, open) {
	let el1 = $.getEl(openEl, element), el2 = $.getEl(closedEl, element), tmp, isOpen = !$.hasClass(element, "closed");
	if (open === undefined) { open = !isOpen; }
	else { open = !!open; }
	if (open === isOpen) { return; }
	if (open) {
		$.removeClass(element, "closed");
		tmp = el2;
		el2 = el1;
		el1 = tmp;
	}
	else { $.addClass(element, "closed"); }

	el1 && (el1.style.display = "none");
	if (el2) {
		let f = function(evt) {
			if (evt.target !== element) { return; }
			el2.style.display = "flex";
			element.removeEventListener("transitionend", f);
		};
		element.addEventListener("transitionend", f);
	}
};

$.transition = function(target, className, then) {
	let f = (evt) => {
		if (evt.target !== target) { return; }
		target.removeEventListener("transition", f);
		then();
	};
	target.addEventListener("transitionend", f);
	$.addClass(target, className);
};

$.template = function(strings, ...keys) {
	return (o) => {
		let result = strings[0];
		for (let i=0, l=keys.length; i<l; i++) {
			result += o[keys[i]] + strings[i+1];
		}
		return result;
	};
};

// TODO: evaluate whether this belongs here. Feels awkward given its specific DOM dependencies.
$.getCSSValue = function(name, prop) {
	let el = $.create("div", name);
	el.style.display = "none";
	el.id = "export";
	document.body.appendChild(el);
	let val = window.getComputedStyle(el).getPropertyValue(prop);
	$.remove(el);
	return val;
};

$._runOnNodeList = function(f, nodelist, ...rest) {
	if (!nodelist) { return true; }
	if (nodelist.length === undefined) { return false; }
	for (let i=0, l=nodelist.length; i<l; i++) {
		f.call(DOMUtils, nodelist[i], ...rest);
	}
	return true;
};

$._childQuery = function(query, el, f) {
	if (!el.id) { el.id = "___tmp_id"; }
	let result = f("#"+el.id+" "+query, el.parentNode);
	if (el.id === "___tmp_id") { el.id = ""; }
	return result;
};