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

import $ from "../utils/DOMUtils";
import Utils from "../utils/Utils";
import app from "../app";

import LinkRow from "../controls/LinkRow";
import Status from "../controls/Status";
import Account from "./Account";
import Server from "../net/Server";

export default class Share extends EventDispatcher {
	constructor (el) {
		super();
		this.el = el;
		this._pattern = false;
		this._initUI();
		app.on("change", () => this._handleAppChange());
		app.on("load", () => this._handleAppLoad());
		app.account.on("change", () => this._handleAccountChange());
	}

// public methods:
	get value() {
		return {
			id: this._pattern ? this._pattern.id : null,
			name: this.name,
			author: this.author,
			description: this.description,
			keywords: this.keywords
		}
	}

	set pattern(o) {
		this._pattern = o;
		this.name = o.name;
		this.description = o.description;
		this.keywords = o.keywords;

		this._updateUI();
		this._pushHistory(o);
	}

	get name() { return this.nameFld.value; }
	set name(val) {
		this.nameFld.value = val||"";
		this.hNameFld.innerText = val||"Untitled Pattern";
	}

	get author() { return this.authorFld.value; }
	set author(val) { this.authorFld.value = val||""; }

	get description() { return this.descriptionFld.value; }
	set description(val) { this.descriptionFld.value = val||""; }

	get keywords() { return this.keywordsFld.value; }
	set keywords(val) { this.keywordsFld.value = val||""; }

	show() {
		app.sidebar.goto("share");
	}

// private methods:
	_initUI() {
		let el = this.el;
		let mainEl = this.mainEl = $.query("> #share_main", el);
		let comEl = this.communityEl = $.query("> #share_community", el);

		// set up header:
		let hEl = $.query(".header");
		this.hNewBtn = $.query(".new", hEl);
		this.hForkBtn = $.query(".fork", hEl);
		this.hSaveBtn = $.query(".save", hEl);
		this.hNameFld = $.query(".name", hEl);
		$.query(".settings", hEl).addEventListener("click", () => this.show());
		$.query(".savekey", this.hSaveBtn).innerText = "("+Utils.getCtrlKey()+"-s)";
		this.hSaveBtn.addEventListener("click", () => this._doSave());
		this.hNewBtn.addEventListener("click", () => this._doNew());

		this._defaultName = this.hNameFld.innerText;

		// set up main:
		this._privateRow = $.query(".row.private", this.mainEl);
		this._privateRow.addEventListener("click", ()=> this._doPrivate());
		this._privateStatus = new Status($.query(".status", this._privateRow));
		this._favoritesRow = $.query(".row.favorites", this.mainEl);
		this._favoritesRow.addEventListener("click", ()=> this._doFavorite());
		this._favoritesStatus = new Status($.query(".status", this._favoritesRow));
		this._communityRow = $.query(".row.community", this.mainEl);
		this._communityRow.addEventListener("click", ()=> this._showCommunity());
		this._deleteRow = $.query(".row.delete", this.mainEl);
		this._deleteRow.addEventListener("click", ()=> this._doDelete());
		this._deleteStatus = new Status($.query(".status", this._deleteRow));
		$.query(".row.signin a", this.mainEl).addEventListener("click", ()=> this._doSignin());

		// set up link row:
		this._linkRow = new LinkRow($.query(".link.row", mainEl));

		// set up save buttons:
		let saveEl = this.saveEl = $.query("> .save", mainEl);
		this.saveBtn = $.query(".button.save", saveEl);
		this.forkBtn = $.query(".button.fork", saveEl);
		this.saveBtn.addEventListener("click", ()=> this._doSave());
		this.forkBtn.addEventListener("click", ()=> this._doSave(true));
		this.saveStatus = new Status($.query(".status", saveEl));
		this.saveMessage = $.query(".message", saveEl);

		// set up input fields:
		let infoEl = this.infoEl = $.query("> .info", mainEl);
		this.nameFld = $.query(".name", infoEl);
		this.authorFld = $.query(".author", infoEl);
		this.descriptionFld = $.query(".description", infoEl);
		this.keywordsFld = $.query(".keywords", infoEl);

		// listen for changes:
		this.nameFld.addEventListener("input", () => this._handleChange());
		this.authorFld.addEventListener("input", () => this._handleChange());
		this.descriptionFld.addEventListener("input", () => this._handleChange());
		this.keywordsFld.addEventListener("input", () => this._handleChange());
		
		/// set up community:
		let comInputsEl = $.query(".inputs", comEl)
		$.query(".button.cancel", comEl).addEventListener("click", ()=> app.sidebar.goto("share"));
		$.query(".button.share", comEl).addEventListener("click", ()=> this._doComSave());
		this.comSaveStatus = new Status($.query(".status", comEl));
		this._comNameFld = $.query(".name", comInputsEl);
		this._comAuthorFld = $.query(".author", comInputsEl);
		this._comDescriptionFld = $.query(".description", comInputsEl);
		this._comKeywordsFld = $.query(".keywords", comInputsEl);

		// set up cmd-s listener:
		window.document.addEventListener("keydown", (evt) => this._handleKey(evt) );
	}

