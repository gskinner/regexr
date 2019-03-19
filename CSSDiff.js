export default class CSSDiff {
	constructor() {}

	diff(base, targ, pretty = false) {
		let diff = this.compare(this.parse(base), this.parse(targ));
		return this._writeDiff(diff, pretty);
	}

	parse(s, o = {}) {
		this._parse(s, /([^\n\r\{\}]+?)\s*\{\s*/g, /\}/g, o);
		for (let n in o) {
			if (n === " keys") { continue; }
			o[n] = this.parseBlock(o[n]);
		}
		return o;
	}

	parseBlock(s, o = {}) {
		return this._parse(s, /([^\s:]+)\s*:/g, /(?:;|$)/g, o);
	}

	compare(o0, o1, o = {}) {
		let keys = o1[" keys"], l=keys.length, arr=[];
		for (let i=0; i<l; i++) {
			let n = keys[i];
			if (!o0[n]) { o[n] = o1[n]; arr.push(n); continue; }
			let diff = this._compareBlock(o0[n], o1[n]);
			if (diff) { o[n] = diff; arr.push(n); }
		}
		o[" keys"] = arr;
		return o;
	}

	_compareBlock(o0, o1) {
		let keys = o1[" keys"], l=keys.length, arr=[], o;
		for (let i=0; i<l; i++) {
			let n = keys[i];
			if (o0[n] === o1[n]) { continue; }
			if (!o) { o = {}; }
			o[n] = o1[n];
			arr.push(n);
		}
		if (o) { o[" keys"] = arr; }
		return o;
	}

	_parse(s, keyRE, closeRE, o) {
		let i, match, arr=[];
		while (match = keyRE.exec(s)) {
			let key = match[1];
			i = closeRE.lastIndex = keyRE.lastIndex;
			if (!(match = closeRE.exec(s))) { console.log("couldn't find close", key); break; }
			o[key] = s.substring(i, closeRE.lastIndex-match[0].length).trim();
			i = keyRE.lastIndex = closeRE.lastIndex;
			arr.push(key);
		}
		o[" keys"] = arr;
		return o;
	}

	_writeDiff(o, pretty = false) {
		let diff = "", ln="\n", s=" ";
		if (!pretty) { ln = s = ""; }
		let keys = o[" keys"], l=keys.length;
		for (let i=0; i<l; i++) {
			let n = keys[i];
			if (diff) { diff += ln + ln; }
			diff += n + s + "{" + ln;
			diff += this._writeBlock(o[n], pretty);
			diff += "}";
		}
		return diff;
	}

	_writeBlock(o, pretty = false) {
		let diff = "", ln="\n", t="\t", s=" ";
		if (!pretty) { ln = t = s = ""; }
		let keys = o[" keys"], l=keys.length;
		for (let i=0; i<l; i++) {
			let n = keys[i];
			diff += t + n + ":" + s + o[n] + ";" + ln;
		}
		return diff;
	}
}
