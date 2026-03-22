-- Migration 0008: Add unique constraints and missing indexes
-- This migration improves database schema with:
-- 1. Unique indexes for slug fields
-- 2. Performance indexes for frequently queried columns
-- 3. Foreign key constraint improvements

--> statement-breakpoint

-- Add unique index for performers.slug
CREATE UNIQUE INDEX IF NOT EXISTS performers_slug_idx ON performers(slug);

--> statement-breakpoint

-- Add unique index for studios.slug
CREATE UNIQUE INDEX IF NOT EXISTS studios_slug_idx ON studios(slug);

--> statement-breakpoint

-- Add unique index for scenes.slug
CREATE UNIQUE INDEX IF NOT EXISTS scenes_slug_idx ON scenes(slug);

--> statement-breakpoint

-- Add unique index for directors.slug
CREATE UNIQUE INDEX IF NOT EXISTS directors_slug_idx ON directors(slug);

--> statement-breakpoint

-- Add unique index for tags.slug
CREATE UNIQUE INDEX IF NOT EXISTS tags_slug_idx ON tags(slug);

--> statement-breakpoint

-- Add performance index for scenes.is_subscribed
CREATE INDEX IF NOT EXISTS scenes_is_subscribed_idx ON scenes(is_subscribed);

--> statement-breakpoint

-- Add performance index for scenes.discoveryGroupId
CREATE INDEX IF NOT EXISTS scenes_discovery_group_id_idx ON scenes(discovery_group_id);
