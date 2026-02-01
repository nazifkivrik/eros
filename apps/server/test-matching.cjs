/**
 * Test script to verify torrent matching issues
 *
 * This script demonstrates the matching problem:
 * 1. Current logic removes performer names from BOTH torrent and scene titles
 * 2. This leaves generic titles that don't match well
 */

const Database = require("better-sqlite3");

// Use the production database
const db = new Database("/home/nazif/work/eros/apps/data/app.db", { readonly: true });

// Jade Harper performer ID (using one of the IDs in database)
const JADE_PERFORMER_ID = "KXcF2fgTnUJ3dg0UptUYB";

console.log("=== TORRENT MATCHING TEST ===\n");

// Get all Jade Harper scenes from database
const scenes = db.prepare(`
  SELECT s.id, s.title, s.date
  FROM scenes s
  JOIN performers_scenes ps ON s.id = ps.scene_id
  WHERE ps.performer_id = ?
  ORDER BY s.title
  LIMIT 15
`).all(JADE_PERFORMER_ID);

console.log(`Database Scenes for Jade Harper (${scenes.length} shown):\n`);
scenes.forEach((s, i) => {
  console.log(`[${i + 1}] ${s.title}`);
});

// Simulate some torrent titles that Prowlarr might return
// These are realistic examples of how torrents are named
const simulatedTorrents = [
  "Jade Harper - Australian Adventure",
  "Jade Harper - All Natural Big Tits",
  "Jade Harper - Busty Beach Vibes",
  "Jade Harper - Huge Natural Tits Stepsister",
  "Jade Harper - Bisexual Aussie Roommates",
  "Jade Harper - Fucking My Huge Natural Tits",
  "Jade Hutchison - Aussie Babe Got Banged",
  "Jadehub - Big Tit Aussie BBC",
  "Jadehubx - Huge Natural Titted Aussie",
];

console.log("\n\n=== SIMULATED TORRENT TITLS ===\n");
simulatedTorrents.forEach((t, i) => {
  console.log(`[${i + 1}] ${t}`);
});

// Current matching logic: removes performer names from titles
function cleanPerformersFromTitle(title, performerName, aliases) {
  let cleaned = title;

  // Build list of all names to remove
  const namesToRemove = [performerName, ...(aliases || [])];

  // Remove individual performer names
  for (const name of namesToRemove) {
    const pattern = new RegExp(
      `[-–—:,]?\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[-–—:,]?`,
      "gi"
    );
    cleaned = cleaned.replace(pattern, " ");
  }

  // Clean up extra spaces and trim
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Remove common suffixes
  cleaned = cleaned
    .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/gi, "")
    .replace(/\s+[-–—:,]?\s*(XXX|xxx|1080p|720p|480p|2160p|4K)?$/g, "")
    .trim();

  return cleaned;
}

// Get Jade Harper's aliases
const performer = db.prepare("SELECT name, aliases FROM performers WHERE id = ?").get(JADE_PERFORMER_ID);
const aliases = performer?.aliases ? JSON.parse(performer.aliases) : [];

console.log("\n\n=== CURRENT MATCHING LOGIC (CLEANS BOTH TITLES) ===\n");
console.log("Performer:", performer?.name);
console.log("Aliases:", aliases.join(", "));
console.log();

// Show what happens with current logic
console.log("TITLE COMPARISON (Current Logic):\n");
console.log("Torrent Title".padEnd(45), "→", "Cleaned Torrent".padEnd(35), "vs", "Cleaned Scene");
console.log("=".repeat(100));

const cleanedComparisons = [];

simulatedTorrents.forEach((torrentTitle) => {
  const cleanedTorrent = cleanPerformersFromTitle(torrentTitle, performer?.name, aliases);

  // Find best matching scene
  let bestScene = null;
  let bestSimilarity = 0;

  for (const scene of scenes) {
    const cleanedScene = cleanPerformersFromTitle(scene.title, performer?.name, aliases);
    const similarity = calculateSimilarity(cleanedTorrent, cleanedScene);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestScene = { scene, cleanedScene };
    }
  }

  cleanedComparisons.push({
    torrentTitle,
    cleanedTorrent,
    bestScene,
    similarity: bestSimilarity,
  });

  const matchScore = (bestSimilarity * 100).toFixed(1);
  const matchIndicator = bestSimilarity >= 0.7 ? "✓ MATCH" : bestSimilarity >= 0.4 ? "~ UNCERTAIN" : "✗ NO MATCH";

  console.log(
    torrentTitle.substring(0, 43).padEnd(43),
    "→",
    cleanedTorrent.substring(0, 33).padEnd(33),
    "vs",
    bestScene?.cleanedScene.substring(0, 30) || "(none)",
    `(${matchScore}%) ${matchIndicator}`
  );
});

