-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Generation Time: Nov 17, 2022 at 04:25 PM
-- Server version: 8.0.30-0ubuntu0.20.04.2
-- PHP Version: 7.4.3

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------

--
-- Table structure for table `favorites`
--

CREATE TABLE `favorites` (
  `userId` int NOT NULL,
  `patternId` int NOT NULL,
  `dateAdded` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

-- --------------------------------------------------------

--
-- Table structure for table `patternLink`
--

CREATE TABLE `patternLink` (
  `parentId` int DEFAULT NULL,
  `userId` int NOT NULL,
  `patternId` mediumint NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `patterns`
--

CREATE TABLE `patterns` (
  `id` mediumint UNSIGNED NOT NULL,
  `name` varchar(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT '',
  `description` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `keywords` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `pattern` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `replace` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci,
  `dateAdded` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `author` varchar(32) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT '',
  `lastAccessed` date DEFAULT NULL,
  `content` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  `visits` mediumint NOT NULL DEFAULT '0',
  `state` varchar(1024) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
  `ratingSort` double NOT NULL DEFAULT '0',
  `owner` int NOT NULL DEFAULT '0',
  `visibility` enum('private','protected','public') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'protected',
  `rating` float NOT NULL DEFAULT '0',
  `flavor` enum('pcre','js') CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL DEFAULT 'js',
  `numPositiveVotes` int NOT NULL DEFAULT '0',
  `numNegativeVotes` int NOT NULL DEFAULT '0',
  `mode` enum('text','tests') NOT NULL DEFAULT 'text',
  `tests` mediumtext CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `saveSessions`
--

CREATE TABLE `saveSessions` (
  `id` varchar(13) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `expire` int NOT NULL,
  `patternID` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(64) NOT NULL,
  `access` int NOT NULL,
  `data` varchar(1024) NOT NULL,
  `accessToken` text,
  `type` enum('temporary','github','google','facebook') NOT NULL,
  `userId` int NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `userRatings`
--

CREATE TABLE `userRatings` (
  `userId` int NOT NULL,
  `patternId` mediumint NOT NULL,
  `rating` enum('-1','0','1') CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `lastUpdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip` varchar(45) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `email` varchar(254) NOT NULL,
  `username` varchar(256) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL,
  `authorName` varchar(256) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin DEFAULT NULL,
  `type` enum('temporary','github','google','facebook') NOT NULL,
  `admin` tinyint(1) NOT NULL DEFAULT '0',
  `oauthUserId` varchar(256) NOT NULL,
  `dateCreated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastLogin` datetime NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `favorites`
--
ALTER TABLE `favorites`
  ADD UNIQUE KEY `userPattern` (`userId`,`patternId`);

--
-- Indexes for table `patternLink`
--
ALTER TABLE `patternLink`
  ADD UNIQUE KEY `index` (`patternId`,`parentId`,`userId`);

--
-- Indexes for table `patterns`
--
ALTER TABLE `patterns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `userPatterns` (`id`,`owner`),
  ADD KEY `patternStats` (`visibility`,`flavor`),
  ADD KEY `owner` (`owner`),
  ADD KEY `ratings_sort` (`ratingSort`);
ALTER TABLE `patterns` ADD FULLTEXT KEY `search` (`name`,`description`,`author`);

--
-- Indexes for table `saveSessions`
--
ALTER TABLE `saveSessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `patternID` (`patternID`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD UNIQUE KEY `id` (`id`),
  ADD KEY `userId` (`userId`),
  ADD KEY `access_time` (`access`);

--
-- Indexes for table `userRatings`
--
ALTER TABLE `userRatings`
  ADD UNIQUE KEY `rating` (`userId`,`patternId`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `oauth_user` (`email`,`type`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `patterns`
--
ALTER TABLE `patterns`
  MODIFY `id` mediumint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
