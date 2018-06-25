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

import Utils from "./utils/Utils";

import app from "./app";

export default class SubstLexer {
	constructor() {
		this.profile = null;
	}
	
	set profile(profile) {
		this._profile = profile;
		this.string = this.token = this.errors = null;
	}
	
	parse(str) {
		if (!this._profile) { return null; }
		
		this.token = null;
		this.string = str;
		this.errors = [];
		
		// TODO: should this be passed in from Tools?
		let capGroups = app.expression.lexer.captureGroups;
		
		let prev=null, token, c;
		for (let i=0, l=str.length; i<l; i+=token.l) {
			c = str[i];
			token = {prev: prev, i: i, l: 1, subst: true};
	
			if (c === "$" && i + 1 < l) {
				this.parseDollar(str, token, capGroups);
			} else if (c == "\\" && i + 1 < l) {
				this.parseBackSlash(str, token, capGroups);
			}
			
			if (!token.type) {
				token.type = "char";
				token.code = c.charCodeAt(0);
			}
	
			if (prev) {
				prev.next = token;
			}
			if (!this.token) {
				this.token = token;
			}
			
			if (token.error) {
				// SubstLexer currently doesn't generate any errors.
				this.errors.push(token.error);
			}
			prev = token;
		}
	
		return this.token;
	};
	
	parseBackSlash(str, token, capGroups) {
		let match, sub = str.substr(token.i), profile = this._profile;
		if (profile.substTokens.subst_bsgroup && (match = sub.match(/^\\(\d\d?)/))) {
			this._getRef(match[1], token, capGroups, "subst_bsgroup");
		} else if (match = sub.match(SubstLexer.SUBST_ESC_RE)) {
			if (match[1][0] === "u") {
				token.type = "escunicode";
				token.code = parseInt(match[2], 16);
			} else {
				token.code = profile.escCharCodes[match[1]];
				token.type = "esc_"+token.code;
			}
			if (token.type) {
				token.clss = "esc";
				token.l += match[1].length;
			}
		}
	}
	
	parseDollar(str, token, capGroups) {
		// Note: Named groups are not supported in PCRE or JS.
		let match = str.substr(token.i + 1).match(/^([$&`']|\d\d?|{\d\d?})/);
		if (!match) { return; }
		let d = match[1], type=SubstLexer.$_TYPES[d], profile=this._profile;
		
		if (type) {
			if (!profile.substTokens[type]) { return; }
			token.type = type;
			token.clss = "subst";
			token.l += d.length;
		} else {
			this._getRef(d, token, capGroups, d[0] === "{" ? "subst_$bgroup" : "subst_$group");
		}
	};
	
	_getRef(numStr, token, capGroups, type) {
		if (!this._profile.substTokens[type]) { return; }
		let num = parseInt(numStr.match(/\d\d?/)[0]), l=0;
		if (!this._profile.config.substdecomposeref || capGroups[num-1]) { l = numStr.length; }
		else if (num >= 10 && capGroups[(num = (num/10|0))-1]) { l = numStr.length-1; }
		if (l) {
			token.l += l;
			// we don't assign the original type, because the docs combine them all into one id:
			token.type = num > 0 ? "subst_group" : "subst_0match";
			token.clss = "subst";
			if (num > 0) { token.group = capGroups[num-1]; }
		}
	}
}

SubstLexer.$_TYPES = {
	"$": "subst_$esc",
	"&": "subst_$&match",
	"`": "subst_$before",
	"'": "subst_$after",
	"0": "subst_0match"
};

SubstLexer.SUBST_ESC_RE = new RegExp("^"+Utils.SUBST_ESC_RE.source,"i");
