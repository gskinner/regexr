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

import Utils from "../utils/Utils";
import app from "../app";

export default class Server {
	
// regex:
	static solve(req) {
		return Server._getRequest("regex/solve", {data: JSON.stringify(req)});
	}
	
	static version(flavor) {
		return Server._getRequest("regex/version", {flavor:flavor});
	}

// patterns:
	static communitySearch(str) {
		return Server._getRequest("patterns/search", {query:str||"", startIndex:0, limit:100}, (data) => { this._processPatternList(data); });
	}
	
	static load(id) {
		return Server._getRequest("patterns/load", {patternId:id}, (data) => this._processPattern(data));
	}
	
	static save(pattern, fork) {
		// clone and prep the pattern object:
		let o = this._prepPattern(pattern, fork);
		return Server._getRequest("patterns/save", o, (data) => this._processPattern(data));
	}

	static rate(id, rating) {
		return Server._getRequest("patterns/rate", {patternId:id, userRating:rating}, (data) => data.rating = Number(data.rating));
	}
	
	static delete(id) {
		return Server._getRequest("patterns/delete", {patternId:id});
	}
	
	static favorite(id, value) {
		return Server._getRequest("patterns/favorite", {patternId:id, favorite:!!value});
	}
	
	static private(id, value) {
		return Server.setAccess(id, value ? "private" : "protected");
	}

	static setAccess(id, value) {
		return Server._getRequest("patterns/setAccess", {patternId:id, access:value});
	}

	static multiFavorite(ids) {
		return Server._getRequest("patterns/multiFavorite", {patternIds:JSON.stringify(ids)});
	}

// account:
	static login(service) {
		window.location = Server.url + "?action=account/login&type="+service;
	}

	static logout() {
		return Server._getRequest("account/logout", {});
	}
	
	static verify() {
		return Server._getRequest("account/verify", {});
	}

	static patterns() {
		return Server._getRequest("account/patterns", {}, (data) => {
			this._processPatternList(data);
			data.results.sort((a, b) => {
				return (b.favorite - a.favorite) || (b.dateAdded - a.dateAdded) || 1-2*(a.id > b.id);
			})
		});
	}

// helpers:
	static _processPatternList(data) {
		data.results.forEach(this._processPattern);
	}

	static _processPattern(o) {
		// parse values:
		o.rating = Number(o.rating);
		o.userRating = Number(o.userRating);
		o.flavor = o.flavor || "js";
		o.text = o.text || null;
		if (o.tool && o.tool.id) { o.tool.id = o.tool.id.toLowerCase(); }
	}

	static _prepPattern(o, fork) {
		o = Utils.clone(o);
		if (fork) {
			o.parentId = o.id;
			delete(o.id);
			o.name = Utils.getForkName(o.name);
		}
		// clear null values:
		if (!o.id) { delete(o.id); }
		if (!o.parentId) { delete(o.parentId); }
		delete(o.userId); // this gets added by the server
		o.tool = JSON.stringify(o.tool);
		return o;
	}

// private methods:
	static _getRequest(action, data={}, postprocess) {
		let req = new XMLHttpRequest(), p = new ServerPromise(req, postprocess), params = [];
		req.open("POST", Server.url);
		req.setRequestHeader("Content-type", "application/x-www-form-urlencoded", true);
		req.timeout = 5000;
		data.action = action;
		
		if (Server.isLocal && Server.useBeta) { data.userId = 111; }
		for (let n in data) { params.push(n + "=" + encodeURIComponent(data[n])); }
		if (Server.isLocal) { console.log(data); }
		req.send(params.join("&"));
		return p;
	}
}

class ServerPromise {
	constructor(req, postprocess) {
		this._req = req;
		this._postprocess = postprocess;
		req.addEventListener("load", ()=>this._load());
		req.addEventListener("timeout", (evt)=>this._error("servercomm"));
		req.addEventListener("error", (evt)=>this._error("servercomm"));
	}

	then(f, cf, ff) {
		this._loadF = f;
		if (cf) { this.catch(cf); }
		if (this._data) { f(this._data); }
		if (ff) { this.finally(ff); }
		return this;
	}
	
	catch(f) {
		this._errorF = f;
		if (this._err) { f(this._err); }
		return this;
	}

	finally(f) {
		this._finallyF = f;
		if (this._complete) { f(); }
		return this;
	}
	
	abort() {
		if (this._complete) { return; }
		this._complete = true;
		this._req.abort();
		this._finallyF && this._finallyF();
		this._loadF = this._errorF = this._finallyF = null; // just to make sure.
	}
	
	_load() {
		let json;
		this._complete = true;
		if (Server.isLocal) { console.log(this._req.response || this._req.responseText); }
		try { json = JSON.parse(this._req.response || this._req.responseText); }
		catch (e) { return this._error(e); }
		if (!json.success) { return this._error(json.data); }
		this._postprocess && this._postprocess(json.data);
		this._data = json.data;
		this._loadF && this._loadF(this._data);
		this._finallyF && this._finallyF();
	}
	
	_error(e) {
		this._err = (e.data && e.data.error) || e.message || e.detail || e.type || String(e);
		this._errorF && this._errorF(this._err);
		this._finallyF && this._finallyF();
	}
}

Server.isLocal = (window.location.hostname === "localhost");
Server.useBeta = Server.isLocal || (window.location.hostname === "beta.regexr.com");
Server.host = "https://" + (Server.useBeta ? "beta." : "") + "regexr.com"
Server.url =  Server.host + "/server/api.php";