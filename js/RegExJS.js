var s = {};

s.match = function (regex, str, callback, workerJs) {
	var matches = [];
	var error = null;
	var match = null;
	var index = null;

	if (!regex) {
		callback(error, matches);
		return;
	}

	if (typeof Worker !== 'undefined' && workerJs) {
		if (s.worker) {
			clearTimeout(s.id);
			s.worker.terminate();
		}

		s.worker = new Worker(workerJs);

		s.worker.onmessage = function (evt) {
			// When the worker says its loaded start a timer. (For IE 10);
			if (evt.data == "onload") {
				s.id = setTimeout(function () {
					callback("timeout", matches);
					s.worker.terminate();
				}, 250);
			} else {
				matches = evt.data.matches;
				error = evt.data.error;
				clearTimeout(s.id);
				callback(error, matches);
			}
		}
		s.worker.postMessage({regex: regex, str: str});
	} else {
		while (!error) {
			match = regex.exec(str);
			if (!match) {
				break;
			}
			if (regex.global && index === regex.lastIndex) {
				error = "infinite";
				break;
			}
			match.num = matches.length;
			match.end = (index = match.index + match[0].length) - 1;
			match.input = null;
			matches.push(match);
			if (!regex.global) {
				break;
			} // or it will become infinite.
		}
		callback(error, matches);
	}
};

module.exports = s;
