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

// Docs: https://github.com/Respect/Validation
use Respect\Validation\Validator as v;

abstract class AbstractAction {

    const JSON = 1;
    const STRING = 2;
    const NUMBER = 3;
    const EMAIL = 4;
    const GUID = 5;
    const UNIX_TIMESTAMP = 6;
    const DATE_ISO_8601 = 7;
    const COLOR = 8;
    const BOOL = 9;
    const GUID_ARRAY = 10;
    const ENUM = 11;
    const ENUM_ARRAY = 12;

    const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

    protected $values;

    /** @var DB $db */
    protected $db;

    static function getType($id) {
        switch ($id) {
            case self::JSON:
                return 'json';
            case self::STRING:
                return 'string';
            case self::NUMBER:
                return 'number';
            case self::EMAIL:
                return 'email';
            case self::GUID:
                return 'guid';
            case self::UNIX_TIMESTAMP:
                return 'timestamp';
            case self::DATE_ISO_8601:
                return 'ISO 8601 Formatted date';
            case self::COLOR:
                return 'Color';
            case self::BOOL:
                return 'Boolean (0 or 1)';
            case self::GUID_ARRAY:
                return 'Array of Guid\'s';
            case self::ENUM:
								return 'One of a predefined array of values.';
        }
    }

    function __construct($values = null) {
        $this->values = $values;
    }

    public function setDB($db) {
        $this->db = $db;
    }

    public function validate() {
        if (!empty($this->getValue("simError"))) {
            throw new APIError(ErrorCodes::UNKNOWN);
        }

        // Validate that we have everything that's required.
        if (!is_null($this->values)) {
            $schema = $this->getSchema();
            $this->validateSchema($schema);

            // Now sanitize the data.
            foreach ($this->values as $key => $value) {
                $type = null;
                $this->values[$key] = is_string($value)?stripslashes($value):$value;
                $schemaValue = idx($schema, $key);
                if ($schemaValue) {
                    $type = idx($schemaValue, 'type');
                }

                if ($type) {
                    // Add more data types here as required
                    switch ($type) {
                        case self::JSON:
                            if(is_array($value)) {} else
                            if (!v::json()->validate($value)) {
                                throw new APIError(ErrorCodes::API_INVALID_JSON, array(
                                    'key' => $key,
                                    'code' => $this->jsonErrorToString(json_last_error())
                                ));
                            } else {
							    $this->values[$key] = json_decode($this->values[$key]);
                            }
                            break;
                        case self::NUMBER:
                            if (!v::numeric()->validate($value)) {
                                throw new APIError(ErrorCodes::API_INVALID_NUMBER, $key);
                            }
                            $this->values[$key] = intval($this->values[$key]);
                            break;
                        case self::EMAIL:
                            if (!v::email()->validate($value)) {
                                throw new APIError(ErrorCodes::API_INVALID_EMAIL, $key);
                            }
                            break;
                        case self::GUID:
                            if (isGuid($value) == false) {
                                throw new APIError(ErrorCodes::API_INVALID_GUID, $key);
                            }
                            break;
                        case self::UNIX_TIMESTAMP: // In seconds
                            if (!v::numeric()->length(10, 10)->validate($value)) {
                                throw new APIError(ErrorCodes::API_INVALID_DATE, $key);
                            }
                            break;
                        case self::DATE_ISO_8601:
                            // 2014-09-08T08:02:17-05:00
                            if (!v::date('c')->validate($value)) {
                                throw new APIError(ErrorCodes::API_INVALID_DATE, $key);
                            }
                            break;
                        case self::COLOR:
                            if (!v::numeric()->equals(-1)->validate($value) && !v::hexRgbColor()->validate($value)) {
                                throw new APIError(ErrorCodes::API_INVALID_COLOR, $key);
                            }
                            break;
                        case self::BOOL:
                            if ($value == "true" || $value == "false") {
                                $this->values[$key] = $value == 'true' ? true : false;
                            } else if (v::numeric()->between(-1, 2)->validate($value)) {
                                $this->values[$key] = floor($value) == 1 ? true : false;
                            } else {
                                throw new APIError(ErrorCodes::API_INVALID_BOOL, $key);
                            }
                            break;
                        case self::GUID_ARRAY:
                            $arr = $this->validateArray($key, $value);

                            foreach ($arr as $g) {
                                if (!isGuid($g)) {
                                    throw new APIError(ErrorCodes::API_INVALID_GUID, $key);
                                }
                            }
                            $this->values[$key] = $arr;
                            break;
                        case self::ENUM:
                            $enumValues = $schemaValue['values'];
                            $this->validateEnum($enumValues, $key, $value);
                            break;
                        case self::ENUM_ARRAY:
                            $enumValues = $schemaValue['values'];
                            $arr = $this->validateArray($key, $value);
                            foreach ($arr as $e) {
                                    $this->validateEnum($enumValues, $key, $e, "values all must be one of: ");
                            }
                            $this->values[$key] = $arr;
                            break;
                        case self::STRING:
                        default:
                            $this->values[$key] = $value;
                    }
                }
            }
        }

        return $this;
    }

