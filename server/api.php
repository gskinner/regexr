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

require_once("bootstrap.php");

use core\Cache;

// Everything comes back as JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: ' . (DEBUG?'POST, GET':'POST'));

if (DEBUG) {
    header("Access-Control-Allow-Origin: *");
}

// Grab the correct values.
// OAUTH will use $_GET, the internal RegExr apis will use $_POST;
$values = $_REQUEST;

// Run the application!
(new \core\API())->execute($values);
