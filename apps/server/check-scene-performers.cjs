const Database = require("better-sqlite3");
const db = new Database("/tmp/eros-app.db", { readonly: true });

// Get Jade Harper's scenes with performers
const jadeHarperId = "3W8XYyvJK93PuDiQKbpAk";

console.log("=== Jade Harper's Scenes ===");
const scenes = db.prepare(`
  SELECT s.id, s.title
  FROM scenes s
  JOIN performers_scenes ps ON s.id = ps.scene_id
  WHERE ps.performer_id = ?
  ORDER BY s.title
`).all(jadeHarperId);

console.log(`Total scenes for Jade Harper: ${scenes.length}\n`);

scenes.slice(0, 10).forEach((s, i) => {
  // Get all performers for this scene
  const performers = db.prepare(`
    SELECT p.name
    FROM performers p
    JOIN performers_scenes ps ON p.id = ps.performer_id
    WHERE ps.scene_id = ?
  `).all(s.id);

  console.log(`${i + 1}. ${s.title}`);
  console.log(`   Performers: ${performers.map(p => p.name).join(", ")}`);
});

// Check if any scene has "Jadehub" or "Jade Hutchison" as separate performer
console.log("\n=== Checking for duplicate performer names ===");
const duplicateCheck = db.prepare(`
  SELECT s.title, p.name as performer_name
  FROM scenes s
  JOIN performers_scenes ps ON s.id = ps.scene_id
  JOIN performers p ON ps.performer_id = p.id
  WHERE LOWER(p.name) LIKE '%jade%'
  ORDER BY s.title
`).all();

console.log("All performers with 'Jade' in name:");
duplicateCheck.forEach(row => {
  console.log(`- ${row.title} <- ${row.performer_name}`);
});

db.close();
