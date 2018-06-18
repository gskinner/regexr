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

use \core\Cache;

namespace patterns;

class load extends \core\AbstractAction {

    public $description = 'Return a pattern by its id. You can pass either the URL id or numeric id.';

    public function execute() {
        $urlId = $this->getValue("patternId");
        $patternId = convertFromURL($urlId);

        $userProfile = $this->getUserProfile();

        $patternCacheKey = \core\Cache::PatternKey($patternId);
        $item = null;//\core\Cache::LoadItem($patternCacheKey);
        if (!is_null($item)) {
            $this->trackVisit($patternId);
            return new \core\Result($item);
            exit;
        }

        $sql = "SELECT p.*, ur.rating as userRating, fJoin.patternId as favorite
            FROM patterns p
            LEFT JOIN userRatings as ur ON ur.userId='{$userProfile->userId}' AND ur.patternId=p.id
            LEFT JOIN favorites as fJoin ON fJoin.userId='{$userProfile->userId}' AND fJoin.patternId=p.id
            WHERE p.id='{$patternId}' GROUP BY p.id
        ";
        $result = $this->db->query($sql, true);

        if (!is_null($result)) {
            // Check that the current user has access.
            if ($result->visibility == \core\PatternVisibility::PRIVATE) {
                $userProfile = $this->getUserProfile();
                if ($userProfile->userId != $result->owner) {
                    throw new \core\APIError(\core\ErrorCodes::API_NOT_ALLOWED);
                }
            }

            $json = createPatternNode($result);
            $this->trackVisit($patternId);

            if (intval($result->visits) > 10) {
                // \core\Cache::SaveItem($patternCacheKey, $json, true);
            }
        } else {
            throw new \core\APIError(\core\ErrorCodes::API_PATTERN_NOT_FOUND);
        }

        return new \core\Result($json);
    }

    function trackVisit($id) {
        $this->db->query("UPDATE patterns SET visits=visits+1 WHERE id='{$id}'");
    }

    public function getSchema() {
        return array(
            "patternId" => array("type"=>self::STRING, "required"=>true)
        );
    }
}
