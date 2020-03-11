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

class multiFavorite extends \core\AbstractAction {

    public $description = 'Favorite an array of patterns.';

    public function execute() {
        $urlIds = $this->getValue("patternIds");

        // Each id needs to be a number.
        $idList = quoteStringArray(array_map(function($id) {
            return \convertFromURL($id);
        }, $urlIds));

        $existingIds = $this->db->execute("SELECT id FROM patterns WHERE id IN ($idList)");
        $cleanIds = [];
        $vars = [];

        if (!is_null($existingIds)) {
            $idList = [];
            $userProfile = $this->getUserProfile();

            for ($i=0; $i < count($existingIds); $i++) {
                $id = $existingIds[$i]->id;
                $cleanIds[] = convertToURL($id);

                $vars[] = ["s", $userProfile->userId];
                $vars[] = ["s", $id];
                $idList[] = "(?, ?)";
            }

            $this->db->execute("INSERT IGNORE INTO favorites (userId, patternId) VALUES ". implode(",", $idList), $vars);
        }

        return new \core\Result($cleanIds);
    }

    public function getSchema() {
        return array(
            "patternIds" => array("type"=>self::JSON, "required"=>true)
        );
    }
}
