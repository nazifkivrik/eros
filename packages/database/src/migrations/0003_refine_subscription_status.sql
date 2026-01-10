-- Migration: Refine Subscription Status
-- Description: Remove 'monitored' column and update status enum to only 'active' and 'inactive'
-- Date: 2025-01-06

-- Step 1: Convert 'paused' status to 'inactive'
UPDATE subscriptions SET status = 'inactive' WHERE status = 'paused';--> statement-breakpoint

-- Step 2: Create new subscriptions table without 'monitored' column
CREATE TABLE `subscriptions_new` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`quality_profile_id` text NOT NULL,
	`auto_download` integer DEFAULT true NOT NULL,
	`include_metadata_missing` integer DEFAULT false NOT NULL,
	`include_aliases` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'inactive')),
	`search_cutoff_date` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`quality_profile_id`) REFERENCES `quality_profiles`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Step 3: Copy data from old table to new table
INSERT INTO `subscriptions_new`
SELECT id, entity_type, entity_id, quality_profile_id, auto_download,
       include_metadata_missing, include_aliases, status, search_cutoff_date,
       created_at, updated_at
FROM subscriptions;--> statement-breakpoint

-- Step 4: Drop old table
DROP TABLE subscriptions;--> statement-breakpoint

-- Step 5: Rename new table to original name
ALTER TABLE subscriptions_new RENAME TO subscriptions;--> statement-breakpoint

-- Create index on status for better query performance
CREATE INDEX IF NOT EXISTS `idx_subscriptions_status` ON `subscriptions`(`status`);

-- Step 6: Update _journal.json
-- This will be automatically updated by drizzle-kit
