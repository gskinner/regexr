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

class search extends \core\AbstractAction {

    public $description = 'Search all the public patterns names and descriptions.';

    public function execute() {
        $query = $this->getValue("query");
        $startIndex = $this->getValue("startIndex");
        $limit = $this->getValue("limit");
        $type = $this->getValue("flavor");

        $this->userProfile = $this->getUserProfile();

        $result = null;
        $item = null;

        // The default community search is cached in Maintenance.php
        if (empty($query)) {
           // $item = \core\Cache::LoadItem(\core\Cache::CommunityKey($query, $startIndex, $limit));
        }

        // Disable cache, for testing
        $item = null;

        if (!is_null($item)) {
            $result = $item;
        } else {
            $result = $this->searchCommunity($query, $startIndex, $limit, $type);
        }

        return new \core\Result($result);
    }

    public function searchCommunity($query, $startIndex, $limit, $type) {
        // Build the search query.
        $whereStatements = array();

        // Search everything using the query.
        if (!empty($query)) {
            $whereStatements[] = " p.name LIKE '%{$query}%'";
            $whereStatements[] = " p.description LIKE '%{$query}%'";
            $whereStatements[] = " p.author LIKE  '%{$query}%'";
        }

        // Do the actual search.
        $q = "SELECT SQL_CALC_FOUND_ROWS p.*, urJoin.rating AS userRating, fJoin.patternId as favorite
        FROM patterns p
        LEFT JOIN userRatings urJoin ON urJoin.patternId = p.id AND urJoin.userId = '{$this->userProfile->userId}'
        LEFT JOIN favorites as fJoin ON fJoin.userId='{$this->userProfile->userId}' AND fJoin.patternId=p.id
        WHERE p.visibility='public'
        ";

        if (!is_null($type)) {
            $typeArray = quoteStringArray($type);
            $q .= " && p.flavor IN ($typeArray)";
        }

        if (count($whereStatements) > 0) {
            $q .= " && (" . implode("||", $whereStatements) . ")";
        }

        $q .= " GROUP BY p.id ORDER by p.ratingSort DESC LIMIT {$startIndex}, {$limit}";

        $result = $this->db->selectQuery($q);

        // Returns the total results.
        $countQuery = (object)$this->db->selectQuery("SELECT FOUND_ROWS() as count", true);
        $total = $countQuery->count;

        $json = createPatternSet($result, $total, $startIndex, $limit);

        return $json;
    }

    function getFlavorValues() {
        return $this->db->getEnumValues('patterns', 'flavor');
    }

    public function getSchema() {
        $flavorValues = $this->getFlavorValues();
        return array(
            "query" => array("type"=>self::STRING, "required"=>true),
            "startIndex" => array("type"=>self::NUMBER, "required"=>false, "default"=>0),
            "limit" => array("type"=>self::NUMBER, "required"=>false, "default"=>100),
            "flavor" => array("type"=>self::ENUM_ARRAY, "values"=>$flavorValues, "default"=>$flavorValues, "required"=>false)
        );
    }
}
