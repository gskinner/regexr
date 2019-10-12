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

import Utils from "../utils/Utils.js";

export default class Reference {
	
	constructor(content, flavor, config) {
		this._config = config;
		this._flavor = flavor;
		this._flavor.on("change", ()=> this._flavorChange());
		
		this._injectEscChars(content);
		
		this._idMap = {reference:content};
		this._content = Utils.prepMenuContent(content, this._idMap);
		this._misc = Utils.prepMenuContent(content.misc, this._idMap);
		this._flavorChange();
	}
	
	get content() {
		return this._content;
	}
	
	search(searchStr) {
		function srch(kids, results) {
			for (let i=0, l=kids.length; i<l; i++) {
				let kid = kids[i], points=0;
				if (kid.kids) { srch(kid.kids, results); continue; }
				if (points = Utils.searchRank(kid, searchStr)) {
					kid.__searchPoints = points;
					results.push(kid);
				}
			}
			return results;
		}
		return srch(this.content.kids, []).sort((a,b)=>b.__searchPoints - a.__searchPoints);
	}
	
	idForToken(token) {
		let errId = token.error && token.error.id;
		if (this._idMap[errId]) { return errId; }
		if (this._idMap[token.type]) { return token.type; }
		if (this._idMap[token.clss]) { return token.clss; }
		return errId || token.type || token.clss;
	}
	
// methods used in fillTags:
	getChar(token) {
		let chr = Reference.NONPRINTING_CHARS[token.code];
		return chr ? chr : "\"" + String.fromCharCode(token.code) + "\"";
	}
	
	getQuant(token) {
		let min = token.min, max = token.max;
		return min === max ? min : max === -1 ? min + " or more" : "between " + min + " and " + max;
	}
	
	getUniCat(token) {
		return Reference.UNICODE_CATEGORIES[token.value] || "[Unrecognized]";
	}

	getModes(token) {
		let str = (token.on ? " Enable \"<code>"+token.on+"</code>\"." : "")
		if (token.off) { str += " Disable \"<code>"+token.off+"</code>\"."; }
		return str;
	}

	getInsensitive(token) {
		if (token.code) {
			let chr = String.fromCharCode(token.code);
			if (chr.toLowerCase() === chr.toUpperCase()) { return ""; }
		}
		return token.modes ? `Case ${token.modes.i ? "in" : ""}sensitive.` : "";
	}

	getDotAll(token) {
		return (token.modes.s ? "including" : "except") + " line breaks";
	}

	getLabel(token) {
		let node = this.getNodeForToken(token);
		return node ? node.label || node.id || "" : token.type;
	}

	getDesc(token) {
		return this.getVal(this.getNodeForToken(token), "desc");
	}

	getLazy(token) {
		return token.modes.U ? "greedy" : "lazy";
	}

	getLazyFew(token) {
		return token.modes.U ? "many" : "few";
	}

	getPHPVersion() {
		return this._config.PHPVersion;
	}

	getPCREVersion() {
		return this._config.PCREVersion;
	}

	getCtrlKey() {
		return Utils.getCtrlKey();
	}

	getEscChars() {
		let o = this._flavor.profile.escChars, str="";
		for (let n in o) { str += n; }
		return str;
	}

