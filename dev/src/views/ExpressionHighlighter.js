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


import EventDispatcher from "../events/EventDispatcher";

export default class ExpressionHighlighter extends EventDispatcher {
	constructor(cm) {
		super();
		this.cm = cm;
		this._activeMarks = [];
		this._hoverMarks = [];
		this._hoverToken = null;
	}
	
	clear() {
		this.cm.operation(() => {
			let marks = this._activeMarks;
			for (var i = 0, l = marks.length; i < l; i++) {
				marks[i].clear();
			}
			marks.length = 0;
		});
	}
	
	draw(token) {
		let cm = this.cm, pre = ExpressionHighlighter.CSS_PREFIX;
	
		this.clear();
		cm.operation(() => {
			
			let groupClasses = ExpressionHighlighter.GROUP_CLASS_BY_TYPE;
			let doc = cm.getDoc(), endToken, marks = this._activeMarks;
	
			while (token) {
				if (token.clear) {
					token = token.next;
					continue;
				}
				token = this._calcTokenPos(doc, token);
	
				var className = pre + (token.clss || token.type);
				if (token.error) {
					className += " " + pre + (token.error.warning ? "warning" : "error");
				}
	
				if (className) {
					marks.push(doc.markText(token.startPos, token.endPos, {className: className}));
				}
	
				if (token.close) {
					endToken = this._calcTokenPos(doc, token.close);
					className = groupClasses[token.clss || token.type];
					if (className) {
						className = className.replace("%depth%", token.depth);
						marks.push(doc.markText(token.startPos, endToken.endPos, {className: className}));
					}
				}
				token = token.next;
			}
		});
	}
	
	set hoverToken(token) {
		if (token === this._hoverToken) { return; }
		if (token && token.set && token.set.indexOf(this._hoverToken) !== -1) { return; }
		while (this._hoverMarks.length) { this._hoverMarks.pop().clear(); }
		
		this._hoverToken = token;
		if (token) {
			if (token.open) {
				this._drawSelect(token.open);
			} else {
				this._drawSelect(token);
			}
			if (token.related) {
				for (let i = 0, l=token.related.length; i < l; i++) {
					this._drawSelect(token.related[i], ExpressionHighlighter.CSS_PREFIX + "related");
				}
			}
		}
		
		this.dispatchEvent("hover");
	};
	
	get hoverToken() {
		return this._hoverToken;
	}
	
	
// private methods:
	_drawSelect(token, style = ExpressionHighlighter.CSS_PREFIX+"selected") {
		let doc = this.cm.getDoc(), endToken = token.close || token;
		if (token.set) {
			endToken = token.set[token.set.length - 1];
			token = token.set[0];
		}
		
		this._calcTokenPos(doc, endToken);
		this._calcTokenPos(doc, token);
		this._hoverMarks.push(doc.markText(token.startPos, endToken.endPos, {
			className: style,
			startStyle: style + "-left",
			endStyle: style + "-right"
		}));
	};

	_calcTokenPos(doc, token) {
		if (token.startPos || token == null) {
			return token;
		}
		token.startPos = doc.posFromIndex(token.i);
		token.endPos = doc.posFromIndex(token.i+token.l);
		return token;
	};
	
};

ExpressionHighlighter.CSS_PREFIX = "exp-";

ExpressionHighlighter.GROUP_CLASS_BY_TYPE = {
	set: ExpressionHighlighter.CSS_PREFIX+"group-set",
	setnot: ExpressionHighlighter.CSS_PREFIX+"group-set",
	group: ExpressionHighlighter.CSS_PREFIX+"group-%depth%",
	lookaround: ExpressionHighlighter.CSS_PREFIX+"group-%depth%"
};