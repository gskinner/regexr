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


export default class Prefs {
	constructor (el) {
		this._load();
	}

	read(key) {
		return this._data[key];
	}

	write(key, value) {
		if (this._data[key] === value) { return; }
		this._data[key] = value;
		this._save();
	}
	
	clear(key) {
		delete(this._data[key]);
		this._save();
	}
	
	_load() {
		let match = /(?:^|;\s*)prefs=\s*([^;]*)/.exec(document.cookie);
		if (match && match[1]) {
			try {
				this._data = JSON.parse(unescape(match[1]));
				return;
			} catch (e) {}
		}
		this._data = {};
	}

	_save() {
		let str = escape(JSON.stringify(this._data));
		document.cookie = "prefs="+str+"; expires=Fri, 31 Dec 9999 23:59:59 GMT;";
	}

}