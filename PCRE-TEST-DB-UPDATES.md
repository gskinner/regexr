Add new "mode" and "tests" columns

ALTER TABLE `patterns` ADD `mode` ENUM('text','tests') NOT NULL DEFAULT 'text' AFTER `numNegativeVotes`;
ALTER TABLE `patterns` ADD `tests` MEDIUMTEXT NULL DEFAULT NULL AFTER `mode`;
