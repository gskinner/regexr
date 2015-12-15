onmessage = function (evt) {

	var regex = evt.data.regex;
	var str = evt.data.str;
	var error = null;
	var matches = [];
	var match, index;

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
		if (regex.global && index === regex.lastIndex) {
			error = "infinite";
			break;
		}
		match.num = matches.length;
		match.end = (index = match.index + match[0].length) - 1;
		match.input = null;
		matches.push(match);
		if (!regex.global) { break; } // or it will become infinite.
	}

	postMessage({error: error, matches: matches});
	self.close();
};
