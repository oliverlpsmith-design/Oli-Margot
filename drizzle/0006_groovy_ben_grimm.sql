ALTER TABLE `savedSearches` ADD `lastMatchCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `savedSearches` ADD `lastMatchesJson` text;