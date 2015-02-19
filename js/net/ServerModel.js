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
(function (scope) {
	"use strict";

	var s = {};
	s.END_POINT = "php/RegExr.php";

	s.searchTags = function(term) {
		return s._createPromise("searchTags", {term:term});
	};

	/**
	 *
	 * @param tags
	 * @param name
	 * @param pattern
	 * @param content
	 * @param replace
	 * @param description
	 * @param author
	 * @param id (Optional) PatternID to update
	 * @param token (Optional) save token users to update (users can update patterns within 24 hours of a save).
	 * @returns {*}
	 */
	s.savePattern = function(tags, name, pattern, content, replace, description, author, isPublic, id, token, state) {
		return s._createPromise("savePattern", {
			tags:tags,
			name:name,
			pattern:pattern,
			content:content,
			replace:replace,
			description:description,
			author:author,
			isPublic:isPublic,
			id:id,
			token: token,
			state: JSON.stringify(state)
		});
	};

	s.search = function(query, startIndex, limit) {
		return s._createPromise("search", {
			query:query,
			startIndex:startIndex || 0,
			limit:limit || 100
		});
	};

	s.rate = function(patternID, rating) {
		return s._createPromise("rate", {
			patternID:patternID,
			rating:rating,
		});
	};

	s.getPatternByID = function(patternID) {
		return s._createPromise("getPatternByID", {
			patternID:patternID
		});
	};

	s.getPatternList = function(ids) {
		if (!Array.isArray(ids)) {
			throw new Error("You must pass an array,");
		}
		return s._createPromise("getPatternList", {idList:ids});
	};

	s.trackVisit = function(id) {
		return s._createPromise("trackVisit", {id:id})
	};

	s.changeCategory = function(patternID, newCategory) {
		return s._createPromise("changeCategory", {
			patternID:patternID,
			newCategory:newCategory
		});
	};

	s._createPromise = function(method, data, endPoint) {
		var p = new Promise(function(resolve, reject) {
			var xhr = new XMLHttpRequest();
			xhr.open("POST", endPoint || s.END_POINT, true);

			xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
			xhr.onreadystatechange = function() {
				if (xhr.readyState != 4) {
					return;
				}

				// .responseText for IE9
				var result = xhr.response || xhr.responseText;
				if (!result) {
					reject({error:"No response."});
					return;
				}

				var json = null;

				try {
					json = JSON.parse(result);
				} catch (e) {
					reject({error:e});
					return;
				}

				if (json.success) {
					resolve(json.data);
				} else {
					reject(json.data);
				}
			};

			var postData = data || {};

			for (var n in postData) {
				var v = postData[n];
				if (v == null) {
					postData[n] = "";
				} else if (Array.isArray(v)) {
					postData[n] = v.join(",");
				} else if (typeof v == "boolean") {
					postData[n] = v === true?1:false;
				}
			}

			postData.action = method;
			var params = [];
			for (var n in postData) {
				params.push(n+"="+encodeURIComponent(postData[n]));
			}
			xhr.send(params.join("&"));
		}).catch(function(error) {
			DEBUG && console.error(error.stack);
			throw error;
		});

		return p
	};

	scope.ServerModel = s;

}(window));
