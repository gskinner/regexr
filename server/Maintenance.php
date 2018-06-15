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

if (!isCLI()) {
    exit("cli only, bye.");
}

/**
 * Maintenance class that should run on a cron.
 * Runs cleanup functions on the database / filesystem.
 */

$api = new \core\API();

$api->connect();
$db = $api->getDB();

// TODO: Write flag for if this is done or not.
$runCount = 0;
$deletedCount = 0;
while (true) {
    // Delete temporary users, and their private patterns, when they have no session.
    $users = $db->query("SELECT u.id as userId
                FROM users as u
                LEFT JOIN sessions as s ON s.userId=u.id
                WHERE u.type='temporary' && s.id IS NULL LIMIT 100000");

    $tmpUserCount = count($users);

    if ($tmpUserCount == 0) {
        break;
    }

    $deletedCount += $tmpUserCount;

    $runCount++;

    $usersToDelete = quoteStringArray(array_column($users, "userId"));

    $db->begin();
    $db->query("DELETE FROM patterns WHERE visibility='private' && owner IN ($usersToDelete)");
    $db->query("DELETE FROM favorites WHERE userId IN ($usersToDelete)");
    $db->query("DELETE FROM users WHERE id IN ($usersToDelete)");
    $db->commit();

    sleep(3);
}

echo("Completed! Deleted $deletedCount users.\n");
