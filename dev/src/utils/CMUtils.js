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

/*
Utilities for working with CodeMirror.
*/

import Utils from "../utils/Utils";
import $ from "../utils/DOMUtils";

let CMUtils = {};
export default CMUtils;

CMUtils.create = function (target, opts={}, width="100%", height="100%") {
	let keys = {}, ctrlKey = Utils.getCtrlKey();
	//keys[ctrlKey + "-Z"] = keys[ctrlKey + "-Y"] = keys["Shift-" + ctrlKey + "-Z"] = () => false; // block CM handling

	let o = Utils.copy({
		lineNumbers: false,
		tabSize: 3,
		indentWithTabs: true,
		extraKeys: keys,
		specialChars: /[ \u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff]/,
		specialCharPlaceholder: (ch) => $.create("span", ch === " " ? "cm-space" : "cm-special", " ") // needs to be a space so wrapping works
	}, opts);
	
	let cm = CodeMirror(target, o);
	cm.setSize(width, height);
	
	
	if (cm.getOption("maxLength")) {
		cm.on("beforeChange", CMUtils.enforceMaxLength);
	}
	if (cm.getOption("singleLine")) {
		cm.on("beforeChange", CMUtils.enforceSingleLine);
	}
	
	return cm;
};

CMUtils.getCharIndexAt = function (cm, winX, winY) {
	let pos = cm.coordsChar({left: winX, top: winY}, "page");
	// test current and prev character, since CM seems to use the center of each character for coordsChar:
	for (let i = 0; i <= 1; i++) {
		let rect = cm.charCoords(pos, "page");
		if (winX >= rect.left && winX <= rect.right && winY >= rect.top && winY <= rect.bottom) {
			return cm.indexFromPos(pos);
		}
		if (pos.ch-- <= 0) {
			break;
		}
	}
	return null;
};
/*
// unused?
CMUtils.getEOLPos = function (cm, pos) {
	if (!isNaN(pos)) {
		pos = cm.posFromIndex(pos);
	}
	let rect = cm.charCoords(pos, "local"), w = cm.getScrollInfo().width;
	return cm.coordsChar({left: w - 1, top: rect.top}, "local");
};
*/
CMUtils.getCharRect = function (cm, index) {
	if (index == null) { return null; }
	let pos = cm.posFromIndex(index), rect = cm.charCoords(pos);
	rect.x = rect.left;
	rect.y = rect.top;
	rect.width = rect.right - rect.left;
	rect.height = rect.bottom - rect.top;
	return rect;
};


CMUtils.enforceMaxLength = function (cm, change) {
	let maxLength = cm.getOption("maxLength");
	if (maxLength && change.update) {
		let str = change.text.join("\n");
		let delta = str.length - (cm.indexFromPos(change.to) - cm.indexFromPos(change.from));
		if (delta <= 0) { return true; 
		}
		delta = cm.getValue().length + delta - maxLength;
		if (delta > 0) {
			str = str.substr(0, str.length - delta);
			change.update(change.from, change.to, str.split("\n"));
		}
	}
	return true;
};

CMUtils.enforceSingleLine = function (cm, change) {
	if (change.update) {
		let str = change.text.join("").replace(/(\n|\r)/g, "");
		change.update(change.from, change.to, [str]);
	}
	return true;
};

CMUtils.selectAll = function(cm) {
	cm.focus();
	cm.setSelection({ch:0,line:0},{ch:0, line:cm.lineCount()});
}