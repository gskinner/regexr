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

require_once('bootstrap.php');

class apiDocs {

    public $description = 'Returns all the available APIs.';

    function __construct() {
        $actions = $this->loadActionList("actions/");

        header('Content-Type: application/json');
        echo(json_encode($actions, JSON_PRETTY_PRINT));
    }

    function loadActionList($base) {
        $actions = [];

        $db = new \core\DB();
				$db->connect(DB_HOST, DB_USER_NAME, DB_PASSWORD, DB_NAME);

        $Directory = new RecursiveDirectoryIterator($base);
        $Iterator = new RecursiveIteratorIterator($Directory);
        $Regex = new RegexIterator($Iterator, '/^.+\.php$/i', RecursiveRegexIterator::GET_MATCH);

        foreach ($Regex as $result) {
            $file = __DIR__ . "/actions/" . substr($result[0], strlen('actions/'));

            require_once($file);

            $file = str_replace(__DIR__.'/actions/', "", $file);

            $info = (object)pathinfo($file);
            $name = $info->filename;
            $dir = preg_replace('/[0-9\.]/i', '', $info->dirname);
            $className = "$dir\\$name";
            $class = new ReflectionClass($className);
            $constants = $class->getConstants();
            if (!$class->isInstantiable()) {
                continue;
            }

            $isAbstractAction = false;
            while ($parent = $class->getParentClass()) {
                if ($parent && $parent->getName() == 'core\AbstractAction') {
                    $isAbstractAction = true;
                    break;
                }
                $class = $parent;
            }

            if ($isAbstractAction) {
                $c = new $className();
                $c->setDB($db);

                $schema = $c->getSchema();
                $formattedSchema = [];

                foreach ($schema as $name => $value) {
                    $value['type'] = $this->getConstantName($constants, $value['type']);
                    $formattedSchema[$name] = $value;
                }

                $actions[] = [
                    'name' => ltrim(str_replace("\\", "/", $className), '/'),
                    'description' => $c->description,
                    'parameters' => $formattedSchema
                ];
            }
        }

        usort($actions, function ($a, $b) {
            return strcmp($a['name'], $b['name']);
        });

        return $actions;
    }

    function getConstantName($constants, $type) {
        foreach ($constants as $name => $value) {
            if ($value == $type) {
                return $name;
            }
        }
    }
}

new apiDocs();