// Simple similarity calculation
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

console.log("\n");
console.log("=".repeat(100));
console.log("\nANALYSIS:");
console.log("----------");

const goodMatches = cleanedComparisons.filter((c) => c.similarity >= 0.7).length;
const uncertainMatches = cleanedComparisons.filter((c) => c.similarity >= 0.4 && c.similarity < 0.7).length;
const noMatches = cleanedComparisons.filter((c) => c.similarity < 0.4).length;

console.log(`✓ Good Matches (≥70%): ${goodMatches}/${simulatedTorrents.length}`);
console.log(`~ Uncertain (40-70%): ${uncertainMatches}/${simulatedTorrents.length}`);
console.log(`✗ No Match (<40%): ${noMatches}/${simulatedTorrents.length}`);

console.log("\nPROBLEM DEMONSTRATION:");
console.log("----------------------");

// Show specific problematic cases
const problemCases = cleanedComparisons
  .filter((c) => c.similarity < 0.7)
  .slice(0, 3);

if (problemCases.length > 0) {
  console.log("\nExample failures (why matching doesn't work):\n");
  problemCases.forEach((c) => {
    console.log(`Torrent: "${c.torrentTitle}"`);
    console.log(`  → Cleaned: "${c.cleanedTorrent}"`);
    console.log(`  vs Scene: "${c.bestScene?.cleanedScene}"`);
    console.log(`  → Similarity: ${(c.similarity * 100).toFixed(1)}%`);
    console.log(`  → Issue: Both titles become too generic after cleaning performer name\n`);
  });
}

console.log("\n\n=== PROPOSED FIX (CLEAN ONLY TORRENT TITLE) ===\n");
console.log("TITLE COMPARISON (Proposed Logic):\n");
console.log("Torrent Title".padEnd(45), "→", "Cleaned Torrent".padEnd(35), "vs", "Original Scene Title");
console.log("=".repeat(100));

const proposedComparisons = [];

simulatedTorrents.forEach((torrentTitle) => {
  const cleanedTorrent = cleanPerformersFromTitle(torrentTitle, performer?.name, aliases);

  // Don't clean scene titles - use original
  let bestScene = null;
  let bestSimilarity = 0;

  for (const scene of scenes) {
    // Use ORIGINAL scene title, not cleaned
    const similarity = calculateSimilarity(cleanedTorrent, scene.title);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestScene = scene;
    }
  }

  proposedComparisons.push({
    torrentTitle,
    cleanedTorrent,
    bestScene,
    similarity: bestSimilarity,
  });

  const matchScore = (bestSimilarity * 100).toFixed(1);
  const matchIndicator = bestSimilarity >= 0.7 ? "✓ MATCH" : bestSimilarity >= 0.4 ? "~ UNCERTAIN" : "✗ NO MATCH";

  console.log(
    torrentTitle.substring(0, 43).padEnd(43),
    "→",
    cleanedTorrent.substring(0, 33).padEnd(33),
    "vs",
    bestScene?.title.substring(0, 30) || "(none)",
    `(${matchScore}%) ${matchIndicator}`
  );
});

console.log("\n");
console.log("=".repeat(100));
console.log("\nPROPOSED FIX RESULTS:");
console.log("---------------------");

const goodMatchesProposed = proposedComparisons.filter((c) => c.similarity >= 0.7).length;
const uncertainMatchesProposed = proposedComparisons.filter((c) => c.similarity >= 0.4 && c.similarity < 0.7).length;
const noMatchesProposed = proposedComparisons.filter((c) => c.similarity < 0.4).length;

console.log(`✓ Good Matches (≥70%): ${goodMatchesProposed}/${simulatedTorrents.length} (was ${goodMatches})`);
console.log(`~ Uncertain (40-70%): ${uncertainMatchesProposed}/${simulatedTorrents.length} (was ${uncertainMatches})`);
console.log(`✗ No Match (<40%): ${noMatchesProposed}/${simulatedTorrents.length} (was ${noMatches})`);

const improvement = goodMatchesProposed - goodMatches;
if (improvement > 0) {
  console.log(`\n✅ Improvement: +${improvement} additional matches!`);
}

db.close();
