/*
 The MIT License (MIT)

 Copyright (c) 2014 gskinner.com, inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */

var RegExLexer = function () {
};
var p = RegExLexer.prototype;

// \ ^ $ . | ? * + ( ) [ {
RegExLexer.CHAR_TYPES = {
	".": "dot",
	"|": "alt",
	"$": "eof",
	"^": "bof",
	"?": "opt", // also: "lazy"
	"+": "plus",
	"*": "star"
};

RegExLexer.ESC_CHARS_SPECIAL = {
	"w": "word",
	"W": "notword",
	"d": "digit",
	"D": "notdigit",
	"s": "whitespace",
	"S": "notwhitespace",
	"b": "wordboundary",
	"B": "notwordboundary"
	// u-uni, x-hex, c-ctrl, oct handled in parseEsc
};

RegExLexer.UNQUANTIFIABLE = {
	"quant": true,
	"plus": true,
	"star": true,
	"opt": true,
	"eof": true,
	"bof": true,
	"group": true, // group open
	"lookaround": true, // lookaround open
	"wordboundary": true,
	"notwordboundary": true,
	"lazy": true,
	"alt": true,
	"open": true
};

RegExLexer.ESC_CHAR_CODES = {
	"0": 0,  // null
	"t": 9,  // tab
	"n": 10, // lf
	"v": 11, // vertical tab
	"f": 12, // form feed
	"r": 13  // cr
};

p.string = null;
p.token = null;
p.errors = null;
p.captureGroups = null;

/**
 * Parse a regular expression
 * @param {String} str   string to parse
 * @param {String} parseType  type of parsing to do ('pattern', 'flags', or 'all')
 *                       			Optional: defaults to all
 */
p.parse = function (str, parseType) {
	parseType = parseType || 'all';

	if (str == this.string) {
		return this.token;
	}

	this.token = null;
	this.string = str;
	this.errors = [];
	var capgroups = this.captureGroups = [];
	var groups = [], i = 0, l = str.length;
	var o, c, token, prev = null, charset = null, unquantifiable = RegExLexer.UNQUANTIFIABLE;
	var charTypes = RegExLexer.CHAR_TYPES;
	var closeIndex = parseType === 'all' ? str.lastIndexOf("/") : Infinity;

	while (i < l) {
		c = str[i];

		token = {i: i, l: 1, prev: prev};

		if (parseType === 'flags' ||
				(parseType === 'all' && (i == 0 || i >= closeIndex))) {
			this.parseFlag(str, token);
		} else if (c == "(" && !charset) {
			this.parseGroup(str, token);
			token.depth = groups.length;
			groups.push(token);
			if (token.capture) {
				capgroups.push(token);
				token.num = capgroups.length;
			}
		} else if (c == ")" && !charset) {
			token.type = "groupclose";
			if (groups.length) {
				o = token.open = groups.pop();
				o.close = token;
			} else {
				token.err = "groupclose";
			}
		} else if (c == "[" && !charset) {
			token.type = token.clss = "set";
			charset = token;
			if (str[i + 1] == "^") {
				token.l++;
				token.type += "not";
			}
		} else if (c == "]" && charset) {
			token.type = "setclose";
			token.open = charset;
			charset.close = token;
			charset = null;
		} else if ((c == "+" || c == "*") && !charset) {
			token.type = charTypes[c];
			token.clss = "quant";
			token.min = (c == "+" ? 1 : 0);
			token.max = -1;
		} else if (c == "{" && !charset && str.substr(i).search(/^{\d+,?\d*}/) != -1) {
			this.parseQuant(str, token);
		} else if (c == "\\") {
			this.parseEsc(str, token, charset, capgroups, closeIndex);
		} else if (c == "?" && !charset) {
			if (!prev || prev.clss != "quant") {
				token.type = charTypes[c];
				token.clss = "quant";
				token.min = 0;
				token.max = 1;
			} else {
				token.type = "lazy";
				token.related = [prev];
			}
		} else if (c == "-" && charset && prev.code != null && prev.prev && prev.prev.type != "range") {
			// this may be the start of a range, but we'll need to validate after the next token.
			token.type = "range";
		} else {
			this.parseChar(str, token, charset, parseType !== 'all');
		}

		if (prev) {
			prev.next = token;
		}

		// post processing:
		if (token.clss == "quant") {
			if (!prev || unquantifiable[prev.type]) {
				token.err = "quanttarg";
			}
			else {
				token.related = [prev.open || prev];
			}
		}
		if (prev && prev.type == "range" && prev.l == 1) {
			token = this.validateRange(str, prev);
		}
		if (token.open && !token.clss) {
			token.clss = token.open.clss;
		}

		if (!this.token) {
			this.token = token;
		}
		i = token.end = token.i + token.l;
		if (token.err) {
			this.errors.push(token.err);
		}
		prev = token;
	}

	while (groups.length) {
		this.errors.push(groups.pop().err = "groupopen");
	}
	if (charset) {
		this.errors.push(charset.err = "setopen");
	}

	return this.token;
};

p.parseFlag = function (str, token) {
	// note that this doesn't deal with misformed patterns or incorrect flags.
	var i = token.i, c = str[i];
	if (str[i] == "/") {
		token.type = (i == 0) ? "open" : "close";
		if (i != 0) {
			token.related = [this.token];
			this.token.related = [token];
		}
	} else {
		token.type = "flag_" + c;
	}
	token.clear = true;
};

