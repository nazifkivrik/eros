CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `directors` (
	`id` text PRIMARY KEY NOT NULL,
	`external_ids` text DEFAULT '[]' NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `directors_scenes` (
	`director_id` text NOT NULL,
	`scene_id` text NOT NULL,
	PRIMARY KEY(`director_id`, `scene_id`),
	FOREIGN KEY (`director_id`) REFERENCES `directors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `download_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`torrent_hash` text,
	`qbit_hash` text,
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
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`event_type` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`scene_id` text,
	`performer_id` text,
	`studio_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`performer_id`) REFERENCES `performers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `logs_created_at_idx` ON `logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `logs_level_created_at_idx` ON `logs` (`level`,`created_at`);--> statement-breakpoint
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
	`external_ids` text DEFAULT '[]' NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`disambiguation` text,
	`bio` text,
	`rating` real DEFAULT 0 NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`gender` text,
	`birthdate` text,
	`death_date` text,
	`birthplace` text,
	`birthplace_code` text,
	`astrology` text,
	`ethnicity` text,
	`nationality` text,
	`hair_colour` text,
	`eye_colour` text,
	`height` text,
	`weight` text,
	`measurements` text,
	`cupsize` text,
	`waist` text,
	`hips` text,
	`tattoos` text,
	`piercings` text,
	`fake_boobs` integer DEFAULT false NOT NULL,
	`career_start_year` integer,
	`career_end_year` integer,
	`same_sex_only` integer DEFAULT false NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`thumbnail` text,
	`poster` text,
	`links` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `scene_exclusions` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`reason` text NOT NULL,
	`excluded_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scene_exclusions_scene_id_idx` ON `scene_exclusions` (`scene_id`);--> statement-breakpoint
CREATE TABLE `scene_files` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`file_path` text NOT NULL,
	`size` integer NOT NULL,
	`quality` text NOT NULL,
	`date_added` text DEFAULT (datetime('now')) NOT NULL,
	`relative_path` text NOT NULL,
	`nfo_path` text,
	`poster_path` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scene_hashes` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`hash` text NOT NULL,
	`type` text NOT NULL,
	`duration` integer,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scene_hashes_hash_idx` ON `scene_hashes` (`hash`);--> statement-breakpoint
CREATE INDEX `scene_hashes_type_hash_idx` ON `scene_hashes` (`type`,`hash`);--> statement-breakpoint
CREATE TABLE `scene_markers` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`external_ids` text DEFAULT '[]' NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`date` text,
	`content_type` text DEFAULT 'scene' NOT NULL,
	`duration` integer,
	`format` text,
	`external_id` text,
	`code` text,
	`sku` text,
	`url` text,
	`images` text DEFAULT '[]' NOT NULL,
	`poster` text,
	`back_image` text,
	`thumbnail` text,
	`trailer` text,
	`background` text,
	`rating` real DEFAULT 0 NOT NULL,
	`site_id` text,
	`links` text,
	`has_metadata` integer DEFAULT true NOT NULL,
	`inferred_from_indexers` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
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
	`external_ids` text DEFAULT '[]' NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`slug` text,
	`url` text,
	`description` text,
	`rating` real DEFAULT 0 NOT NULL,
	`parent_studio_id` text,
	`network_id` text,
	`images` text DEFAULT '[]' NOT NULL,
	`logo` text,
	`favicon` text,
	`poster` text,
	`links` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
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
	`external_ids` text DEFAULT '[]' NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);