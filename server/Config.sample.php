<?php
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

// Database defaults.
define('DB_HOST', 'YOUR_DB_HOST');
define('DB_USER_NAME', 'YOUR_DB_USER_NAME');
define('DB_PASSWORD', 'YOUR_DB_PASSWORD');
define('DB_NAME', 'YOUR_DB_NAME');

define('CACHE_PATH', './cache/');
define('DEBUG', true);

// OAUTH
define('SESSION_NAME', 'session');

if (DEBUG) {
    // We can pass a special session header for debugging, this key must match to use it.
    define('DEBUG_SESSION', '--some random string--');
}

// Create one at: https://console.developers.google.com/apis/credentials
// You also need to enable Google+ support https://console.developers.google.com/apis/api/plus.googleapis.com
define('GOOGLE_ID', '--');
define('GOOGLE_SECRET', '--');

// Create one at: https://github.com/settings/applications/
define('GITHUB_ID', '--');
define('GITHUB_SECRET', '--');

// https://developers.facebook.com/apps
define('FACEBOOK_ID', '--');
define('FACEBOOK_SECRET', '--');
