const Database = require("better-sqlite3");
const db = new Database("/tmp/eros-app.db", { readonly: true });

// Search for Girthmasterr scenes
const scenes = db.prepare("SELECT id, title, date FROM scenes WHERE LOWER(title) LIKE '%girthmasterr%'").all();

console.log("=== Girthmasterr Scenes ===");
if (scenes.length === 0) {
  console.log("(none found)");
} else {
  scenes.forEach(s => console.log("- " + s.title + " (" + s.date + ")"));
}

// Also check for sextape scenes
console.log("\n=== Sextape Scenes ===");
const sextapes = db.prepare("SELECT id, title, date FROM scenes WHERE LOWER(title) LIKE '%sextape%'").all();
if (sextapes.length === 0) {
  console.log("(none found)");
} else {
  sextapes.forEach(s => console.log("- " + s.title + " (" + s.date + ")"));
}

// Check all Jade Harper scenes
console.log("\n=== All Jade Harper Scenes ===");
const jadeScenes = db.prepare(`
  SELECT s.title, s.date
  FROM scenes s
  JOIN performers_scenes ps ON s.id = ps.scene_id
  JOIN performers p ON ps.performer_id = p.id
  WHERE p.id = '3W8XYyvJK93PuDiQKbpAk'
  ORDER BY s.title
`).all();

console.log("Total:", jadeScenes.length);
jadeScenes.slice(0, 10).forEach(s => console.log("- " + s.title));

db.close();
