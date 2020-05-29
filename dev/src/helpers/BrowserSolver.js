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

import Utils from "../utils/Utils";

export default class BrowserSolver {

	constructor() {
		const workerBlob = new Blob([
			document.querySelector('#regexWorker').textContent
		], { type: "text/javascript" });
		this._workerObjectURL = URL.createObjectURL(workerBlob);
	}

	solve(o, callback) {
		this._callback = callback;
		this._req = o;

		let regex, text=o.text, tests=o.tests, mode = o.mode;
		try {
			this._regex = regex = new RegExp(o.pattern, o.flags);
		} catch(e) {
			return this._onRegExComplete({id:"regexparse", name: e.name, message: e.message}, null, mode);
		}

		if (window.Worker) {
			const worker = new Worker(this._workerObjectURL);

			worker.onmessage = (evt) => {
				if (evt.data === "onload") {
					this._startTime = Utils.now();
					this._timeoutId = setTimeout(() => {
						worker.terminate();
						this._onRegExComplete({id: "timeout"}, null, mode); // TODO: make this a warning, and return all results so far.
					}, 250);
				} else {
					clearTimeout(this._timeoutId);
					worker.terminate();
					this._onRegExComplete(evt.data.error, evt.data.matches, evt.data.mode);
				}
			};

			// we need to pass the pattern and flags as text, because Safari strips the unicode flag when passing a RegExp to a Worker
			worker.postMessage({pattern:o.pattern, flags:o.flags, text, tests, mode});
		} else {
			this._startTime = Utils.now();

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

			this._onRegExComplete(error, matches, mode);
		}
	}

	_onRegExComplete(error, matches, mode) {
		let result = {
			time: error ? null : Utils.now()-this._startTime,
			error,
			mode,
			matches
		};

		let tool = this._req.tool;
		if (tool) {
			result.tool = { id: tool.id };
			if (!error || error.warning && tool.input != null) {
				let str = Utils.unescSubstStr(tool.input);
				result.tool.result = (tool.id === "replace") ? this._getReplace(str) : this._getList(str);
			}
		}
		this._callback(result);
	}

	_getReplace(str) {
		return this._req.text.replace(this._regex, str);
	}

	_getList(str) {
		// TODO: should we move this into a worker?
		let source = this._req.text, result = "", repl, ref, trimR = 0, regex;

		// build a RegExp without the global flag:
		try {
			regex = new RegExp(this._req.pattern, this._req.flags.replace("g", ""));
		} catch(e) {
			return null;
		}

		if (str.search(/\$[&1-9`']/) === -1) {
			trimR = str.length;
			str = "$&"+str;
		}
		do {
			ref = source.replace(regex, "\b"); // bell char - just a placeholder to find
			let index = ref.indexOf("\b"), empty = (ref.length > source.length);
			if (index === -1) { break; }
			repl = source.replace(regex, str);
			result += repl.substr(index, repl.length-ref.length+1);
			source = ref.substr(index+(empty?2:1));
		} while (source.length);
		if (trimR) { result = result.substr(0,result.length-trimR); }
		return result;
	}
}
