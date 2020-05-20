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

class login extends \core\AbstractAction {

    public $description = 'Attempts to log the user into one of the supported providers. First run it will redirect the user to the requested authentication provider. Upon a successful login the user is redirected back to the main site.';

    public function execute() {
        $type = $this->getValue('type');
        $this->tryLogin($type);
    }

    function tryLogin($type) {
        $session = new \core\Session($this->db, SESSION_NAME);
        $exception = null;
        $adapter = null;

        $auth = new \core\Authentication();
        try {
            $adapter = $auth->connect($type);
        } catch (\Exception $ex) {
            $exception = $ex;
        }

        if (!is_null($adapter) && $adapter->isConnected()) {
            $userProfile = null;

            try {
                $userProfile = $adapter->getUserProfile();
            } catch (\Exception $ex) {
                $exception = $ex;
            }

            if (!is_null($userProfile)) {
                session_start();

                $id = $userProfile->identifier;
                $displayName = $userProfile->displayName;
                $email = $userProfile->email;

                $sessionId = session_id();
                $sessionData = idx($_SESSION, 'data');
                $userId = null;

                // Check if the user had a temporary session first.
                if (!is_null($sessionData)) {
                    $sessionData = (object)$sessionData;
                    if ($sessionData->type == "temporary") {
                        // Migrate all the temp users favorites / ratings / patterns to the correct user
                        // Then delete the old user / session.
                        $existingUser = $this->db->execute("SELECT * FROM users WHERE email=? && type=?", [
                            ["s", $email],
                            ["s", $type]
                        ], true);

                        if (!is_null($existingUser)) {
                            $temporaryUserId = $sessionData->userId;
                            $existingUserId = $existingUser->id;
                            $userId = $existingUserId;

                            $this->db->begin();
                            //Migrate temp users patterns to the exiting user.
                            $this->db->execute("UPDATE patterns SET owner=? WHERE owner=?", [
                                ["s", $existingUserId],
                                ["s", $temporaryUserId]
                            ]);

                            // Delete any favorites patterns that the existing user has already favorited.
                            $this->db->execute("DELETE IGNORE
                                                FROM favorites
                                                WHERE userId=?
                                                && patternId IN (SELECT patternId FROM (SELECT patternId FROM favorites WHERE userId=?) as child)
                                            ", [
                                                ["s", $temporaryUserId],
                                                ["s", $existingUserId]
                                            ]);

                            // Assign remaining favorites to the existing user.
                            $this->db->execute("UPDATE favorites
                                                SET userId=?
                                                WHERE userId=?
                                            ", [
                                                ["s", $existingUserId],
                                                ["s", $temporaryUserId]
                                            ]);

                            // Delete any ratings that the exiting user already made.
                            $this->db->execute("DELETE IGNORE
                                                FROM userRatings
                                                WHERE userId=?
                                                && patternId IN (SELECT patternId FROM (SELECT patternId FROM userRatings WHERE userId=?) as child)
                                            ", [
                                                ["s", $temporaryUserId],
                                                ["s", $existingUserId]
                                            ]);

                            // Assign remaining ratings to the existing user.
                            $this->db->execute("UPDATE userRatings SET userId=? WHERE userId=?", [
                                ["s", $existingUserId],
                                ["s", $temporaryUserId]
                            ]);

                            // Remove temporary user.
                            $this->db->execute("DELETE IGNORE FROM users WHERE id=?", ["s", $temporaryUserId]);

                            // Remove any sessions for the exiting user (we'll migrate the new one over below)
                            $this->db->execute("DELETE IGNORE FROM sessions WHERE userId=?", ["s", $existingUserId]);

                            $this->db->commit();
                        } else {
                            // Update current temp user to a full fledged user.
                            $userId = $sessionData->userId;
                            $this->db->execute("UPDATE users SET email=?, type=? WHERE id=?", [
                                ["s", $email],
                                ["s", $type],
                                ["s", $sessionData->userId]
                            ]);
                        }

                        // Sessions will update below.
                        $sessionData->type = $type;
                        $sessionData->userEmail = $email;
                        $sessionData->userId = $userId;
                        $_SESSION['data'] = $sessionData;
                        @session_write_close();
                        session_start();
                    }
                }

                $this->db->execute("INSERT INTO users (email, username, authorName, type, oauthUserId, lastLogin)
                                    VALUES (?, ?, ?, ?, ? ,'NOW()')
                                    ON DUPLICATE KEY UPDATE `username`=?, `oauthUserId`=?, `lastLogin`=NOW()
                                ", [
                                    ["s", $email],
                                    ["s", $displayName],
                                    ["s", $displayName],
                                    ["s", $type],
                                    ["s", $id],
                                    ["s", $displayName],
                                    ["s", $id]
                                ]);

                $accessToken = serialize($adapter->getAccessToken());
                $userIdData = $this->db->execute("SELECT * FROM users WHERE email=? && type=?", [
                    ["s", $email],
                    ["s", $type]
                ],true);

                $this->db->execute("UPDATE sessions SET accessToken=?, type=?, userId=? WHERE id=?", [
                    ["s", $accessToken],
                    ["s", $type],
                    ["s", $userIdData->id],
                    ["s", $sessionId]
                ]);
            }

            @session_write_close();
            // Redirect back to the main site.
            header('Location: '. $auth->getBaseDomain());
            die;
        } else {
            throw new \core\APIError(\core\ErrorCodes::API_LOGIN_ERROR, $exception);
        }
    }

    function getUserAccountTypes() {
        $types = $this->db->getEnumValues('users', 'type');
        unset($types[array_search('temporary', $types)]);
        return $types;
    }

    public function getSchema() {
        return array(
            'type' => array('type'=>self::ENUM, 'values'=>$this->getUserAccountTypes(), 'required'=>true)
        );
    }
}
