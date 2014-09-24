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

	var SubstFuncLexer = function() {};
	var p = SubstFuncLexer.prototype;

	SubstLexer.WORDS = {
		match: "subst_match",
		group: "subst_num",
		offset: "subst_offset",
		string: "subst_string",

		"function": "subst_keyword",
		"return": "subst_keyword"
	};

	p.string = null;
	p.token = null;
	p.errors = null;
	p.substMode = true;

	p.parse = function(str, capGroups) {
		var i, l;
		this.string = str;
		this.errors = [];

		var funcerr = {i: -1};
		try {
			var args = ["match"];
			for(i = 0, l = capGroups.length; i < l; ++i)
				args.push("group" + (i + 1));
			args.push("offset", "string", str.substr(33 + 8 * capGroups.length));
			var func = Function.constructor.apply(void 0, args);
		} catch(e){
			funcerr = {i: 40 + e.columnNumber, msg: e.message};
		}

		var prev = this.token = null, string = null, d;
		for (i=0, l=str.length; i<l; i+=token.l) {
			var c=str[i], token = {prev:prev, i:i, l:1, js:true};

			if(funcerr.i === i){
				token.err = "javascript";
			} else if(string){
				if((c == '"' || c == "'")){
					token.type = "string";
					token.open = string;
					string.close = token;
					string = null;
				} else if (c == "\\")
					this.parseEsc(str, token, string);
				else {
					token.type = "char";
					token.code = c.charCodeAt(0);
				}
			} else {
				if(c == '"' || c == "'"){
					token.type = token.clss = "string";
					string = token;
				} else if(c.match(/\w/))
					this.parseVar(str, token, capGroups);
				else if(c === "." && (d = str.substr(token.i).match(/^\.\w+/)) !== null){
					token.type = "subst_method";
					token.l = d[0].length;
				}	else
					token.type = "nothing";
			}

			if (prev) { prev.next = token; }
			if (!this.token) { this.token = token; }
			token.end = token.i+token.l;
			if (token.err) { this.errors.push(token.err); }
			prev = token;
		}

		return this.token;
	};

	p.parseVar = function(str, token, capGroups){
		var d = str.substr(token.i).match(/^[a-z]+/);
		if(!d) return;
		else d = d[0];

		if(SubstLexer.WORDS[d]){
			if(d == "group"){
				var group = parseInt(str.substring(token.i + 5, token.i + 7));
				if(group && group <= capGroups.length){
					token.group = capGroups[group - 1];
					token.l += d > 9? 2 : 1;
				} else return;
			}
			token.type = SubstLexer.WORDS[d];
		} else {
			d = str.substr(token.i).match(/^\w+/);
			if(!d) return;
			else d = d[0];

			if(window[d])
				token.type = "subst_method";
		}
		if(!token.type) token.err = "variable";
		token.l += d.length - 1;
	};

	p.parseEsc = RegExLexer.prototype.parseEsc;

	window.SubstFuncLexer = SubstFuncLexer;
})();
