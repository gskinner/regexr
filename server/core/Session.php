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

class Session {

    protected $db;

    public function __construct($db, $name) {
        $this->db = $db;

        session_set_save_handler(
            array($this, "open"),
            array($this, "close"),
            array($this, "read"),
            array($this, "write"),
            array($this, "destroy"),
            array($this, "gc")
        );

        session_name($name);

        if(!isset($_SESSION)) {
            session_start();
        }
    }

    public function open() {
        return $this->db->isConnected();
    }

    public function close() {
        return true;
    }

    public function read($id) {
        try {
            $result = $this->db->execute("SELECT data FROM sessions WHERE id = ?", ["s", $id], true);
        } catch (\Exception $ex) {
            return '';
        }
        return !is_null($result)?$result->data:'';
    }

    public function write($id, $data) {
        $lastAccess = time();

        try {
            $sql = "INSERT INTO sessions (id, access, data)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE `access`=?, `data`=?
            ";

            $result = $this->db->execute($sql, [
                ["s", $id],
                ["s", $lastAccess],
                ["s", $data],
                ["s", $lastAccess],
                ["s", $data],
            ]);
        } catch(\Exception $ex) {
            return false;
        }
        return !is_null($result);
    }

    public function destroy($id) {
        try {
            $result = $this->db->execute("DELETE FROM sessions WHERE id = ?", ["s", $id]);
        } catch (\Exception $ex) {
            return false;
        }
        return !is_null($result);
    }

    public function gc($max) {
        $old = time() - $max;

        try {
            $result = $this->db->execute("DELETE FROM sessions WHERE access < ?", ["s", $old]);
        } catch (\Exception $ex) {
            return false;
        }
        return !is_null($result);
    }
}
