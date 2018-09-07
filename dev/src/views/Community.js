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

import LinkRow from "../controls/LinkRow";
import $ from "../utils/DOMUtils";
import Utils from "../utils/Utils";
import Example from "./Example";
import Server from "../net/Server";

import app from "../app";

// also used for My Patterns.
export default class CommunityContent {
	constructor (el) {
		this.el = el;
		this.example = new Example();
		el.appendChild(this.example.el);
		$.query(".icon.thumbup", el).addEventListener("click", ()=>this._rate(1));
		$.query(".icon.thumbdown", el).addEventListener("click", ()=>this._rate(-1));
		$.query(".icon.favorites", el).addEventListener("click", ()=>this._favorite());
		this.linkRow = new LinkRow($.query(".row.link", el))
		$.query(".icon.share", el).addEventListener("click", ()=>this._share());
	}
	
	set item(o) {
		let el = this.el;
		this._pattern = o;
		$.query(".author", el).innerText = o.author ? "by "+o.author  : "";
		$.query(".name.label", el).innerText = o.name;
		$.query(".desc", el).innerText = o.description || "No description available.";
		this._updateRating();
		this._updateFavorite();
		this.example.example = [o.expression, o.text];

		this.linkRow.pattern = o;
	}
	
// private methods:
	_updateRating() {
		let o = this._pattern, el = this.el;
		$.query(".rating", el).innerText = o.rating.toFixed(1);
		$.removeClass($.query(".icon.rate.selected", el), "selected");
		if (o.userRating === 1) { $.addClass($.query(".icon.thumbup", el), "selected"); }
		else if (o.userRating === -1) { $.addClass($.query(".icon.thumbdown", el), "selected"); }
	}

	_updateFavorite() {
		let o = this._pattern, el = this.el;
		$.toggleClass($.query(".icon.favorites", el), "selected", !!o.favorite);
	}

	_rate(val) {
		let o = this._pattern;
		o.userRating =  (val === o.userRating) ? 0 : val;
		this._updateRating();
		
		Server.rate(o.id, o.userRating).then((data) => this._handleRate(data));
	}

	_share() {
		app.load(this._pattern);
		app.share.show();
	}

	_handleRate(data) {
		if (data.id === this._pattern.id) {
			this._pattern.rating = data.rating;
			this._updateRating();
		}
	}

	_favorite() {
		let o = this._pattern;
		Server.favorite(o.id, !o.favorite).then((data) => this._handleFavorite(data));
	}

	_handleFavorite(data) {
		if (data.id === this._pattern.id) {
			this._pattern.favorite = data.favorite;
			this._updateFavorite();
		}
	}

}