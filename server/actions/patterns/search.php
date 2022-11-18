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

class search extends \core\AbstractAction {

    public $description = 'Search all the public patterns names and descriptions.';

    public function execute() {
        $query = $this->getValue("query");
        $startIndex = $this->getValue("startIndex");
        $limit = $this->getValue("limit");
        $type = $this->getValue("flavor");

        $this->userProfile = $this->getUserProfile();

        $result = null;

        $result = $this->searchCommunity($query, $startIndex, $limit, $type);

        return new \core\Result($result);
    }

    public function searchCommunity($query, $startIndex, $limit, $type) {
        // Build the search query.
        $whereStatements = [];
        $searchSqlParams = [];

        // Search everything using the query.
        if (!empty($query)) {
            $whereStatements[] = "MATCH(`name`, `description`, `author`) AGAINST(? IN NATURAL LANGUAGE MODE)";
            $searchSqlParams[] = ["s", $query];
        }

        // Do the actual search.
        $q = "SELECT p.* FROM patterns p WHERE p.visibility='public'";

        if (!is_null($type)) {
            $typeArray = quoteStringArray($type);
            $q .= " && p.flavor IN ($typeArray)";
        }

        if (count($whereStatements) > 0) {
            $q .= " && (" . implode("||", $whereStatements) . ")";
        }

        $q .= " GROUP BY p.id ORDER by p.ratingSort DESC LIMIT ?, ?";
        $searchSqlParams[] = ["s", $startIndex];
        $searchSqlParams[] = ["s", $limit];

        $result = $this->db->execute($q, $searchSqlParams);

        // Inject userRating and favorite
        $patternIds = quoteStringArray(array_map(function ($pattern) {
            return idx($pattern, 'id');
        }, $result));

        $userId = $this->userProfile->userId;

        $userRatings = $this->db->execute("SELECT rating, patternId FROM userRatings WHERE patternId IN ($patternIds) AND userId=?", [
            ['s', $userId]
        ]);

        $userFavorites = $this->db->execute("SELECT patternId FROM favorites WHERE patternId IN ($patternIds) AND userId=?", [
            ['s', $userId]
        ]);

        function injectIntoResults($result, $sourceList, $sourceKey, $destKey)
        {
            for ($i = 0; $i < count($sourceList); $i++) {
                $sourceValue = $sourceList[$i];
                for ($j = 0; $j < count($result); $j++) {
                    if (idx($result[$j], 'id') === $sourceValue->patternId) {
                        $result[$i]->{$destKey} = idx($result[$j], $sourceKey, true);
                        break;
                    }
                }
            }
        }

        injectIntoResults($result, $userRatings, 'rating', 'userRating');
        injectIntoResults($result, $userFavorites, null, 'favorite');

        $json = createPatternSet($result);

        return $json;
    }

    function getFlavorValues() {
        return $this->db->getEnumValues('patterns', 'flavor');
    }

    public function getSchema() {
        $flavorValues = $this->getFlavorValues();
        return array(
            "query" => array("type" => self::STRING, "required" => true),
            "startIndex" => array("type" => self::NUMBER, "required" => false, "default" => 0),
            "limit" => array("type" => self::NUMBER, "required" => false, "default" => 100),
            "flavor" => array("type" => self::ENUM_ARRAY, "values" => $flavorValues, "default" => $flavorValues, "required" => false)
        );
    }
}
