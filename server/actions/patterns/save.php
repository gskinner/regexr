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
        $result = null;

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
        $token = $this->getValue('token');
        $tool = $this->getValue('tool');
        $flavor = $this->getValue('flavor');
        $savedAuthor = $this->getValue('author');
        $parentId = convertFromURL($this->getValue('parentId'));
        $access = $this->getValue('access');
        $access = empty($access)?null:$access;

        $patternId = convertFromURL($id);

        $author = empty($savedAuthor)?$userProfile->username:$savedAuthor;

        // Check to see if the user wants to edit this pattern.
        if (!empty($id)) { // Update
            // Make sure the user has access to edit this pattern.
            $protectedState = \core\PatternVisibility::PROTECTED;
            $privateState = \core\PatternVisibility::PRIVATE;

            $existingPattern = $this->db->query("SELECT * FROM patterns WHERE id='$patternId' && owner={$userProfile->userId} && visibility IN ('$protectedState', '$privateState')", true);
            if (is_null($existingPattern)) {
                throw new \core\APIError(\core\ErrorCodes::API_NOT_ALLOWED);
            } else {
                $accessUpdate = '';
                if (!is_null($access)) {
                    $accessUpdate = ",visibility='{$access}'";
                }
                $sql = "UPDATE patterns SET
                            name='{$name}',
                            content='{$content}',
                            `pattern`='{$pattern}',
                            author='{$author}',
                            keywords='{$keywords}',
                            description='{$description}',
                            state='{$tool}',
                            flavor='{$flavor}'
                            $accessUpdate
                        WHERE id='{$patternId}'";
                $this->db->query($sql);
            }
        } else if (is_null($parentId)) { // Not a fork
            $patternId = savePattern($this->db, $name, $content, $pattern, $author, $description, $keywords, $tool, $flavor, $userProfile->userId, $access);
        } else { // Fork
            $existingPattern = $this->db->query("SELECT visibility, owner FROM patterns WHERE id='{$patternId}'", true);
            if (!is_null($existingPattern)) {
               if ($existingPattern->visibility == \core\PatternVisibility::PRIVATE && $existingPattern->owner != $userProfile->userId) {
                   throw new \core\APIError(\core\ErrorCodes::API_NOT_ALLOWED);
               }
            }

            $patternId = savePattern($this->db, $name, $content, $pattern, $author, $description, $keywords, $tool, $flavor, $userProfile->userId, $access);
            $this->db->query("INSERT INTO patternLink (patternId, parentId, userId) VALUES ('{$patternId}', '{$parentId}', '{$userProfile->userId}')");
        }

        // Send back the new pattern.
        $sql = "SELECT * FROM patterns WHERE id='{$patternId}' LIMIT 1";
        $result = $this->db->query($sql, true);

        // Default the name, if we don't have one.
        if (empty($result->name)) {
            $name = "Untitled " . convertToURL($result->id);
            $this->db->query("UPDATE patterns SET name='{$name}' WHERE id='{$result->id}'");
            $result->name = $name;
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
            "keywords" => array("type"=>self::STRING, "required"=>false, "length"=>2056),
            "name" => array("type"=>self::STRING, "required"=>false, "length"=>30),
            "expression" => array("type"=>self::STRING, "required"=>false, "length"=>2048),
            "text" => array("type"=>self::STRING, "required"=>false),
            "description" => array("type"=>self::STRING, "required"=>false, "length"=>250),
            "token" => array("type"=>self::STRING, "required"=>false),
            "tool" => array("type"=>self::STRING, "required"=>false, "length"=>1024),
            "flavor" => array("type"=>self::ENUM, "values"=>$this->getTypeValues(), "required"=>false),
            "parentId" => array("type"=>self::STRING, "required"=>false),
            "access" => array("type"=>self::ENUM, "values"=>$this->getVisibilityValues(), "required"=>false)
        );
    }
}
