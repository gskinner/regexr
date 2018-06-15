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

namespace account;

class logout extends \core\AbstractAction {

    public $description = "Deletes the current users session.";

    public function execute() {
        $session = new \core\Session($this->db, SESSION_NAME);

        session_destroy();

        if (isset($_COOKIE[SESSION_NAME])) {
            unset($_COOKIE[SESSION_NAME]);
            setcookie(SESSION_NAME, '', time() - 3600, '/');
        }

        session_write_close();

        session_start();
        // Return the new temporary user.
        $userProfile = (object)(new \account\verify())->run($this->db);

        return new \core\Result($userProfile);
    }

    public function getSchema() {
        return array();
    }
}