p.parseChar = function (str, token, charset, allowSlash) {
	var c = str[token.i];
	token.type = (!charset && RegExLexer.CHAR_TYPES[c]) || "char";
	if (!charset && c == "/" && !allowSlash) {
		token.err = "fwdslash";
	}
	if (token.type == "char") {
		token.code = c.charCodeAt(0);
	} else if (token.type == "bof" || token.type == "eof") {
		token.clss = "anchor";
	} else if (token.type == "dot") {
		token.clss = "charclass";
	}
	return token;
};

p.parseGroup = function (str, token) {
	token.clss = "group";
	var match = str.substr(token.i + 1).match(/^\?(?::|<?[!=])/);
	var s = match && match[0];
	if (s == "?:") {
		token.l = 3;
		token.type = "noncapgroup";
	} else if (s) {
		token.behind = s[1] == "<";
		token.negative = s[1 + token.behind] == "!";
		token.clss = "lookaround";
		token.type = (token.negative ? "neg" : "pos") + "look" + (token.behind ? "behind" : "ahead");
		token.l = s.length + 1;
		if (token.behind) {
			token.err = "lookbehind";
		} // not supported in JS
	} else {
		token.type = "group";
		token.capture = true;
	}
	return token;
};

p.parseEsc = function (str, token, charset, capgroups, closeIndex) {
	// jsMode tries to read escape chars as a JS string which is less permissive than JS RegExp, and doesn't support \c or backreferences, used for subst

	// Note: \8 & \9 are treated differently: IE & Chrome match "8", Safari & FF match "\8", we support the former case since Chrome & IE are dominant
	// Note: Chrome does weird things with \x & \u depending on a number of factors, we ignore this.
	var i = token.i, jsMode = token.js, match, o;
	var sub = str.substr(i + 1), c = sub[0];
	if (i + 1 == (closeIndex || str.length)) {
		token.err = "esccharopen";
		return;
	}

	if (!jsMode && !charset && (match = sub.match(/^\d\d?/)) && (o = capgroups[parseInt(match[0]) - 1])) {
		// back reference - only if there is a matching capture group
		token.type = "backref";
		token.related = [o];
		token.group = o;
		token.l += match[0].length;
		return token;
	}

	if (match = sub.match(/^u[\da-fA-F]{4}/)) {
		// unicode: \uFFFF
		sub = match[0].substr(1);
		token.type = "escunicode";
		token.l += 5;
		token.code = parseInt(sub, 16);
	} else if (match = sub.match(/^x[\da-fA-F]{2}/)) {
		// hex ascii: \xFF
		// \x{} not supported in JS regexp
		sub = match[0].substr(1);
		token.type = "eschexadecimal";
		token.l += 3;
		token.code = parseInt(sub, 16);
	} else if (!jsMode && (match = sub.match(/^c[a-zA-Z]/))) {
		// control char: \cA \cz
		// not supported in JS strings
		sub = match[0].substr(1);
		token.type = "esccontrolchar";
		token.l += 2;
		var code = sub.toUpperCase().charCodeAt(0) - 64; // A=65
		if (code > 0) {
			token.code = code;
		}
	} else if (match = sub.match(/^[0-7]{1,3}/)) {
		// octal ascii
		sub = match[0];
		if (parseInt(sub, 8) > 255) {
			sub = sub.substr(0, 2);
		}
		token.type = "escoctal";
		token.l += sub.length;
		token.code = parseInt(sub, 8);
	} else if (!jsMode && c == "c") {
		// control char without a code - strangely, this is decomposed into literals equivalent to "\\c"
		return this.parseChar(str, token, charset); // this builds the "/" token
	} else {
		// single char
		token.l++;
		if (jsMode && (c == "x" || c == "u")) {
			token.err = "esccharbad";
		}
		if (!jsMode) {
			token.type = RegExLexer.ESC_CHARS_SPECIAL[c];
		}

		if (token.type) {
			token.clss = (c.toLowerCase() == "b") ? "anchor" : "charclass";
			return token;
		}
		token.type = "escchar";
		token.code = RegExLexer.ESC_CHAR_CODES[c];
		if (token.code == null) {
			token.code = c.charCodeAt(0);
		}
	}
	token.clss = "esc";
	return token;
};

p.parseQuant = function (str, token) {
	token.type = token.clss = "quant";
	var i = token.i;
	var end = str.indexOf("}", i + 1);
	token.l += end - i;
	var arr = str.substring(i + 1, end).split(",");
	token.min = parseInt(arr[0]);
	token.max = (arr[1] == null) ? token.min : (arr[1] == "") ? -1 : parseInt(arr[1]);
	if (token.max != -1 && token.min > token.max) {
		token.err = "quantrev";
	}
	return token;
};

p.validateRange = function (str, token) {
	var prev = token.prev, next = token.next;
	if (prev.code == null || next.code == null) {
		// not a range, rewrite as a char:
		this.parseChar(str, token);
	} else {
		token.clss = "set";
		if (prev.code > next.code) {
			token.err = "rangerev";
		}
		// preserve as separate tokens, but treat as one in the UI:
		next.proxy = prev.proxy = token;
		token.set = [prev, token, next];
	}
	return next;
};

module.exports = RegExLexer;
