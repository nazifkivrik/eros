-- Cleanup duplicate scenes
-- Keeps the oldest scene (by created_at) for each title+date combination

BEGIN TRANSACTION;

-- Step 1: Find and delete duplicate scene files
DELETE FROM scene_files
WHERE scene_id IN (
    SELECT s2.id
    FROM scenes s1
    JOIN scenes s2 ON s1.title = s2.title
        AND COALESCE(s1.date, 'NO_DATE') = COALESCE(s2.date, 'NO_DATE')
        AND s1.id != s2.id
        AND s1.created_at < s2.created_at
);

-- Step 2: Delete performer-scene links for duplicates
DELETE FROM performers_scenes
WHERE scene_id IN (
    SELECT s2.id
    FROM scenes s1
    JOIN scenes s2 ON s1.title = s2.title
        AND COALESCE(s1.date, 'NO_DATE') = COALESCE(s2.date, 'NO_DATE')
        AND s1.id != s2.id
        AND s1.created_at < s2.created_at
);

-- Step 3: Delete studio-scene links for duplicates
DELETE FROM studios_scenes
WHERE scene_id IN (
    SELECT s2.id
    FROM scenes s1
    JOIN scenes s2 ON s1.title = s2.title
        AND COALESCE(s1.date, 'NO_DATE') = COALESCE(s2.date, 'NO_DATE')
        AND s1.id != s2.id
        AND s1.created_at < s2.created_at
);

-- Step 4: Delete subscriptions for duplicate scenes
DELETE FROM subscriptions
WHERE entity_type = 'scene'
AND entity_id IN (
    SELECT s2.id
    FROM scenes s1
    JOIN scenes s2 ON s1.title = s2.title
        AND COALESCE(s1.date, 'NO_DATE') = COALESCE(s2.date, 'NO_DATE')
        AND s1.id != s2.id
        AND s1.created_at < s2.created_at
);

-- Step 5: Delete the duplicate scenes themselves
DELETE FROM scenes
WHERE id IN (
    SELECT s2.id
    FROM scenes s1
    JOIN scenes s2 ON s1.title = s2.title
        AND COALESCE(s1.date, 'NO_DATE') = COALESCE(s2.date, 'NO_DATE')
        AND s1.id != s2.id
        AND s1.created_at < s2.created_at
);

-- Report
SELECT
    'Cleanup complete!' as message,
    (SELECT COUNT(*) FROM scenes) as total_scenes_remaining,
    (SELECT COUNT(DISTINCT title || COALESCE(date, 'NO_DATE')) FROM scenes) as unique_titles;

COMMIT;
