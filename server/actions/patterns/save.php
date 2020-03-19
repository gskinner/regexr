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

namespace patterns;

class save extends \core\AbstractAction {
    public $description = 'If no id is passed a new pattern is saved.  If id is passed, and the user has access, the existing pattern is updated.';

    public function execute() {
        $userProfile = $this->getUserProfile();

        return $this->savePattern($userProfile);
    }

    function savePattern($userProfile) {
        $keywords = $this->getValue('keywords');
        $name = $this->getValue('name');
        $pattern = addslashes($this->getValue('expression'));
        $content = $this->getValue('text');
        $description = $this->getValue('description');
        $id = $this->getValue('id');
        $tool = $this->getValue('tool');
        $flavor = $this->getValue('flavor');
        $savedAuthor = $this->getValue('author');
        $parentId = convertFromURL($this->getValue('parentId'));
        $access = $this->getValue('access');
        $access = empty($access)?null:$access;
        $mode = $this->getValue('mode');
        $tests = $this->getValue('tests');

        $patternId = convertFromURL($id);

        $author = empty($savedAuthor)?$userProfile->username:$savedAuthor;

        // Check to see if the user wants to edit this pattern.
        if (!empty($id)) {
            // Make sure the user has access to edit this pattern.
            $protectedState = \core\PatternVisibility::PROTECTED;
            $privateState = \core\PatternVisibility::PRIVATE;

            $sql = "SELECT * FROM patterns WHERE id=? && owner=? && visibility IN (?, ?) LIMIT 1";
            $existingPattern = $this->db->execute($sql, [
                ["s", $patternId],
                ["s", $userProfile->userId],
                ["s", $protectedState],
                ["s", $privateState]
            ], true);

            if (is_null($existingPattern)) {
                throw new \core\APIError(\core\ErrorCodes::API_NOT_ALLOWED);
            } else {
                $accessUpdate = '';
                if (!is_null($access)) {
                    $accessUpdate = ",visibility=?";
                }

                $sql = "UPDATE patterns SET
                            `name`=?,
                            `content`=?,
                            `pattern`=?,
                            `author`=?,
                            `keywords`=?,
                            `description`=?,
                            `state`=?,
                            `flavor`=?,
                            `mode`=?,
                            `tests`=?
                            $accessUpdate
                        WHERE id=?";

                $sqlParams = [
                    ["s", $name],
                    ["s", $content],
                    ["s", $pattern],
                    ["s", $author],
                    ["s", $keywords],
                    ["s", $description],
                    ["s", $tool],
                    ["s", $flavor],
                    ["s", $mode],
                    ["s", $tests],
                ];

                if (!is_null($access)) {
                    array_push($sqlParams, ["s", $access]);
                }

                array_push($sqlParams, ["i", $patternId]);

                $this->db->execute($sql, $sqlParams);
            }
        } else if (is_null($parentId)) {
            $patternId = savePattern($this->db, $name, $content, $pattern, $author, $description, $keywords, $tool, $flavor, $userProfile->userId, $access, $mode, $tests);
        } else {
            $existingPattern = $this->db->execute("SELECT visibility, owner FROM patterns WHERE id=? LIMIT 1", [
                ["s", $patternId]
            ], true);

            if (!is_null($existingPattern)) {
               if ($existingPattern->visibility == \core\PatternVisibility::PRIVATE && $existingPattern->owner != $userProfile->userId) {
                   throw new \core\APIError(\core\ErrorCodes::API_NOT_ALLOWED);
               }
            }

            $patternId = savePattern($this->db, $name, $content, $pattern, $author, $description, $keywords, $tool, $flavor, $userProfile->userId, $access, $mode, $tests);

            $sql = "INSERT INTO patternLink (patternId, parentId, userId) VALUES (?, ?, ?)";
            $this->db->execute($sql, [
                    ["s", $patternId],
                    ["s", $parentId],
                    ["s", $userProfile->userId]
                ]
            );
        }

        // Send back the new pattern.
        $result = $this->db->execute("SELECT * FROM patterns WHERE id=? LIMIT 1", [
            ["s", $patternId]
        ], true);

        // Default the name, if we don't have one.
        if (empty($result->name)) {
            $name = "Untitled " . convertToURL($result->id);

            $sql = "UPDATE patterns SET name=? WHERE id=?";
            $this->db->execute($sql, [
                ["s", $name],
                ["s", $result->id]
            ]);
            $result->name = $name;
        }

        // If we have a new username, save it back to the profile
        if ($userProfile->username != $author) {
            $this->db->execute("UPDATE users SET username=? WHERE id=?", [
                ["s", $author],
                ["s", $userProfile->userId]
            ]);
        }

        $json = (object)createPatternNode($result);
        // If this item was previously cached, delete it (patterns/load) will re-cache if needed.
        \core\Cache::DeleteItem(\core\Cache::PatternKey($patternId));

        return new \core\Result($json);
    }

    function getTypeValues() {
        return $this->db->getEnumValues('patterns', 'flavor');
		}

    function getVisibilityValues() {
        return $this->db->getEnumValues('patterns', 'visibility');
    }

    public function getSchema() {
        return array(
            "id" => array("type"=>self::STRING, "required"=>false),
            "mode" => array("type"=>self::ENUM, "values"=>["text", "tests"], "required"=>false, "default" => "text"),
            "keywords" => array("type"=>self::STRING, "required"=>false, "length"=>2056),
            "name" => array("type"=>self::STRING, "required"=>false, "length"=>30),
            "expression" => array("type"=>self::STRING, "required"=>false, "length"=>2048),
            "text" => array("type"=>self::STRING, "required"=>false),
            "description" => array("type"=>self::STRING, "required"=>false, "length"=>250),
            "tool" => array("type"=>self::STRING, "required"=>false, "length"=>1024),
            "tests" => array("type"=>self::STRING, "required"=>false),
            "flavor" => array("type"=>self::ENUM, "values"=>$this->getTypeValues(), "required"=>false),
            "parentId" => array("type"=>self::STRING, "required"=>false),
            "access" => array("type"=>self::ENUM, "values"=>$this->getVisibilityValues(), "required"=>false)
        );
    }
}
