CREATE INDEX `logs_created_at_idx` ON `logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `logs_level_created_at_idx` ON `logs` (`level`,`created_at`);