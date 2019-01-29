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

use interfaces\IAuthenticated;

class API {

    protected $db;
    protected $resultShouldReturn;

    public function execute($values, $returnResult = false) {
        date_default_timezone_set('UTC');

        ob_start('ob_gzhandler');
        $this->resultShouldReturn = $returnResult;
        $result = null;

        $action = idx($values, 'action');
        if (empty($action)) {
            $this->result(new \core\APIError(\core\ErrorCodes::NO_ACTION));
        } else {
            safeRequireOnce("actions/$action.php", false);

            $action = formatActionNameForExecution($action);

            if (!is_null($action)) {
                // Any call here could throw.
                try {
                    $action = new $action($values);
                    if ($action->requiresDatabase()) {
                        $this->connect();
                        $action->setDB($this->db);
                    }
                    $result = $action->validate()->execute();
                } catch (\core\APIError $err) { // Custom error
                    $result = $err;
                } catch (\Exception $err) { // A unknown PHP error happened
                    $message = array('error' => $err);

                    if (DEBUG) {
                        $message['stack'] = debug_backtrace(true);
                    }

                    if ($this->db->inTransaction()) {
                        $this->db->rollback();
                    }

                    $result = new \core\APIError(\core\ErrorCodes::UNKNOWN, $message);
                }

                // Assume success if the action returns no result. (Ex; a DB write);
                if (is_null($result)) {
                    $result = new \core\Result();
                }

                $totalTime = number_format((\microtime(true) - $_SERVER["REQUEST_TIME_FLOAT"])*1000, 2, '.', '');

                return $this->result($result, $totalTime.'ms');
            } else {
                return $this->result(new \core\APIError(\core\ErrorCodes::NO_ACTION, "Action $action does not exist."));
            }
        }
    }

    function getDB() {
        return $this->db;
    }

    function connect() {
        $this->db = new \core\DB();
        $this->db->connect(DB_HOST, DB_USER_NAME, DB_PASSWORD, DB_NAME, DB_PORT, DB_SOCK);
    }

    function result($data, $time=null) {
        $success = $data instanceof \core\Result;
        $resultData = array('success' => $success);
        $returnData = $data->getData();
        $metadata = $data->getMetadata();

        if ($success == false) {
            // http_response_code(500);
        }

        if (!is_null($returnData)) {
            $resultData['data'] = $returnData;
        }

        if (!is_null($time)) {
            if (is_null($metadata)) {
                $metadata = array();
            }
            $metadata['script-time'] = $time;
        }

        if (!is_null($metadata)) {
            $resultData['metadata'] = $metadata;
        }

        echo(json_encode($resultData));

        if ($this->resultShouldReturn) {
            return ob_get_contents();
        }
    }
}
