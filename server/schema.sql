-- phpMyAdmin SQL Dump
-- version 3.5.2
-- http://www.phpmyadmin.net

-- --------------------------------------------------------

--
-- Table structure for table `favorites`
--

CREATE TABLE IF NOT EXISTS `favorites` (
  `userId` int(10) NOT NULL,
  `patternId` int(10) NOT NULL,
  `dateAdded` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `userPattern` (`userId`,`patternId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- --------------------------------------------------------

--
-- Table structure for table `patternLink`
--

CREATE TABLE IF NOT EXISTS `patternLink` (
  `parentId` int(10) DEFAULT NULL,
  `userId` int(10) NOT NULL,
  `patternId` mediumint(8) NOT NULL,
  UNIQUE KEY `index` (`patternId`,`parentId`,`userId`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `patterns`
--

CREATE TABLE IF NOT EXISTS `patterns` (
  `id` mediumint(8) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `description` text CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `keywords` text CHARACTER SET utf8 COLLATE utf8_unicode_ci,
  `pattern` text CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `replace` text CHARACTER SET utf8 COLLATE utf8_unicode_ci,
  `dateAdded` date NOT NULL DEFAULT '0000-00-00',
  `author` varchar(32) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `lastAccessed` date DEFAULT NULL,
  `content` text CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `visits` mediumint(5) NOT NULL DEFAULT '0',
  `state` varchar(1024) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `ratingSort` double NOT NULL DEFAULT '0',
  `owner` int(10) NOT NULL DEFAULT '0',
  `visibility` enum('private','protected','public') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'protected',
  `rating` float NOT NULL DEFAULT '0',
  `flavor` enum('pcre','js') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'js',
  `numPositiveVotes` int(10) NOT NULL DEFAULT '0',
  `numNegativeVotes` int(10) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `userPatterns` (`id`,`owner`),
  KEY `patternStats` (`visibility`,`flavor`),
  FULLTEXT KEY `search` (`name`,`description`,`pattern`,`replace`,`author`)
) ENGINE=MyISAM  DEFAULT CHARSET=latin1 AUTO_INCREMENT=0 ;

-- --------------------------------------------------------

--
-- Table structure for table `saveSessions`
--

CREATE TABLE IF NOT EXISTS `saveSessions` (
  `id` varchar(13) COLLATE utf8_bin NOT NULL,
  `expire` int(10) NOT NULL,
  `patternID` int(10) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `patternID` (`patternID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` varchar(64) NOT NULL,
  `access` int(10) NOT NULL,
  `data` varchar(1024) NOT NULL,
  `accessToken` text,
  `type` enum('temporary','github','google','facebook') NOT NULL,
  `userId` int(10) NOT NULL,
  UNIQUE KEY `id` (`id`),
  KEY `userId` (`userId`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `userRatings`
--

CREATE TABLE IF NOT EXISTS `userRatings` (
  `userId` int(10) NOT NULL,
  `patternId` mediumint(8) NOT NULL,
  `rating` enum('-1','0','1') COLLATE utf8_bin NOT NULL,
  `lastUpdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `rating` (`userId`,`patternId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS `users` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `email` varchar(254) NOT NULL,
  `username` varchar(256) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `authorName` varchar(256) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `type` enum('temporary','github','google','facebook') NOT NULL,
  `admin` tinyint(1) NOT NULL DEFAULT '0',
  `oauthUserId` varchar(256) NOT NULL,
  `dateCreated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastLogin` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `oauth_user` (`email`,`type`)
) ENGINE=MyISAM  DEFAULT CHARSET=latin1 AUTO_INCREMENT=0 ;
