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

class patterns extends \core\AbstractAction {
    public $description = 'Returns all the patterns either created or favorited by the current user. Favorite patterns are flagged with isFavorite.';

    public function execute() {
				$userProfile = $this->getUserProfile();

                // When using a single query performance is awful, so we run favorites and created separate.
				$createdResult = $this->db->query("SELECT patterns.*, ur.rating as userRating
                                    FROM patterns
                                    LEFT JOIN userRatings as ur ON ur.userId='{$userProfile->userId}' AND ur.patternId=patterns.id
                                    WHERE patterns.owner = '{$userProfile->userId}'
                                ");

                $favoriteResult = $this->db->query("SELECT patterns.*, favorites.patternId = patterns.id as favorite, ur.rating as userRating
                                    FROM patterns
                                    LEFT JOIN userRatings as ur ON ur.userId='{$userProfile->userId}' AND ur.patternId=patterns.id
                                    LEFT JOIN favorites ON favorites.userId = '{$userProfile->userId}'
                                    WHERE favorites.patternId = patterns.id");

				// Merge everything and filter out duplicate results.
                $result = \array_merge(\is_array($createdResult)?$createdResult:[], \is_array($favoriteResult)?$favoriteResult:[]);

				$cleanResult = [];
				if (!is_null($result)) {
						$keys = [];
						foreach ($result as $value) {
								$id = $value->id;
								if (!array_key_exists($id, $keys)) {
										$cleanResult[] = $value;
										$value->favorite = property_exists($value, "favorite")?true:null;
										$keys[$id] = true;
								}
						}

						usort($cleanResult, function ($a, $b) {
								return $a->rating > $b->rating?1:-1;
						});
				}

				return new \core\Result(createPatternSet($cleanResult));
    }

    public function getSchema() {
        return array();
    }
}
