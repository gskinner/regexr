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

namespace core;

class Authentication  {

    public function connect($type) {
        $config = [
            'callback' => $this->createCallbackURL($type),
            'providers' => [
                'GitHub' => [
                    'enabled' => true,
                    'keys' => [
                        'id' => GITHUB_ID,
                        'secret' => GITHUB_SECRET
                    ]
                ],
                'Google' => [
                    'enabled' => true,
                    'keys' => [
                        'id' => GOOGLE_ID,
                        'secret' => GOOGLE_SECRET
                    ]
                ],
                'Facebook' => [
                    'enabled' => true,
                    'keys' => [
                        'id' => FACEBOOK_ID,
                        'secret' => FACEBOOK_SECRET
                    ],
                    'scope' => 'email'
                ]
            ]
        ];

        // Normalize names, to match with Hybridauth's setup.
        switch ($type) {
            case "github":
                $type = "GitHub";
                break;
            case "google":
                $type = "Google";
                break;
            case "facebook":
                $type = "Facebook";
                break;
        }

        if (function_exists("curl_init")) {
            $auth = new \Hybridauth\Hybridauth($config);
            return $auth->getAdapter($type);
        } else {
            throw new \core\APIError(\core\ErrorCodes::API_MISSING_REQUIREMENTS, "curl is required for login.");
        }

        return null;
    }

    function getBaseDomain() {
        return 'https://'.$_SERVER['SERVER_NAME'];
    }

    function createCallbackURL($type) {
        $domain = $this->getBaseDomain();
        $baseUrl = "$domain/server/api.php?action=oauthCallback";
        return $baseUrl . "&type=" . strtolower($type);
    }
}
