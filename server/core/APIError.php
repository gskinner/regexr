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

class APIError extends \Exception {

    public $error;
    public $code;
    public $message;

    public function __construct($code, $error = null, $message = null) {
        $this->code = $code;
        $this->error = $error;
        $this->message = $message;
    }

    public function getData() {
        return array('code' => $this->code, 'data' => $this->error, 'message' => ErrorCodes::getMessage($this->code).(is_null($this->message)?"":" ".$this->message));
    }

    public function getMetadata() {
        return array();
    }
}
