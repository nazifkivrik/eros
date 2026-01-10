CREATE TABLE `ai_match_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text,
	`torrent_title` text NOT NULL,
	`score` real NOT NULL,
	`method` text NOT NULL,
	`model` text,
	`threshold` real NOT NULL,
	`matched` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_match_scores_scene_idx` ON `ai_match_scores` (`scene_id`);--> statement-breakpoint
CREATE INDEX `ai_match_scores_created_at_idx` ON `ai_match_scores` (`created_at`);--> statement-breakpoint
CREATE TABLE `torrent_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`group_title` text NOT NULL,
	`raw_titles` text NOT NULL,
	`scene_id` text,
	`torrent_count` integer NOT NULL,
	`indexer_count` integer NOT NULL,
	`status` text NOT NULL,
	`ai_score` real,
	`search_phase` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `torrent_groups_scene_idx` ON `torrent_groups` (`scene_id`);--> statement-breakpoint
CREATE INDEX `torrent_groups_status_idx` ON `torrent_groups` (`status`);--> statement-breakpoint
ALTER TABLE `scenes` ADD `discovery_group_id` text;