	/*
	Searches for tags in the string in the format:
	`{{prop.prop}}` or `{{method(prop.prop)}}`
	
	The first format will inject the specified property of the data object.
	For example, `{{a.b}}` would inject the value of `data.a.b`.
	
	The second will inject the results of calling the specified function on the functs object with a property of the data object as it's parameter (or the data object itself if empty).
	For example, `{{myMethod(a.b)}}` would inject the return value of `functs.myMethod(data.a.b)`.
	
	Currently only supports a single param.
	 */
	fillTags(str, data, functs, maxLength=20, htmlSafe=true) {
		let match;
		while (match = str.match(/{{~?[\w.()]+}}/)) {
			let val, f, safe=false;
			val = match[0].substring(2, match[0].length - 2);
			if (val[0] === "~") {
				val = val.substr(1);
				safe = true;
			}
			let match2 = val.match(/\([\w.]*\)/);
			if (match2) {
				f = val.substr(0, match2.index);
				val = match2[0].substring(1, match2[0].length - 1);
			} else {
				f = null;
			}
			let o = data, arr = val.split(".");
			for (let i = 0; i < arr.length; i++) {
				let prop = arr[i];
				if (prop && o) { o = o[prop]; }
			}
			val = o;
			if (f) {
				if (functs[f]) { val = functs[f](val); }
				else { val = " <b class='exp-error'>["+f+"]</b> "; }
			}
			if (!safe && (maxLength || htmlSafe)) { val = Utils.shorten(val, maxLength, htmlSafe, "i"); }
			str = str.replace(match[0], val);
		}
		return str;
	}
	
	// returns doc props from the profile or reference as appropriate (ex. tip, desc, ext)
	getVal(node, prop) {
		if (!node) { return ""; }
		let pDocs = this._flavor.getDocs(node.id), pRef = (pDocs && pDocs[prop]);
		if (pRef != null && pRef[0] !== "+") { return pRef; }
		let ref=(node&&node[prop])||"";
		return pRef != null ? ref+pRef.substr(1) : ref;
	}
	
	getNodeForToken(token) {
		let id=this.idForToken(token), clss = token.clss;
		
		// Special cases:
		if (clss === "quant") { id = clss; }
		if (clss === "esc" && token.type !== "escsequence") { id = "escchar"; }

		return this.getNode(id);
	}

	getNode(id) {
		let map=this._idMap, node = map[id]
		while (node&&node.proxy) { node = map[node.proxy]; }
		return node;
	}
	
	getError(error, token) {
		let errId = error && error.id;
		let str = this._content.errors[errId] || "no docs for error='" + errId + "'";
		if (token) { str = this.fillTags(str, token, this, 20); }
		return str;
	}
	
	tipForToken(token) {
		if (!token) { return null; }

		let node = this.getNodeForToken(token), label, tip;

		if (token.error && !token.error.warning) {
			label = "<span class='error'>ERROR: </span>";
			tip = this.getError(token.error, token);
		} else {
			label = node ? node.label || node.id || "" : token.type;
			tip = this.getVal(node, "tip") || this.getVal(node, "desc");
			tip = this.fillTags(tip, token, this, 20);
			if (token.type === "group") { label += " #" + token.num; }
			label = "<b>" + label[0].toUpperCase() + label.substr(1) + ".</b> ";

			if (token.error) {
				tip += "<span class='warningtext'><span class='error warning'>WARNING: </span>" + this.getError(token.error, token) + "</span>";
			}
		}
		
		return tip ? label + tip :  "no docs for id='" + this.idForToken(token) + "'";
	}
	
	getContent(id) {
		let node = this.getNode(id);
		return this.fillTags(this.getVal(node, "desc") + this.getVal(node, "ext"), node, this);
	}
	
	// TODO: this isn't necessarily the most ideal place for this method (has nothing to do with Reference). Maybe move into Text?
	tipForMatch(match, text) {
		if (!match) { return null; }
		let more = match.l > 150;
		let str = "<b>match: </b>" + Utils.shorten(text.substr(match.i, match.l), 150, true, "i") +
				  "<br/><b>range: </b><code>" + match.i + "-" + (match.i+match.l-1)+ "</code>";
		
		let groups = match.groups, l = groups && groups.length;
		for (let i = 0; i < l; i++) {
			if (i > 3 && l > 5) {
				more = false;
				str += "<br><span class='more'>see Details for "+(l-i)+" more</span>";
				break;
			}
			let group = groups[i], s;
			s = (group.i !== undefined) ? text.substr(group.i, group.l) : group.s;
			more = more || (s && s.length > 50);
			str += (i > 0) ? "<br>" : "<hr>";
			str += "<b>group #" + (i+1) + ": </b>" + Utils.shorten(s, 50, true, "i");
		}
		if (more) { str += "<br><span class='more'>see Details for full matches</span>" }
		return str;
	};
	
// private methods:
	_flavorChange() {
		this._updateHide(this.content);
	}
	
