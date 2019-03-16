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

import Track from "./utils/Track";

import EventDispatcher from "./events/EventDispatcher.js";
import BrowserSolver from "./helpers/BrowserSolver.js";
import ServerSolver from "./helpers/ServerSolver.js";
import profiles from "./profiles/profiles.js";

import app from "./app";

export default class Flavor extends EventDispatcher {
	
	constructor(flavor) {
		super();
		this.value = app.prefs.read("flavor");
		this._browserSolver = new BrowserSolver();
		this._serverSolver = new ServerSolver();
	}
	
	set value(id) {
		let profile = profiles[(id && id.toLowerCase()) || "js"];
		if (!profile || profile === this._profile) { return; }
		Track.page("flavor/"+id);
		this._profile = profile;
		this._buildSupportMap(profile);
		app.prefs.write("flavor", id);
		this.dispatchEvent("change");
	}
	
	get value() {
		return this._profile.id;
	}
	
	get profile() {
		return this._profile;
	}
	
	get profiles() {
		return [profiles.js, profiles.pcre];
	}
	
	get solver() {
		return this._profile.browser ? this._browserSolver : this._serverSolver;
	}
	
	isTokenSupported(id) {
		return !!this._profile._supportMap[id];
	}
	
	getDocs(id) {
		return this._profile.docs[id];
	}
	
	validateFlags(list) {
		let flags = this._profile.flags, dupes = {};
		return list.filter((id)=>(!!flags[id] && !dupes[id] && (dupes[id] = true)));
	}
	
	validateFlagsStr(str) {
		return this.validateFlags(str.split("")).join("");
	}
	
	isFlagSupported(id) {
		return !!this._profile.flags[id];
	}
	
	_buildSupportMap(profile) {
		if (profile._supportMap) { return; }
		let map = profile._supportMap = {}, props = Flavor.SUPPORT_MAP_PROPS, n;
		for (n in props) { this._addToSupportMap(map, profile[n], !!props[n]); }
		let o = profile.escCharCodes, esc = profile.escChars;
		for (n in o) { map["esc_"+o[n]] = true; }
		for (n in esc) { map["esc_"+esc[n]] = true; }
	}
	
	_addToSupportMap(map, o, rev) {
		if (rev) { for (let n in o) { map[o[n]] = true; } }
		else { for (let n in o) { map[n] = o[n]; } }
	}
}

Flavor.SUPPORT_MAP_PROPS = {
	// 1 = reverse, 0 - normal
	flags: 1,
	// escape is handled separately
	// escCharCodes is handled separately
	escCharTypes: 1,
	charTypes: 1,
	// unquantifiables not included
	// unicodeScripts not included
	// unicodeCategories not included
	// posixCharClasses not included
	// modes not included
	tokens: 0,
	substTokens: 0
	// config not included
	// docs not included
};