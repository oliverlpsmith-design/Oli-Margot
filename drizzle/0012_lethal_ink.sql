CREATE TABLE `aiAgentScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`catalogueListingId` int NOT NULL,
	`personaKey` enum('subdivider','cash_flow_hunter','value_finder') NOT NULL,
	`hypotheticalBudget` int NOT NULL,
	`qualityScore` int NOT NULL,
	`evidenceConfidence` int NOT NULL,
	`deterministicScore` int NOT NULL,
	`recommendationRank` int,
	`eligible` boolean NOT NULL DEFAULT true,
	`analysisSource` enum('primary','fallback','reused') NOT NULL,
	`inputFingerprint` varchar(64) NOT NULL,
	`model` varchar(80) NOT NULL,
	`rationale` text NOT NULL,
	`keyEvidence` json NOT NULL,
	`materialRisks` json NOT NULL,
	`unknowns` json NOT NULL,
	`scoreComponents` json NOT NULL,
	`scenarioAssumptions` json,
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`analysedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiAgentScores_id` PRIMARY KEY(`id`),
	CONSTRAINT `aiAgentScores_run_persona_listing_uq` UNIQUE(`runId`,`personaKey`,`catalogueListingId`)
);
--> statement-breakpoint
CREATE TABLE `aiAnalystRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activeLock` varchar(16),
	`trigger` enum('scheduled','admin') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`sourceScanRunId` int,
	`taskUid` varchar(96),
	`requestedByUserId` int,
	`primaryModel` varchar(80) NOT NULL,
	`fallbackModel` varchar(80) NOT NULL,
	`candidateCount` int NOT NULL DEFAULT 0,
	`scoredCount` int NOT NULL DEFAULT 0,
	`reusedCount` int NOT NULL DEFAULT 0,
	`llmCallCount` int NOT NULL DEFAULT 0,
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `aiAnalystRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `aiAnalystRuns_active_lock_uq` UNIQUE(`activeLock`)
);
--> statement-breakpoint
CREATE INDEX `aiAgentScores_current_picks_idx` ON `aiAgentScores` (`runId`,`personaKey`,`recommendationRank`);--> statement-breakpoint
CREATE INDEX `aiAgentScores_reuse_idx` ON `aiAgentScores` (`catalogueListingId`,`personaKey`,`analysedAt`);--> statement-breakpoint
CREATE INDEX `aiAnalystRuns_status_started_idx` ON `aiAnalystRuns` (`status`,`startedAt`);--> statement-breakpoint
CREATE INDEX `aiAnalystRuns_completed_finished_idx` ON `aiAnalystRuns` (`status`,`finishedAt`);