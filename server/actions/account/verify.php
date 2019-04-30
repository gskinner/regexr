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

class verify extends \core\AbstractAction {

    public $description = "Verifies the current users session is valid, and returns their username and userId.";

    public function execute() {
        $username = null;
        $authorName = null;
        $userId = null;
        $type = null;
        $isAuthenticated = false;

        $session = new \core\Session($this->db, SESSION_NAME);

        $sessionId = session_id();
        $sessionData = idx($_SESSION, 'data');

        if (DEBUG === true && idx($_REQUEST, 'userId') !== null) {
            $tempUserId = intval(idx($_REQUEST, 'userId'));
            $sessionData = [
                'userId' => $tempUserId,
                'type' => 'temporary'
            ];
            $isAuthenticated = true;
        }

        if (!is_null($sessionData)) {
            $sessionData = (object)$sessionData;
        }

        if (!is_null($sessionData) && $sessionData->type != 'temporary') {
            $auth = new \core\Authentication();
            $adapter = $auth->connect($sessionData->type);

            if (!is_null($adapter)) {
                try {
                    $userProfile = $adapter->getUserProfile();
                    $username = idx($userProfile, 'displayName');
                    $authorName = idx($userProfile, 'authorName');
                    $userId = $sessionData->userId;
                    $isAuthenticated = true;
                } catch (\Exception $ex) {
                    $user = $this->db->execute("SELECT * FROM users WHERE id=?", ["s", $sessionData->userId], true);

                    if (is_null($user)) {
                        $isAuthenticated = false;
                    } else {
                        $username = $user->username;
                        $authorName = $user->authorName;
                        $isAuthenticated = true;
                    }
                }
            }
        } else if (is_null($sessionData)) {
            // Create a new user, with a temporary flag.
            $tempUserEmail = uniqid();
            $tempOauthId = uniqid();

            $sql = "INSERT INTO users
                (email, username, authorName, type, oauthUserId, lastLogin)
                VALUES (?, '', '', 'temporary', ?, NOW())";

            $this->db->execute($sql, [
                ["s", $tempUserEmail],
                ["s", $tempOauthId]
            ]);

            $userId = $this->db->getLastId();
            $sessionData = (object)[
                'userId' => $userId,
                'userEmail' => $tempUserEmail,
                'type' => 'temporary'
            ];

            $isAuthenticated = false;

            $_SESSION['data'] = $sessionData;
        }

        $userDetails = $this->db->execute("SELECT * FROM users WHERE id=?",["s", $sessionData->userId], true);

        $result = array(
            'authenticated' => $isAuthenticated,
            'username'=> $username,
            'author' => $authorName,
            'userId' => intval($sessionData->userId),
            'type' => $sessionData->type
        );

        if (idx($userDetails, 'admin') == 1) {
            $result['admin'] = true;
        }

        @session_write_close();

        if (!empty($userId)) {
            $this->db->execute("UPDATE sessions SET userId=? WHERE id=?", [
                ["s", $userId],
                ["s", $sessionId],
            ]);
        }

        return new \core\Result($result);
    }

    public function getSchema() {
        return array();
    }
}
