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
(function() {
	"use strict";

	var SubstLexer = function() {};
	var p = SubstLexer.prototype;

	// \ ^ $ . | ? * + ( ) [ {
	SubstLexer.TYPES = {
		"$" : null,
		"&" : "subst_match",
		"`" : "subst_pre",
		"'" : "subst_post"
	};

	p.token = null;

	p.parse = function(str, capGroups) {
		this.token = null;

		var prev, types=SubstLexer.TYPES, numGroups = capGroups.length;
		for (var i=0, l=str.length; i<l; i+=token.l) {
			var c=str[i], d, match, token = {prev:token, i:i, l:1};

			if (c == "$" && i+1<l && (match = str.substr(i+1).match(/^([$&`']|\d\d?)/))) {
				d = match[0];
				token.type = types[d];

				if (token.type === undefined) {
					var group = parseInt(d);
					if (d.length > 1 && group > numGroups) { d=d[0]; group=parseInt(d); }
					if (group > 0 && group <= numGroups) {
						token.type = "subst_num";
						token.group = capGroups[group-1];
						token.l += d.length-1;
					}
				}
				if (token.type !== undefined) { token.clss = "subst"; token.l++; }
			}

			if (!token.type) {
				//continue;
				token.type = "subst_char";
				token.code = c.charCodeAt(0);
			}

			token.end = token.i+token.l;

			if (prev) { prev.next = token; }
			if (!this.token) { this.token = token; }
			prev = token;
		}

		return this.token;
	};
	
	window.SubstLexer = SubstLexer;
})();
