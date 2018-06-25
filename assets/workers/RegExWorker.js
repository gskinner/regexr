
// in plain JS for now:
onmessage = function (evt) {
	postMessage("onload");
	var regex = new RegExp(evt.data.pattern, evt.data.flags), text = evt.data.text;
	
	// shared between BrowserSolver & RegExWorker
	var matches = [], match, index, error;
	while (match = regex.exec(text)) {
		if (index === regex.lastIndex) { error = {id:"infinite", warning:true}; ++regex.lastIndex; }
		index = regex.lastIndex;
		var groups = match.reduce(function (arr, s, i) { return (i===0 || arr.push({s:s})) && arr },[]);
		matches.push({i:match.index, l:match[0].length, groups:groups});
		if (!regex.global) { break; } // or it will become infinite.
	}
	// end share
	
	postMessage({error: error, matches: matches});
	self.close();
};
