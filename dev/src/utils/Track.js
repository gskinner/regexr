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

let Track = {};
export default Track;

Track.GA_ID = "UA-3579542-6";

Track.page = function(path) {
	gtag("config", Track.GA_ID, {"page_path": "/"+path});
};

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
Track.event = function(name, category, label) {
	let o = {};
	if (category) { o.event_category = category; }
	if (label) { o.event_label = label; }
	gtag("event", name, o);
}


