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

class setAccess extends \core\AbstractAction {

    public $description = 'Change the access of a pattern.';

    public function execute() {
        $urlId = $this->getValue("patternId");
        $patternId = convertFromURL($urlId);
        $visibility = $this->getValue("access");

        $userProfile = $this->getUserProfile();

        $exists = $this->db->exists("patterns", ['id' => $patternId, 'owner' => $userProfile->userId]);
        if ($exists == true) {
            $result = $this->db->query("UPDATE patterns SET visibility='$visibility' WHERE id='$patternId'");
        } else {
            throw new \core\APIError(\core\ErrorCodes::API_PATTERN_NOT_FOUND);
        }

        // Clear the cache for this pattern.
        $patternCacheKey = \core\Cache::PatternKey($patternId);
        \core\Cache::DeleteItem($patternCacheKey);

        return new \core\Result(['id'=>$urlId, 'access'=>$visibility]);
    }

    public function getSchema() {
        return array(
            "patternId" => array("type"=>self::STRING, "required"=>true),
            "access" => array("type"=>self::ENUM, "values"=>['private', 'protected'], "required"=>true)
        );
    }
}
