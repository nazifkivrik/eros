PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_download_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`torrent_hash` text,
	`indexer_id` text NOT NULL,
	`indexer_name` text,
	`title` text NOT NULL,
	`size` integer NOT NULL,
	`seeders` integer NOT NULL,
	`quality` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_download_queue`("id", "scene_id", "torrent_hash", "indexer_id", "indexer_name", "title", "size", "seeders", "quality", "status", "added_at", "completed_at") SELECT "id", "scene_id", "torrent_hash", "indexer_id", "indexer_name", "title", "size", "seeders", "quality", "status", "added_at", "completed_at" FROM `download_queue`;--> statement-breakpoint
DROP TABLE `download_queue`;--> statement-breakpoint
ALTER TABLE `__new_download_queue` RENAME TO `download_queue`;--> statement-breakpoint
PRAGMA foreign_keys=ON;