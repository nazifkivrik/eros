CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `download_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`torrent_hash` text,
	`indexer_id` text NOT NULL,
	`title` text NOT NULL,
	`size` integer NOT NULL,
	`seeders` integer NOT NULL,
	`quality` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`added_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`indexer_id`) REFERENCES `indexers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `indexers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text,
	`priority` integer DEFAULT 50 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs_log` (
	`id` text PRIMARY KEY NOT NULL,
	`job_name` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`error_message` text,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `meta_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text,
	`priority` integer DEFAULT 50 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `performers` (
	`id` text PRIMARY KEY NOT NULL,
	`stashdb_id` text,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`disambiguation` text,
	`gender` text,
	`birthdate` text,
	`death_date` text,
	`career_start_date` text,
	`career_end_date` text,
	`images` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `performers_stashdb_id_unique` ON `performers` (`stashdb_id`);--> statement-breakpoint
CREATE TABLE `performers_scenes` (
	`performer_id` text NOT NULL,
	`scene_id` text NOT NULL,
	PRIMARY KEY(`performer_id`, `scene_id`),
	FOREIGN KEY (`performer_id`) REFERENCES `performers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quality_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`items` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quality_profiles_name_unique` ON `quality_profiles` (`name`);--> statement-breakpoint
CREATE TABLE `scene_files` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`file_path` text NOT NULL,
	`size` integer NOT NULL,
	`quality` text NOT NULL,
	`date_added` text DEFAULT (datetime('now')) NOT NULL,
	`relative_path` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`stashdb_id` text,
	`title` text NOT NULL,
	`date` text,
	`details` text,
	`duration` integer,
	`director` text,
	`code` text,
	`urls` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`has_metadata` integer DEFAULT true NOT NULL,
	`inferred_from_indexers` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenes_stashdb_id_unique` ON `scenes` (`stashdb_id`);--> statement-breakpoint
CREATE TABLE `scenes_tags` (
	`scene_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`scene_id`, `tag_id`),
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `search_history` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`entity_type` text,
	`results_count` integer NOT NULL,
	`searched_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` text PRIMARY KEY NOT NULL,
	`stashdb_id` text,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`parent_studio_id` text,
	`images` text DEFAULT '[]' NOT NULL,
	`url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`parent_studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studios_stashdb_id_unique` ON `studios` (`stashdb_id`);--> statement-breakpoint
CREATE TABLE `studios_scenes` (
	`studio_id` text NOT NULL,
	`scene_id` text NOT NULL,
	PRIMARY KEY(`studio_id`, `scene_id`),
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`quality_profile_id` text NOT NULL,
	`auto_download` integer DEFAULT true NOT NULL,
	`include_metadata_missing` integer DEFAULT false NOT NULL,
	`include_aliases` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`monitored` integer DEFAULT true NOT NULL,
	`search_cutoff_date` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`quality_profile_id`) REFERENCES `quality_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);