    public function requiresDatabase() {
        return true;
    }

    function validateEnum($enum, $key, $value, $message="value must be one of: ") {
        if (!v::in($enum)->validate($value)) {
            throw new APIError(ErrorCodes::API_INVALID_ENUM, $key,  $message . implode(", ", $enum));
        }
    }

    function validateArray($key, $value) {
        if (is_string($value) && !v::json()->validate($value)) {
            throw new APIError(ErrorCodes::API_INVALID_JSON, $key);
        }

        if (is_string($this->values[$key])) {
            $arr = json_decode($value);
        } else if (is_array($value)) {
            $arr = $value;
        } else {
            throw new APIError(ErrorCodes::API_INVALID_JSON, $key);
        }
        return $arr;
    }

    function jsonErrorToString($code) {
        switch ($code) {
            case 0:
                return 'JSON_ERROR_NONE';
            case 1:
                return 'JSON_ERROR_DEPTH';
            case 2:
                return 'JSON_ERROR_STATE_MISMATCH';
            case 3:
                return 'JSON_ERROR_CTRL_CHAR';
            case 4:
                return 'JSON_ERROR_SYNTAX';
            case 5:
                return 'JSON_ERROR_UTF8';
            default:
                return "Unknown error $code";
        }
    }

    function validateSchema($schema) {
        $errors = array();
        foreach ($schema as $key => $value) {
            $value = (object)$value;

            if (property_exists($value, 'required') && $value->required === false) {
                // Assign our default, if one exists.
                if (is_null(idx($this->values, $key)) && property_exists($value, 'default')) {
                    $this->values[$key] = $value->default;
                }
                continue;
            }
            if (is_null(idx($this->values, $key))) {
                $errors[] = $key;
            }
        }

        $errCount = count($errors);
        if ($errCount > 0) {
            $returnError = array('message' => "$errCount value(s) not found:");
            $returnError['errors'] = $errors;
            throw new APIError(ErrorCodes::API_MISSING_VALUES, $returnError);
        }
    }

    function getValue($key) {
        $value = idx($this->values, $key);
        $value = is_null($this->db)?$value:$this->db->sanitize($value);
        return $value;
    }

    function hasValue($key) {
        return !is_null($this->getValue($key));
    }

    function cleanAndValidateValues($values, $min, $ignoreForMessage = null) {
        $cleanValues = array_filter($values,
            function($value) {
                if (is_bool($value)) {
                    return true;
                }
                return !empty($value);
            }
        );

        if (count($cleanValues) <= $min) {
            $messageValues = $values;
            if (!is_null($ignoreForMessage)) {
                foreach ($ignoreForMessage as $key => $value) {
                    unset($messageValues[$value]);
                }
            }
            throw new APIError(ErrorCodes::API_ERROR, $this->createMissingValuesError($messageValues));
        }

        return $cleanValues;
    }

    function createMissingValuesError($values) {
        $keys = array_keys($values);
        $count = count($keys);
        $missingKeysString = null;

        if ($count == 1) {
            $missingKeysString = "`$keys[0]`";
        } else if ($count > 1) {
            $lastKey = array_pop($keys);
            $missingKeysString = "one of `" . implode('`, `', $keys) . "` or `$lastKey`";
        }

        return "You must set atleast $missingKeysString";
    }

    /**
    * Check the current session and return the users profile, or optionally throw an access error.
    */
    function getUserProfile() {
        $userProfile = (object)(new \account\verify())->run($this->db);
        return $userProfile;
    }

    /**
     * @return mixed
     * @throws Error
     * Shorthand to execute an action standalone, Ex from command line, or another class.
     *
     */
    function run($db = null) {
        if (!is_null($db)) {
            $this->setDB($db);
        }
        return $this->validate()->execute()->getData();
    }

    /**
     * @return mixed
     *
     * Called after the data is validated and ready to be handled.
     */
    abstract function execute();

    /**
     * @return array;
     *
     * Returns an array of value names that the $values object is required to have.
     */
    abstract function getSchema();
}
