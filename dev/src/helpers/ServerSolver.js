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
import Server from "../net/Server";

export default class ServerSolver {
	
	solve(o, callback) {
		// unescape tool input:
		if (o.tool.input != null) { o.tool.input = Utils.unescSubstStr(o.tool.input); }
		if (this._serverPromise) { this._serverPromise.abort(); }
		Utils.defer(()=>this._solve(o,callback), "ServerSolver._solve", 250);
	}
	
	_solve(o, callback) {
		this._callback = callback;
		this._serverPromise = Server.solve(o).then((o) => this._onLoad(o)).catch((o) => this._onError(o));
	}
	
	_onLoad(data) {
		this._callback(data);
	}
	
	_onError(msg) {
		this._callback({error:{id:msg}});
	}
}