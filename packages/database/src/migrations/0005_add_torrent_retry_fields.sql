-- Add retry tracking fields to download_queue table
-- These fields track torrents that failed to add to qBittorrent and need retry

ALTER TABLE `download_queue` ADD COLUMN `add_to_client_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `download_queue` ADD COLUMN `add_to_client_last_attempt` text;--> statement-breakpoint
ALTER TABLE `download_queue` ADD COLUMN `add_to_client_error` text;--> statement-breakpoint

-- Create index for efficient queries of failed torrents that need retry
CREATE INDEX `download_queue_add_failed_idx` ON `download_queue` (`status`, `add_to_client_attempts`);
