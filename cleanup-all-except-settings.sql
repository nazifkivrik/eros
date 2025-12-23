-- Cleanup All Data Except Settings
-- This will remove all scenes, performers, studios, subscriptions, etc.
-- Only app_settings, quality_profiles, indexers, and users will be kept

BEGIN TRANSACTION;

-- Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- Clear all scene-related data
DELETE FROM scene_files;
DELETE FROM scenes_tags;
DELETE FROM performers_scenes;
DELETE FROM studios_scenes;
DELETE FROM scene_exclusions;
DELETE FROM scenes;

-- Clear performers and studios
DELETE FROM performers;
DELETE FROM studios;

-- Clear tags
DELETE FROM tags;

-- Clear subscriptions
DELETE FROM subscriptions;

-- Clear metadata sources
DELETE FROM entity_meta_sources;
DELETE FROM meta_sources;

-- Clear download queue
DELETE FROM download_queue;

-- Clear file hashes
DELETE FROM file_hashes;

-- Clear logs and jobs
DELETE FROM logs;
DELETE FROM jobs_log;

-- Clear search history
DELETE FROM search_history;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Report what's left
SELECT 'CLEANUP COMPLETE!' as status;
SELECT '' as separator;
SELECT 'Remaining data:' as info;
SELECT 'app_settings: ' || COUNT(*) as count FROM app_settings
UNION ALL
SELECT 'quality_profiles: ' || COUNT(*) FROM quality_profiles
UNION ALL
SELECT 'indexers: ' || COUNT(*) FROM indexers
UNION ALL
SELECT 'users: ' || COUNT(*) FROM users;

COMMIT;

-- Vacuum to reclaim space (must be outside transaction)
VACUUM;
