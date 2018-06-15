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

// Global utility methods.

/**
 * @param $value
 * @param $key
 * @param null $default
 * @return null|*
 *
 * Safely return an array or object value, or a default if the key doest exist.
 */
function idx($value, $key, $default = null) {
    if (is_null($value) || is_null($key)) {
        return $default;
    }

    if (is_array($value)) {
        if (array_key_exists($key, $value)) {
            return $value[$key];
        }
    } else {
        if (property_exists($value, $key)) {
            return $value->$key;
        }
    }
    return $default;
}

function safeRequireOnce($name, $throw = true) {
    if (file_exists(__DIR__ . '/' . $name)) {
        require_once($name);
    } else if($throw) {
        throw new \core\APIError(\core\ErrorCodes::NO_ACTION, "Action $name does not exist.");
    }
}

/**
* Shortcut to get the correct length of a UTF-8 encoded string.
*/
function realStringLength($str) {
    return mb_strlen($str, "UTF-8");
}

/**
* Current time in MS
*/
function now() {
    return microtime(true)*1000;
}

function formatActionNameForExecution($name) {
    return str_replace("/", "\\", $name);
}

/**
 * @param $timestamp
 * @return string
 *
 * Format a unix timestamp (in seconds) to a valid DATETIME value.
 */
function unixtimeToDatetime($timestamp) {
    if (is_null($timestamp)) {
        return null;
    }
    return date('Y-m-d H:i:s', $timestamp);
}

/**
 * @param $arr
 * @return string
 *
 * Join an array, but wrap each value in single quotes, suitable for passing to an SQL IN statement.
 */
function quoteStringArray($arr) {
    return "'" . implode("', '", $arr) . "'";
}

function isCLI() {
    return php_sapi_name() == "cli";
}

function convertToURL($id) {
    return base_convert(($id + 1000000) * 3, 10, 32);
}

function convertFromURL($id) {
		if (!empty($id)) {
				return base_convert($id, 32, 10) / 3 - 1000000;
		}
		return null;
}

function createPatternNode($row) {
    // Migrate over old "replace" and "state" formats.
    $tool = (array)json_decode(stripslashes(idx($row, 'state')));
    $replace = idx($row, 'replace');

    if (is_null($tool)) {
        $tool = [];
    }

    if (!empty($tool) && array_key_exists('toolValue', $tool)) {
        $id =  $tool['tool'];
        $value = $tool['toolValue'];
        $tool = ['id' => $id, 'input' => $value];
    } else if (!empty($replace) && empty($tool)) {
        $tool['id'] = 'replace';
        $tool['input'] = $replace;
    }

    if (empty($tool)) {
        $tool = null;
    }

    $result = array(
        'id' => convertToURL(idx($row, 'id')),
        'keywords' => idx($row, 'keywords'),
        'name' => stripslashes(idx($row, 'name')),
        'description' => stripslashes(idx($row, 'description')),
        'dateAdded' => strtotime(stripslashes(idx($row, 'dateAdded')))*1000,
        'flavor' => idx($row, 'flavor'),
        'expression' => stripslashes(idx($row, 'pattern')),
        'text' => stripslashes(idx($row, 'content')),
        'tool' => $tool,
        'rating' => idx($row, 'rating'),
        'userId' => intval(idx($row, 'owner')),
        'author' => stripslashes(idx($row, 'author')),
        'userRating' => idx($row, 'userRating') ?? '0',
        'favorite' => !is_null(idx($row, 'favorite')),
        'access' => idx($row, 'visibility'),
    );

    return $result;
}

function createPatternSet($result, $total = -1, $startIndex = 0, $limit = 100) {
    $results = array();
    for ($i=0;$i<count($result);$i++) {
        $results[] = createPatternNode($result[$i]);
    }

    return array(
        'startIndex' => $startIndex,
        'limit' => $limit,
        'total' => $total,
        'results' => $results
    );
}


function savePattern($db, $name, $content, $pattern, $author, $description, $keywords, $state, $type, $userId, $visibility=null) {
    if (is_null($visibility)) {
        $visibility = \core\PatternVisibility::PROTECTED;
    }

    $sql = "INSERT INTO patterns
    (
        name,
        content,
        `pattern`,
        author,
        dateAdded,
        description,
        keywords,
        state,
        flavor,
        owner,
        visibility
    )
        VALUES
    (
        '{$name}',
        '{$content}',
        '{$pattern}',
        '{$author}',
        NOW(),
        '{$description}',
        '{$keywords}',
        '{$state}',
        '{$type}',
        '{$userId}',
        '{$visibility}'
    )";

    $db->query($sql);

    return $db->getLastId();
}

function getClientIpAddr() {
	$ip = $_SERVER['REMOTE_ADDR']?:($_SERVER['HTTP_X_FORWARDED_FOR']?:$_SERVER['HTTP_CLIENT_IP']);
	return $ip;
}
