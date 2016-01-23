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

var Utils = require('../utils//Utils');
var Docs = require('../utils/Docs');
var ExpressionHighlighter = require('../ExpressionHighlighter');

var Explain = {};

Explain.forExpression = function(expr, token, highlighter) {
	var groupClasses = ExpressionHighlighter.GROUP_CLASS_BY_TYPE, pre = "exp-";
	var result = $.div(null, "explain"), el = result;
	
	var enterHandler = function(evt) {
		var o = evt.currentTarget;
		highlighter.selectToken(o.token);
		$.addClass(o, "selected");
		evt.stopPropagation();
	};
	var exitHandler = function(evt) {
		highlighter.selectToken(null);
		$.removeClass(evt.currentTarget, "selected");
		evt.stopPropagation();
	};
	
	while ((token = token.next) && (token.type != "close")) {
		if (token.proxy) { continue; }
		
		var i = token.i, end = token.end, content=expr.substring(i, end);
		if (token.set) {
			var set0=token.set[0], set2=token.set[2];
			content = "<span class='"+pre+(set0.clss || set0.type)+"'>"+expr.substring(set0.i, set0.end)+"</span>";
			content += expr.substring(i, end);
			content += "<span class='"+pre+(set2.clss || set2.type)+"'>"+expr.substring(set2.i, set2.end)+"</span>";
		}
		var className = pre + (token.clss || token.type);
		content = "<code class='str "+className+"'>"+content+"</code> ";
		if (!token.open) { content += Docs.forToken(token); }
		var div = $.div(content);
		el.appendChild(div);
		
		if (token.close) { 
			className = groupClasses[token.clss || token.type];
			if (className) {
				className = className.replace("%depth%", token.depth);
				$.addClass(div, className);
			}
			el = div;
		}
		
		if (token.clss == "quant" || token.type == "lazy") {
			$.addClass(div, "related");
		}
		
		if (token.open) {
			$.addClass(div, "close");
			el = el.parentNode;
		}
		
		if (token.err) {
			$.addClass(div, "error");
		}
		
		if (!token.open) {
			div.token = token;
			div.addEventListener("mouseover", enterHandler);
			div.addEventListener("mouseout", exitHandler);
		}
	}
	
	return result;
};
module.exports = Explain;
