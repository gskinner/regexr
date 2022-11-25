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
		this.createWorker();
	}

	createWorker() {
		const workerBlob = new Blob([
			document.querySelector('#regexWorker').textContent
		], { type: "text/javascript" });

		this._worker = new Worker(URL.createObjectURL(workerBlob));
		this._worker.onmessage = (evt) => {
			if (evt.data === "onstart") {
				this._startTime = Utils.now();
				this._timeoutId = setTimeout(() => {
					this._worker.terminate();
					this._onRegExComplete({id: "timeout"}, null, this._req.mode);
					this.createWorker(); // Always have an instance running.
				}, 2000);
			} else {
				clearTimeout(this._timeoutId);
				this._onRegExComplete(evt.data.error, evt.data.matches, evt.data.mode, evt.data.tool);
			}
		};
	}

	async solve(o, callback) {
		this._callback = callback;
		this._req = o;

		let text=o.text, tests=o.tests, mode = o.mode;

		// We need to pass the pattern and flags as text, because Safari strips the unicode flag when passing a RegExp to a Worker
		this._worker.postMessage({
			pattern: o.pattern,
			flags: o.flags,
			text,
			tests,
			mode,
			flavor: o.flavor,
			origin: window.location.origin,
			tool: {...o.tool, input: Utils.unescSubstStr(o.tool.input)},
		});
	}

	_onRegExComplete(error, matches, mode, toolResult) {
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
				result.tool.result = toolResult;
			}
		}
		this._callback(result);
	}
}
