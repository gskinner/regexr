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

class ErrorCodes {

    // Generic (1000 - 1099)
    const UNKNOWN = 1000;
    const NO_ACTION = 1001;

    // Mysql (1100 - 1199)
    const MYSQL_CONNECTION_ERR = 1100;
    const MYSQL_QUERY_ERR = 1101;

    // Generic API Errors (1200 - 1299)
    const API_ERROR = 1200;
    const API_DOESNT_EXIST = 1201;
    const API_MISSING_VALUES = 1202;
    const API_NO_DATA = 1203;
    const API_INVALID_JSON = 1204;
    const API_INVALID_NUMBER = 1205;
    const API_INVALID_EMAIL = 1206;
    const API_NO_SESSION = 1207;
    const API_NOT_ALLOWED = 1208;
    const API_INVALID_GUID = 1209;
    const API_INVALID_DATE = 1210;
    const API_INVALID_COLOR = 1211;
    const API_INVALID_BOOL = 1212;
    const API_VALUE_DOES_NOT_EXIST = 1213;
    const API_TIME_OVERLAPS = 1214;
    const API_INCORRECT_VALUE = 1215;
    const API_INVALID_ENUM = 1216;
    const API_INVALID_STRING = 1217;
    const API_PCRE_ERROR = 1218;
    const API_LOGIN_ERROR = 1219;
    const API_PATTERN_NOT_FOUND = 1221;
    const API_MISSING_REQUIREMENTS = 1222;

    public static function getMessage($code) {
        switch ($code) {
            case self::NO_ACTION:
                return 'No action was specified';
            case self::MYSQL_CONNECTION_ERR:
                return 'Error connecting to MySQL';
            case self::MYSQL_QUERY_ERR:
                return 'MySQL query error';
            case self::API_ERROR:
                return 'An action reported an error.';
            case self::API_DOESNT_EXIST:
                return "Value doesn't exist";
            case self::API_MISSING_VALUES:
                return 'Required values are missing.';
            case self::API_NO_DATA:
                return 'No data was found.';
            case self::API_INVALID_JSON:
                return 'JSON was not valid';
            case self::API_INVALID_NUMBER:
                return 'Type is not a valid number.';
            case self::API_INVALID_EMAIL:
                return 'Not a valid Email.';
            case self::API_NO_SESSION:
                return 'User is not logged in.';
            case self::API_NOT_ALLOWED:
                return 'Access to this action was denied.';
            case self::API_INVALID_GUID:
                return 'Invalid GUID';
            case self::API_INVALID_DATE:
                return 'Invalid date';
            case self::API_INVALID_COLOR:
                return 'A valid hex color is required.';
            case self::API_INVALID_BOOL:
                return 'A valid bool is required (0, "false", 1 or "true" are valid)';
            case self::API_INCORRECT_VALUE:
									return 'A value passed was not correct.';
            case self::API_INVALID_ENUM:
									return 'A enum value was incorrect.';
            case self::API_PCRE_ERROR:
                return "pcre execution error.";
            case self::API_LOGIN_ERROR:
                return "Login failed";
            case self::API_PATTERN_NOT_FOUND:
                return "No pattern found.";
            case self::API_MISSING_REQUIREMENTS:
                return "Server doesn't fullfil all the requirements.";
            case self::UNKNOWN:
            default:
                return 'An unknown error occurred';
        }
    }
}
