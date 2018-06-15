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

class favorite extends \core\AbstractAction {
    public $description = 'Favorite or unfavorite any pattern.';

    public function execute() {
        $urlId = $this->getValue("patternId");
        $patternId = convertFromURL($urlId);
        $favorite = $this->getValue("favorite");

        if (!$this->db->exists("patterns", ["id"=>$patternId])) {
            throw new \core\APIError(\core\ErrorCodes::API_PATTERN_NOT_FOUND);
        }

        $userProfile = $this->getUserProfile();

        if ($favorite) {
            $this->db->query("INSERT IGNORE INTO favorites (userId, patternId) VALUES ('{$userProfile->userId}', '{$patternId}')");
        } else {
            $this->db->query("DELETE IGNORE FROM favorites WHERE patternId='{$patternId}' && userId='{$userProfile->userId}'");
        }

        return new \core\Result(['id' => $urlId, "favorite" => $favorite]);
    }

    public function getSchema() {
        return array(
            "patternId" => array("type"=>self::STRING, "required"=>true),
            "favorite" => array("type"=>self::BOOL, "required"=>true)
        );
    }
}