	_updateHide(o, list) {
		// the list param is for debugging, it is populated with the ids of all nodes that were hidden.
		// parent nodes aren't hidden unless all their children are.
		let kids = o.kids, hide=true;
		if (kids) {
			for (let i = 0, l = kids.length; i < l; i++) {
				hide = this._updateHide(kids[i], list) && hide;
			}
		} else {
			hide = (o.show === false) || (o.show !== true && o.id && !this._flavor.isTokenSupported(o.id));
		}
		if (list && hide) { list.push(o.id); }
		return (o.hide = hide);
	}

	_injectEscChars(content) {
		let kids=Utils.find(content.kids, (o)=>o.id==="escchars").kids;
		let template = Utils.find(content.misc.kids, (o)=>o.id==="escchar").tip;
		// \x07 - bell, \x1b - esc
		let chars = "\t\n\v\f\r\0\x07\x1b", tokens = "tnvfr0ae"; // .\\+*?^$[]{}()|/
		for (let i=0, l=chars.length; i<l; i++) {
			kids.push(this._getEscCharDocs(chars[i], tokens[i], template));
		}
	}
	
	_getEscCharDocs(c, t, template) {
		let code = c.charCodeAt(0), chr = Reference.NONPRINTING_CHARS[code] || c;
		return {
			id: "esc_"+code,
			token: "\\" + (t || c),
			label: chr.toLowerCase(),
			desc: this.fillTags(template, {code: code}, this)
		};
	};
}

Reference.NONPRINTING_CHARS = {
	"0": "NULL",
	"1": "SOH",
	"2": "STX",
	"3": "ETX",
	"4": "EOT",
	"5": "ENQ",
	"6": "ACK",
	"7": "BELL",
	"8": "BS",
	"9": "TAB", //
	"10": "LINE FEED", //
	"11": "VERTICAL TAB",
	"12": "FORM FEED",
	"13": "CARRIAGE RETURN", //
	"14": "SO",
	"15": "SI",
	"16": "DLE",
	"17": "DC1",
	"18": "DC2",
	"19": "DC3",
	"20": "DC4",
	"21": "NAK",
	"22": "SYN",
	"23": "ETB",
	"24": "CAN",
	"25": "EM",
	"26": "SUB",
	"27": "ESC",
	"28": "FS",
	"29": "GS",
	"30": "RS",
	"31": "US",
	"32": "SPACE", //
	"127": "DEL"
};

Reference.UNICODE_CATEGORIES = {
	// from: http://www.pcre.org/original/doc/html/pcrepattern.html
	"C": "Other",
	"Cc": "Control",
	"Cf": "Format",
	"Cn": "Unassigned",
	"Co": "Private use",
	"Cs": "Surrogate",
	"L": "Letter",
	"L&": "Any letter ",
	"Ll": "Lower case letter",
	"Lm": "Modifier letter",
	"Lo": "Other letter",
	"Lt": "Title case letter",
	"Lu": "Upper case letter",
	"M": "Mark",
	"Mc": "Spacing mark",
	"Me": "Enclosing mark",
	"Mn": "Non-spacing mark",
	"N": "Number",
	"Nd": "Decimal number",
	"Nl": "Letter number",
	"No": "Other number",
	"P": "Punctuation",
	"Pc": "Connector punctuation",
	"Pd": "Dash punctuation",
	"Pe": "Close punctuation",
	"Pf": "Final punctuation",
	"Pi": "Initial punctuation",
	"Po": "Other punctuation",
	"Ps": "Open punctuation",
	"S": "Symbol",
	"Sc": "Currency symbol",
	"Sk": "Modifier symbol",
	"Sm": "Mathematical symbol",
	"So": "Other symbol",
	"Z": "Separator",
	"Zl": "Line separator",
	"Zp": "Paragraph separator",
	"Zs": "Space separator"
};
