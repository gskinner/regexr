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

try {
    require_once("./server/bootstrap.php");
    $api = new \core\API();
    $api->connect();
    $db = $api->getDB();

    $userProfile = (object)(new \account\verify())->run($db);
} catch (\Exception $ex) {
    $userProfile = [];
}

$pattern = 'null';
$result = [];
$success = preg_match("/([a-z0-9]+)\$/", $_SERVER['REQUEST_URI'], $result);
if ($success == true) {
    $stringId = $result[0];
    $id = convertFromURL($stringId);
    if (!is_null($id) && $id > 0) {
        try {
            $pattern = json_encode((new \patterns\load(['patternId'=>$stringId]))->run($db));
        } catch (\Exception $ex) {
            $pattern = null;
        }
    }
}

$defaults = json_encode([
    "userId" => idx($userProfile, 'userId'),
    "authenticate" => idx($userProfile, 'authenticated'),
    "username" => idx($userProfile, 'username'),
    "author" => idx($userProfile, 'author'),
    "type" => idx($userProfile, 'type')
]);

$versions = json_encode([
    "PCREVersion" => PCRE_VERSION,
    "PHPVersion" => PHP_VERSION
]);

$pattern = is_null($pattern)?'null':$pattern;

$initTemplate = "regexr.init($pattern,$defaults,$versions);";

$indexFile = file_get_contents('./index.html');

$openScriptTag = '<script id="phpinject">';
$closeScriptTag = '</script>';
$scriptIdx = strrpos($indexFile, $openScriptTag) + strlen($openScriptTag);
$endIndexFile = strrpos($indexFile, $closeScriptTag, $scriptIdx);

ob_start('ob_gzhandler');
echo(substr($indexFile, 0, $scriptIdx) . $initTemplate . substr($indexFile, $endIndexFile));
ob_flush();
