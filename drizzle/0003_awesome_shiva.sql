ALTER TABLE `catalogueListings` ADD `buildingSizeSqm` decimal(12,2);--> statement-breakpoint
ALTER TABLE `catalogueListings` ADD `coveragePct` decimal(5,1);--> statement-breakpoint
ALTER TABLE `catalogueListings` ADD `frontageM` decimal(6,1);--> statement-breakpoint
ALTER TABLE `catalogueListings` ADD `isNewBuild` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `catalogueListings` ADD `hasEstateKeywords` boolean DEFAULT false NOT NULL;