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
	s.activePromise = null;
	s.existing = null;
	s.cache = {};

	s._term = "";

	s.search = function(term, existing) {
		if (s.activePromise) {
			s.activePromise.cancelled = true;
		}

		s._term = term.toLocaleLowerCase();

		if (s.cache[s._term]) {
			return Promise.resolve(s.cache[s._term]);
		}

		s.existing = {};
		if (existing) {
			for (var i=0;i<existing.length;i++) {
				s.existing[existing[i].toLocaleLowerCase()] = true;
			}
		}

		s.activePromise = ServerModel.searchTags(term);
		s.activePromise.cancelled = false;
		s.activePromise.then(s.handleTagsLoad);
		return s.activePromise.then(s.handleTagsLoad);
	};

	s.handleTagsLoad = function (data) {
		var cleanData = [];
		for (var i=0;i<data.length;i++) {
			if (s.existing[data[i].name.toLocaleLowerCase()]) {
				continue;
			}
			cleanData.push(data[i].name);
		}

		s.cache[s._term] = cleanData;

		return Promise.resolve(cleanData);
	};

	scope.TagsModel = s;

}(window));
