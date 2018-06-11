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

import core from "./profiles/core.js";
import app from "./app";

export default class RefCoverage {
	constructor() {
		app.flavor._buildSupportMap(core);
		let ref = app.reference._idMap, undoc=[], unused=[], all=core._supportMap;
		let ignore = {
			"escchar": true, // literal char
			"groupclose": true,
			"setclose": true,
			"condition": true, // proxies to conditional
			"conditionalelse": true, // proxies to conditional
			subst_$group: true, // resolved to subst_group
			subst_$bgroup: true, // resolved to subst_group
			subst_bsgroup: true, // resolved to subst_group
			escoctalo: true // resolved to escoctal
		}
		
		for (let n in all) { if (!ref[n] && !ignore[n]) { undoc.push(n); } }
		for (let n in ref) { if (!all[n] && !ref[n].kids) { unused.push(n); } }
		
		console.log("--- UNDOCUMENTED IDS ---\n"+undoc.join("\n")+"\n\n--- UNUSED DOCS? ---\n"+unused.join("\n"));
	}
}