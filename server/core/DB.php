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

    public function execute($sql, $params = null, $single = false) {
        $stmt = $this->mysqli->prepare($sql);
        $returnValue = null;

        if ($stmt !== false) {
            if (!is_null($params)) {
                $types = "";
                $values = [];

                if (\count($params) == 2 && is_string($params[0])) {
                    $params = [$params];
                }

                foreach ($params as $i => $value) {
                    $types .= $value[0];
                    $values[] = &$value[1];
                }

                $stmt->bind_param($types, ...$values);
            }

            if (!$stmt->execute()) {
                throw new \core\APIError(\core\ErrorCodes::MYSQL_QUERY_ERR, $stmt->error, DEBUG == true?$sql:"");
            }

            $result = $stmt->get_result();

            if ($result !== false) {
                $returnValue = [];
                while ($row = $result->fetch_object()) {
                    $returnValue[] = $row;
                }

                if ($single == true) {
                    $returnValue = count($returnValue)>0?$returnValue[0]:null;
                }
            }

            $stmt->close();
        } else {
            throw new \core\APIError(\core\ErrorCodes::MYSQL_QUERY_ERR, $this->mysqli->error, DEBUG == true?$sql:"");
        }

        return $returnValue;
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
        $params = [];
        $where = array();
        foreach ($values as $key => $value) {
            $where[] = "$key=?";
            $params[] = ["s", $value];
        }

        $where = implode(" && ", $where);

        $q = "SELECT * FROM $table WHERE {$where} LIMIT 1";
        $result = $this->execute($q, $params);

        return !is_null($result);
    }

    function getLastError() {
        return $this->mysqli->error;
    }

    function getEnumValues($table, $field) {
        $row = $this->execute("SHOW COLUMNS FROM {$table} WHERE Field = ?", ["s", $field] ,true);
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
}
