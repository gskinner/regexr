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

/**
 * Setup the bare minimum required to run the app.
 */

$cwd = realpath(dirname(__FILE__));

if (!file_exists("$cwd/Config.php")) {
    echo('You need to create a Config.php file. Copy Config.sample.php, and edit.');
    die;
}

require_once("$cwd/Config.php");
require_once("$cwd/utils.php");

// For composer
if (isCLI()) {
    $cwd = dirname(realpath($argv[0]));
}

ini_set('session.gc_maxlifetime', 3600*24);
session_set_cookie_params(3600*24*60);

define('__DIR__', $cwd . '/vendor');
require "$cwd/vendor/autoload.php";

register_shutdown_function("shutdown_handler");

function shutdown_handler() {
    $error = error_get_last();

    if (!is_null($error)) {
        $result = ob_get_contents();

        if (!is_null($result)) {
            // See if the result is JSON, if not just display the text (probably was a nested echo, print_r or var_dump)
            $json = json_decode($result);
            if (is_null(json_last_error())) {
                $json['unhandled_error'] = $error;
            } else {
                ob_flush();
                die;
            }
        }

        ob_clean();
        echo(json_encode($json));
    }

    if(ob_get_level() > 0) {
        ob_flush();
    }
}

spl_autoload_extensions('.php');
spl_autoload_register(function ($class) {
        $className = str_replace('\\', '/', $class) . '.php';
        $fileName = __DIR__ . '/' . $className;
        $actionsFilename = __DIR__ . '/actions/' . $className;

        if (file_exists($actionsFilename)) {
            include $actionsFilename;
        } else if (file_exists($fileName)) {
            include $fileName;
        }
});
