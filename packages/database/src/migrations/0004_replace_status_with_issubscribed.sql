-- Migration: Replace status field with isSubscribed boolean
-- This migration removes the status text field and adds an isSubscribed boolean field
-- Active subscriptions become isSubscribed=1, inactive become isSubscribed=0

-- Step 1: Create new table with isSubscribed instead of status
CREATE TABLE `subscriptions_new` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `quality_profile_id` text NOT NULL,
  `auto_download` integer DEFAULT 1 NOT NULL,
  `include_metadata_missing` integer DEFAULT 0 NOT NULL,
  `include_aliases` integer DEFAULT 0 NOT NULL,
  `is_subscribed` integer DEFAULT 1 NOT NULL,
  `search_cutoff_date` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`quality_profile_id`) REFERENCES `quality_profiles`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Step 2: Copy data from old table to new table
-- Convert status: "active" -> isSubscribed=1, "inactive" -> isSubscribed=0
INSERT INTO `subscriptions_new` (id, entity_type, entity_id, quality_profile_id, auto_download, include_metadata_missing, include_aliases, is_subscribed, search_cutoff_date, created_at, updated_at)
SELECT
  id,
  entity_type,
  entity_id,
  quality_profile_id,
  auto_download,
  include_metadata_missing,
  include_aliases,
  CASE WHEN status = 'active' THEN 1 ELSE 0 END as is_subscribed,
  search_cutoff_date,
  created_at,
  updated_at
FROM `subscriptions`;--> statement-breakpoint

-- Step 3: Drop old table
DROP TABLE `subscriptions`;--> statement-breakpoint

-- Step 4: Rename new table to original name
ALTER TABLE `subscriptions_new` RENAME TO `subscriptions`;--> statement-breakpoint

-- Step 5: Recreate indexes
CREATE INDEX `idx_subscriptions_is_subscribed` ON `subscriptions` (`is_subscribed`);

