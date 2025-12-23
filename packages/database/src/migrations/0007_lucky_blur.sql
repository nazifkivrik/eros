CREATE TABLE `entity_meta_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`last_synced_at` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entity_meta_sources_entity_idx` ON `entity_meta_sources` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_meta_sources_source_idx` ON `entity_meta_sources` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `file_hashes` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_file_id` text NOT NULL,
	`oshash` text,
	`phash` text,
	`md5` text,
	`calculated_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_file_id`) REFERENCES `scene_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_hashes_oshash_idx` ON `file_hashes` (`oshash`);--> statement-breakpoint
CREATE INDEX `file_hashes_phash_idx` ON `file_hashes` (`phash`);--> statement-breakpoint
CREATE INDEX `file_hashes_scene_file_idx` ON `file_hashes` (`scene_file_id`);--> statement-breakpoint
ALTER TABLE `performers` ADD `tpdb_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `performers_tpdb_id_unique` ON `performers` (`tpdb_id`);--> statement-breakpoint
ALTER TABLE `scenes` ADD `tpdb_id` text;--> statement-breakpoint
ALTER TABLE `scenes` ADD `tpdb_content_type` text;--> statement-breakpoint
CREATE UNIQUE INDEX `scenes_tpdb_id_unique` ON `scenes` (`tpdb_id`);--> statement-breakpoint
ALTER TABLE `studios` ADD `tpdb_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `studios_tpdb_id_unique` ON `studios` (`tpdb_id`);