	_updateUI() {
		let o = this._pattern, text;
		let isChanged = this._isChanged(), isNew = this._isNew(), isOwned = this._isOwned();
		
		$.toggleClass([this.forkBtn, this.hForkBtn], "disabled", !this._canFork());
		$.toggleClass(this.saveBtn, "disabled", !this._canSave());

		$.toggleClass(this.hSaveBtn, "disabled", !this._canSave() && isOwned);
		$.query(".action",this.hSaveBtn).innerText = isOwned ? "Save" : "Fork";
		
		if (!isOwned) { text = "This pattern was created by '"+(o.author||"[anonymous]")+"'."; }
		else if (!isChanged) { text = "No unsaved changes." }
		else if (isNew) { text = "Save will create a shareable public link."; }
		else { text = "Save will update the current link."; }

		if (!isOwned && !isChanged) { text += " Fork to create your own copy."; }
		else if (!isNew) { text += " Fork will create a new copy" + (isChanged ? " with your changes." : "."); }
		
		this._setSaveText(text);

		this._linkRow.pattern = this._pattern.id && this._pattern;

		$.toggleClass(this._privateRow, "disabled", isNew || !isOwned);
		$.toggleClass(this._favoritesRow, "disabled", isNew || !isOwned);
		$.toggleClass(this._communityRow, "disabled", isNew || !isOwned);
		$.toggleClass(this._deleteRow, "disabled", isNew || !isOwned);

		$.toggleClass(this._privateRow, "active", o.access === "private");
		$.toggleClass(this._favoritesRow, "active", !!o.favorite);
	}
	
	_isNew() {
		return !this._pattern.id;
	}

	_isOwned() {
		let o = this._pattern;
		return this._isNew() || (o.userId === app.account.userId);
	}

	_isChanged() {
		return app.unsaved;
	}

	_canSave() {
		return this._isChanged() && this._isOwned();
	}

	_canFork() {
		return !this._isNew();
	}

	_pushHistory(pattern) {
		let history = window.history, url = Utils.getPatternURL(pattern);
		let title = "RegExr: "+ (pattern.name || "Learn, Build, & Test RegEx");
		
		if (history.state && (pattern.id === history.state.id)) {
			history.replaceState(pattern, title, url);
		} else {
			history.pushState(pattern, title, url);
		}
		window.document.title = title;
	}

	_handleKey(evt) {
		let mac = Utils.isMac();
		if (evt.key === "s" && ((mac && evt.metaKey) || (!mac && evt.ctrlKey))) {
			this._doSave(false);
			evt.preventDefault();
		}
	}

	_doSave(fork) {
		// if we can't save for some reason, then show the panel.
		if (!fork && !this._canSave()) {
			app.sidebar.goto("share");
			return;
		}

		if (fork && !this._canFork()) { return; }

		let o = app.state;
		$.addClass($.query(".buttons", this.saveEl), "wait");
		this.saveStatus.distract();
		Server.save(o, fork)
			.then((data) => this._handleSave(data))
			.catch((err) => this._handleSaveErr(err));
	}

