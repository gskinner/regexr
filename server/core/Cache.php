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

namespace core;

class Cache {

    public static function CommunityKey($query, $startIndex, $limit) {
        return sprintf("Community_%s_%s_%s", $query, $startIndex, $limit);
    }

    public static function PatternKey($key) {
        return sprintf("Pattern_%s", $key);
    }

    public static function SaveItem($key, $data, $overwrite = false) {
        $path = self::Path($key);
        $exists = file_exists($path);

        if ($exists == false || $overwrite == true || $overwrite == true && $exists == true) {
            file_put_contents($path, gzencode(json_encode($data)));
        }
    }

    public static function LoadItem($key) {
        $file = self::Path($key);

        if (!file_exists($file)) {
            return null;
        }

        touch($file);
        return json_decode(gzdecode(file_get_contents($file)));
    }

    public static function DeleteItem($key) {
        $file = self::Path($key);

        if (file_exists($file)) {
            unlink($file);
        }
    }

    public static function Clean() {
        $files = scandir(CACHE_PATH);
        $actions = array();

        foreach ($files as $file) {
            $path = CACHE_PATH . $file;

            if (is_dir($path)) {
                continue;
            }

            $now = time();

            // Delete the file after 7 days of no activity.
            $dirtyTime = 60*60*24*7;
            if (file_exists($path) && filemtime($path) + $dirtyTime < $now) {
                unlink($path);
            }
        }
    }

    private static function Path($key) {
        return CACHE_PATH . md5($key);
    }
}
