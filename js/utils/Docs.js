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

var documentation = require('../documentation');
var TextUtils = require('./TextUtils');
var Utils = require('./Utils');
var $ = Utils;

var Docs = {};

Docs.NONPRINTING_CHARS = {
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

Docs.content = null;
Docs.ids = null;

Docs.setContent = function (content) {
	Docs.content = content;
	var ids = {};
	var parseContent = function (content, o) {
		var kids = content.kids;
		if (content.id) {
			ids[content.id] = content;
			if (o) {
				o[content.id] = content;
			}
		}
		if (kids) {
			o = content.ids = {};
			for (var i = 0, l = kids.length; i < l; i++) {
				parseContent(kids[i], o);
				kids[i].parent = content;
			}
		}
	};
	parseContent(content.library);
	parseContent(content.misc);
	Docs.ids = ids;
};

Docs.getItem = function (id) {
	return Docs.ids[id];
};

Docs.forMatch = function (match) {
	if (!match) {
		return null;
	}
	var str = "<b>match: </b>" + TextUtils.htmlSafe(TextUtils.shorten(match[0], 150)) +
			"<br/><b>range: </b>" + match.index + "-" + match.end;
	var l = match.length;
	if (l > 1) {
		str += "<hr/>";
	}
	for (var i = 1; i < l; i++) {
		if (i > 1) {
			str += "<br/>";
		}
		str += "<b>group #" + i + ": </b>" + TextUtils.htmlSafe(TextUtils.shorten(match[i], 40));
	}
	return str;
};

Docs.forToken = function (token) {
	var pre = "", post = "", label = "", docs = Docs.content;
	if (!token) {
		return null;
	}
	if (token.open) {
		token = token.open;
	}
	if (token.err) {
		return "<span class='error-title'>ERROR: </span>" + docs.errors[token.err] || "[" + token.err + "]";
	}

	var type = token.type, clss = token.clss, ids = Docs.ids, id = type, tip;

	var node = ids[id];
	if (node) {
		label = token.label || node.label || node.id;
		if (id == "group") {
			label += " #" + token.num;
		}
		label = "<b>" + label[0].toUpperCase() + label.substr(1) + ".</b> ";
	}

	// Special cases:
	if (clss == "quant") {
		node = ids[clss];
	}
	if (type == "char" || clss == "esc") {
		if (clss == "esc") {
			pre = ((ids[type] && ids[type].desc) || "<b>Escaped character.</b>") + " ";
		}
		node = ids[token.js ? "js_char" : "char"];
	}

	tip = node ? (node.tip || node.desc) : "no docs for type='" + type + "'";
	return label + pre + $.fillTags(tip, token, Docs) + post;
};

Docs.forErrorResult = function (type, errors) {
	var node = Docs.ids[type];
	return "<span class='error-title'>ERROR: </span>" + (node.tip || node.desc);
};

Docs.getDesc = function (id) {
	var node = Docs.ids[id];
	return node && node.desc || ("Content not found:" + id);
};

Docs.getQuant = function (token) {
	var min = token.min, max = token.max;
	return min == max ? min : max == -1 ? min + " or more" : "between " + min + " and " + max;
};

Docs.getChar = function (token) {
	var chr = Docs.NONPRINTING_CHARS[token.code];
	return chr ? chr : "\"" + String.fromCharCode(token.code) + "\"";
};

Docs.getEscCharDocs = function (c, t, template) {
	var code = c.charCodeAt(0);
	var chr = Docs.NONPRINTING_CHARS[code] || c;
	return {
		token: "\\" + (t || c),
		label: chr.toLowerCase(),
		desc: $.fillTags(template, {code: code}, Docs)
	};
};

Docs.getCtrlKey = function () {
	return Utils.getCtrlKey();
};

// Inject text from the documentation file.
(function () {
	// add escaped characters to the reference:
	var reference = documentation.library.kids[1];
	var chars = "\t\n\v\f\r\0.\\+*?^$[]{}()|/";
	var tokens = "tnvfr0";
	var kids = reference.kids[2].kids;
	for (var i = 0; i < chars.length; i++) {
		kids.push(Docs.getEscCharDocs(chars[i], tokens[i], documentation.misc.kids[0].tip));
	}

	Docs.setContent({
		errors: documentation.errors,
		library: documentation.library,
		misc: documentation.misc
	});
})();

module.exports = Docs;
