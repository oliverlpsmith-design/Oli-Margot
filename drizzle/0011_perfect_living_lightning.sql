ALTER TABLE `catalogueListings` ADD `classifierVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `catalogueListings` ADD `classificationEvidence` json;--> statement-breakpoint
ALTER TABLE `catalogueListings` ADD `bushfireStatus` enum('clear','flagged','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalogueListings` ADD `floodStatus` enum('clear','flagged','unknown') DEFAULT 'unknown' NOT NULL;