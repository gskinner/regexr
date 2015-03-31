onmessage = function (evt) {
	"use strict";
	var regex = evt.data.regex;
	var str = evt.data.str;
	var error = null;
	var matches = [];
	var match;

	// Let the callee know we're loaded (for IE 10);
	postMessage("onload");

	if (!regex) {
		postMessage({error: error, matches: matches});
		self.close();
		return;
	}

	while (!error) {
		match = regex.exec(str);
		if (!match) { break; }
		if (regex.global && match[0].length === 0) {
			regex.lastIndex++;
			if(regex.lastIndex > str.length) {
				break;
			}
		}
		match.end = match.index + match[0].length - 1;
		match.input = null;
		matches.push(match);
		if (!regex.global) { break; } // or it will become infinite.
	}

	postMessage({error: error, matches: matches});
	self.close();
}
