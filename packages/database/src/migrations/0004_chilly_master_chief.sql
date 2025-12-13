CREATE TABLE `scene_exclusions` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`reason` text NOT NULL,
	`excluded_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scene_exclusions_scene_id_idx` ON `scene_exclusions` (`scene_id`);--> statement-breakpoint
ALTER TABLE `download_queue` ADD `qbit_hash` text;--> statement-breakpoint
ALTER TABLE `scene_files` ADD `nfo_path` text;--> statement-breakpoint
ALTER TABLE `scene_files` ADD `poster_path` text;