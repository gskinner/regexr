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

class DB {

    private $_isConnected;

    function connect($host, $username, $password, $dbName, $dbPort = null, $dbSock = null) {
        mysqli_report(MYSQLI_REPORT_STRICT);

        $this->_inTransaction = false;
        $this->_isConnected = false;

        try {
            $this->mysqli = new \mysqli($host, $username, $password, $dbName, $dbPort, $dbSock);
        } catch (\Exception $e) {
            throw new \core\APIError(\core\ErrorCodes::MYSQL_CONNECTION_ERR, "MySQL connection error {$e}");
        }

        $this->mysqli->set_charset('utf8');

        if ($this->mysqli->connect_errno) {
            throw new \core\APIError(\core\ErrorCodes::MYSQL_CONNECTION_ERR, $this->mysqli->connect_error);
        } else {
            $this->_isConnected = true;
        }
    }

    public function isConnected() {
        return $this->_isConnected;
    }

    function inTransaction() {
        return $this->_inTransaction;
    }

    function rollback() {
        $this->mysqli->rollback();
    }

    function begin() {
        $this->mysqli->autocommit(false);
        $this->_inTransaction = true;
    }

    function commit() {
        $this->mysqli->autocommit(true);
        $this->_inTransaction = false;
    }

    function insert($table, $values, $updateOnDuplicateValues = null) {
        $k = implode(',', array_keys($values));
        $v = quoteStringArray(array_values($values));
        $updateOnConflictValues = null;

        if (!is_null($updateOnDuplicateValues)) {
            $updateValueList = [];
            foreach ($updateOnDuplicateValues as $key => $value) {
                $updateValueList[] = "$key='$value'";
            }
            $updateOnConflictValues = implode(",", $updateValueList);
        }

        $q = "INSERT INTO $table ($k) VALUES ($v)";
        if (!is_null($updateOnConflictValues)) {
            $q .= " ON DUPLICATE KEY UPDATE $updateOnConflictValues";
        }

        return $this->query($q);
    }

    function selectQuery($sql, $single = false) {
        return $this->query($sql, $single);
    }

    /**
     * @param $table Table to check for values.
     * @param $values Array of values to check, used in an WHERE AND query.
     * @param result Optional, the value(s) returned from the exists check.
     * @return bool True if the item exists.
     * @throws Error
     *
     * Checks to see if a value exists, based on one or multiple values.
     */
    function exists($table, $values, &$result = null) {
        $where = array();
        foreach ($values as $key => $value) {
            $where[] = "$key='$value'";
        }

        $where = implode(' && ', $where);

        $q = "SELECT * FROM $table WHERE {$where} LIMIT 1";
        $result = $this->query($q, true);

        return !is_null($result);
    }

    function getLastError() {
        return $this->mysqli->error;
    }

    function query($sql, $single = false) {
        $result = $this->mysqli->query($sql);

        if (is_null($result) || $result == false) {
            $error = array( );

            // Only insert our query when debugging.
            if (DEBUG) {
                $error['query'] = $sql;
                $error['stack'] = print_r(debug_backtrace(), true);
                $error['error'] = print_r($this->mysqli->error, true);
            }

            throw new \core\APIError(\core\ErrorCodes::MYSQL_QUERY_ERR, $error);
        } else if (!is_bool($result)) {
            $results = array();
            while ($row = $result->fetch_object()) {
                $results[] = $row;
            }

            if (!is_null($results) && count($results) > 0) {
                if ($single) {
                    return $results[0];
                } else {
                    return $results;
                }
            } else {
                return null;
            }
        } else {
            return $result;
        }
    }

    function getEnumValues($table, $field) {
        $row = $this->query("SHOW COLUMNS FROM {$table} WHERE Field = '{$field}'", true);
        if (!is_null($row)) {
            $type = $row->Type;
            preg_match("/^enum\(\'(.*)\'\)$/", $type, $matches);
            $enum = explode("','", $matches[1]);
            return $enum;
        }

        return [];
    }

    function getLastId() {
        return $this->mysqli->insert_id;
    }

    public function sanitize($value) {
        if (is_null($value)) {
            return '';
        }

        if (is_string($value)) {
            return $this->mysqli->real_escape_string($value);
        } else {
            return $value;
        }
    }
}