	_handleSave(data) {
		let isNew = (this._pattern.id == null), isFork = !isNew && (data.id !== this._pattern.id);
		$.removeClass($.query(".buttons", this.saveEl), "wait");
		this.saveStatus.hide();

		app.state = data;

		if (isFork || isNew) {
			this.show();
			if (isFork || !this.name) {
				this.nameFld.focus();
				this.nameFld.select();
			}
			this._linkRow.showMessage("<b>Saved.</b> New share link created. Click to copy to clipboard.");
		}
	}
	
	_handleSaveErr(err) {
		$.removeClass($.query(".buttons", this.saveEl), "wait");
		this.saveStatus.error(this._getErrMsg(err));
	}
	
	_doNew() {
		app.newDoc();
	}

	_doPrivate() {
		let o = this._pattern;
		this._privateStatus.distract();
		Server.private(o.id, o.access !== "private")
			.then((data) => this._handlePrivate(data))
			.catch((err) => this._handleErr(err, this._privateStatus));
	}

	_handlePrivate(data) {
		if (data.id === this._pattern.id) {
			this._pattern.access = data.access;
			this._privateStatus.hide();
			this._updateUI();
		}
	}
	
	_doFavorite() {
		let o = this._pattern;
		this._favoritesStatus.distract();
		Server.favorite(o.id, !o.favorite)
			.then((data) => this._handleFavorite(data))
			.catch((err) => this._handleErr(err, this._favoritesStatus));
	}
	
	_handleFavorite(data) {
		if (data.id === this._pattern.id) {
			this._pattern.favorite = data.favorite;
			this._favoritesStatus.hide();
			this._updateUI();
		}
	}

	_doDelete() {
		let o = this._pattern;
		if (!confirm("Are you sure you want to permanently delete this pattern?")) { return; }
		this._deleteStatus.distract();
		Server.delete(o.id)
			.then((data) => this._handleDelete(data))
			.catch((err) => this._handleErr(err, this._deleteStatus));
	}

	_handleDelete(data) {
		this._deleteStatus.hide();
		app.state = {
			flavor: app.flavor.value
		}
		setTimeout(()=>app.tooltip.toggle.showOn("delete", "Pattern was permanently deleted.", this._deleteRow, true, 0), 1);
	}

	_handleErr(err, status) {
		status.error(this._getErrMsg(err)).hide(6);
	}

	_showCommunity() {
		app.sidebar.goto("share_community");
		this._comNameFld.value = this.name;
		this._comAuthorFld.value = this.author;
		this._comDescriptionFld.value = this.description;
		this._comKeywordsFld.value = this.keywords;
	}

	_doComSave() {
		if (!this._comNameFld.value) {
			this._comNameFld.focus();
			return;
		}
		let o = app.state;
		this.name = o.name = this._comNameFld.value;
		this.author = o.author = this._comAuthorFld.value;
		this.description = o.description = this._comDescriptionFld.value;
		this.keywords = o.keywords = this._comKeywordsFld.value;
		o.access = "public";
		$.addClass($.query(".buttons", this.communityEl), "wait");
		this.comSaveStatus.distract();
		Server.save(o, true)
			.then((data) => this._handleComSave(data))
			.catch((err) => this._handleComSaveErr(err));
	}

	_handleComSave(data) {
		$.removeClass($.query(".buttons", this.communityEl), "wait");
		this.comSaveStatus.hide();
		this.show();
	}

	_handleComSaveErr(err) {
		$.removeClass($.query(".buttons", this.communityEl), "wait");
		this.comSaveStatus.error(this._getErrMsg(err));
	}

	_handleChange() {
		this.dispatchEvent("change");
	}

	_handleAppChange() {
		this._updateUI();
	}

	_handleAccountChange() {
		let acc = app.account, rowEl = $.query(".signin.row", this.mainEl);
		if (!this.authorFld.value) { this.authorFld.value = acc.author || acc.username; }
		$.toggleClass(rowEl, "authenticated", acc.authenticated);
		$.query(".username", rowEl).innerText = acc.username;
	}

	_handleAppLoad() {
		$.toggleClass($.query(".save .actions", this.mainEl), "disabled");
	}

	_doSignin() {
		app.account.showTooltip();
	}

	_setSaveText(str) {
		this.saveMessage.innerText = str;
	}

	_getErrMsg(err) {
		return "<span class='error'>ERROR:</span> "+app.reference.getError("servercomm");
	}
}