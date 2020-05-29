/**
 * This file is now added to the index.html file
 * in .regexWorker
 *
 * Its currently manually minified. But that should move to the build process.
 */

// in plain JS for now:
onmessage = function (evt) {
	postMessage("onload");
	var data = evt.data, text = data.text, tests = data.tests, mode = data.mode;
	var regex = new RegExp(data.pattern, data.flags);

	// shared between BrowserSolver & RegExWorker
	var matches = [], match, index, error;
	if (mode === "tests") {
		for (var i=0, l=tests.length; i<l; i++) {
			let test = tests[i];
			text = test.text;
			regex.lastIndex = 0;
			match = regex.exec(text);
			matches[i] = match ? {i:match.index, l:match[0].length, id:test.id} : {id:test.id};
		}
	} else {
		while (match = regex.exec(text)) {
			if (index === regex.lastIndex) { error = {id:"infinite", warning:true}; ++regex.lastIndex; }
			index = regex.lastIndex;
			var groups = match.reduce(function (arr, s, i) { return (i===0 || arr.push({s:s})) && arr },[]);
			matches.push({i:match.index, l:match[0].length, groups:groups});
			if (!regex.global) { break; } // or it will become infinite.
		}
	}
	// end share
	postMessage({error: error, matches: matches, mode: mode});
};
