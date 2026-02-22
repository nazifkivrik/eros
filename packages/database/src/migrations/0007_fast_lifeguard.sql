ALTER TABLE `download_queue` ADD `auto_management_paused` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `download_queue` ADD `auto_pause_reason` text;--> statement-breakpoint
ALTER TABLE `download_queue` ADD `auto_pause_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `download_queue` ADD `last_auto_pause_at` text;--> statement-breakpoint
ALTER TABLE `download_queue` ADD `last_activity_at` text;--> statement-breakpoint
CREATE INDEX `download_queue_status_added_idx` ON `download_queue` (`status`,`added_at`);--> statement-breakpoint
CREATE INDEX `download_queue_auto_mgmt_idx` ON `download_queue` (`auto_management_paused`,`status`);--> statement-breakpoint
CREATE INDEX `subscription_entity_idx` ON `subscriptions` (`entity_type`,`entity_id`);