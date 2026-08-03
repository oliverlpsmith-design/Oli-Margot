CREATE TABLE `savedProperties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`listingId` varchar(64),
	`address` text NOT NULL,
	`suburb` varchar(120),
	`postcode` varchar(8),
	`state` varchar(8) NOT NULL DEFAULT 'NSW',
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`priceDisplay` varchar(120),
	`landAreaSqm` decimal(12,2),
	`minLotSizeSqm` decimal(12,2),
	`minLotSizeLabel` varchar(64),
	`epiName` text,
	`lgaName` varchar(120),
	`zoneCode` varchar(16),
	`zoneDescription` text,
	`potentialLots` int,
	`verdict` enum('subdividable','marginal','not_subdividable','unknown') NOT NULL DEFAULT 'unknown',
	`listingUrl` text,
	`imageUrl` text,
	`notes` text,
	`rawData` json,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedProperties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `searchHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`location` varchar(200) NOT NULL,
	`filters` json,
	`resultCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `searchHistory_id` PRIMARY KEY(`id`)
);
