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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_studios` (
	`id` text PRIMARY KEY NOT NULL,
	`stashdb_id` text,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`parent_studio_id` text,
	`images` text DEFAULT '[]' NOT NULL,
	`url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_studios`("id", "stashdb_id", "name", "aliases", "parent_studio_id", "images", "url", "created_at", "updated_at") SELECT "id", "stashdb_id", "name", "aliases", "parent_studio_id", "images", "url", "created_at", "updated_at" FROM `studios`;--> statement-breakpoint
DROP TABLE `studios`;--> statement-breakpoint
ALTER TABLE `__new_studios` RENAME TO `studios`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `studios_stashdb_id_unique` ON `studios` (`stashdb_id`);