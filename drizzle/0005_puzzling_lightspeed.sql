CREATE TABLE `savedSearches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`filters` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastNotifiedAt` timestamp,
	CONSTRAINT `savedSearches_id` PRIMARY KEY(`id`)
);
