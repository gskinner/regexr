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

import core from "./core";
import pcre from "./pcre";
import js from "./javascript";

let profiles = {core};
export default profiles;

profiles.pcre = merge(core, pcre);
profiles.js = merge(core, js);

function merge(p1, p2) {
	// merges p1 into p2, essentially just a simple deep copy without array support.
	for (let n in p1) {
		if (p2[n] === false) { continue; }
		else if (typeof p1[n] === "object") { p2[n] = merge(p1[n], p2[n] || {}); }
		else if (p2[n] === undefined) { p2[n] = p1[n]; }
	}
	return p2;
};