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
var ExpressionHighlighter = function (cm, classPrefix, offset) {
	this.initialize(cm, classPrefix, offset);
};
var p = ExpressionHighlighter.prototype;

ExpressionHighlighter.GROUP_CLASS_BY_TYPE = {
	set: "exp-group-set",
	setnot: "exp-group-set",
	group: "exp-group-%depth%",
	lookaround: "exp-group-%depth%"
};

p.cm = null;
p.prefix = "exp-";
p.selectedToken = null;
p.selectedMarks = null;
p.activeMarks = null;
p.offset = 0;

p.initialize = function (cm, offset) {
	this.cm = cm;
	this.offset = offset || 0;
	this.activeMarks = [];
	this.selectedMarks = [];
};

p.draw = function (token) {
	var cm = this.cm, pre = this.prefix;

	this.clear();
	var _this = this;
	cm.operation(function () {

		var groupClasses = ExpressionHighlighter.GROUP_CLASS_BY_TYPE;
		var doc = cm.getDoc(), endToken, marks = _this.activeMarks;

		while (token) {
			if (token.clear) {
				token = token.next;
				continue;
			}
			token = _this._calcTokenPos(doc, token);

			var className = pre + (token.clss || token.type);
			if (token.err) {
				className += " " + pre + "error";
			}

			if (className) {
				marks.push(doc.markText(token.startPos, token.endPos, {className: className}));
			}

			if (token.close) {
				endToken = _this._calcTokenPos(doc, token.close);
				className = groupClasses[token.clss || token.type];
				if (className) {
					className = className.replace("%depth%", token.depth);
					marks.push(doc.markText(token.startPos, endToken.endPos, {className: className}));
				}
			}
			token = token.next;
		}
	});

};

p.clear = function () {
	var _this = this;
	this.cm.operation(function () {
		var marks = _this.activeMarks;
		for (var i = 0, l = marks.length; i < l; i++) {
			marks[i].clear();
		}
		marks.length = 0;
	});
};

p.selectToken = function (token) {
	if (token == this.selectedToken) {
		return;
	}
	if (token && token.set && token.set.indexOf(this.selectedToken) != -1) {
		return;
	}
	while (this.selectedMarks.length) {
		this.selectedMarks.pop().clear();
	}
	this.selectedToken = token;
	if (!token) {
		return;
	}

	if (token.open) {
		this._drawSelect(token.open);
	}
	else {
		this._drawSelect(token);
	}
	if (token.related) {
		for (var i = 0; i < token.related.length; i++) {
			this._drawSelect(token.related[i], "exp-related");
		}
	}
};

p._drawSelect = function (token, style) {
	var endToken = token.close || token;
	if (token.set) {
		endToken = token.set[token.set.length - 1];
		token = token.set[0];
	}
	style = style || "exp-selected";
	var doc = this.cm.getDoc();
	this._calcTokenPos(doc, endToken)
	this._calcTokenPos(doc, token);
	this.selectedMarks.push(doc.markText(token.startPos, endToken.endPos, {
		className: style,
		startStyle: style + "-left",
		endStyle: style + "-right"
	}));
};

p._calcTokenPos = function (doc, token) {
	if (token.startPos || token == null) {
		return token;
	}
	token.startPos = doc.posFromIndex(token.i + this.offset);
	token.endPos = doc.posFromIndex(token.end + this.offset);
	return token;
};

module.exports = ExpressionHighlighter;
