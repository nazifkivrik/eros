-- Cleanup Duplicate Scenes SQL Script
-- This script identifies duplicate scenes by title + date
-- Run with: sqlite3 /data/app.db < cleanup-duplicates.sql

.mode column
.headers on

-- First, let's see what duplicates we have
SELECT 'DUPLICATE ANALYSIS' as section;
SELECT '==================' as separator;

SELECT
    title,
    date,
    COUNT(*) as count,
    GROUP_CONCAT(id, ' | ') as scene_ids,
    GROUP_CONCAT(tpdb_id, ' | ') as tpdb_ids
FROM scenes
GROUP BY title, COALESCE(date, 'NO_DATE')
HAVING count > 1
ORDER BY count DESC, title;

-- Count total duplicates
SELECT '' as separator;
SELECT 'SUMMARY' as section;
SELECT '=======' as separator;

SELECT
    COUNT(DISTINCT title || COALESCE(date, 'NO_DATE')) as duplicate_groups,
    SUM(cnt - 1) as total_duplicates_to_remove
FROM (
    SELECT title, date, COUNT(*) as cnt
    FROM scenes
    GROUP BY title, COALESCE(date, 'NO_DATE')
    HAVING cnt > 1
);
