const Database = require("better-sqlite3");
const db = new Database("/tmp/eros-app.db", { readonly: true });

// Get all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

console.log("=== Tables in Database ===");
tables.forEach(t => console.log("- " + t.name));

// Get performers
console.log("\n=== Performers ===");
const performers = db.prepare("SELECT id, name, aliases, external_ids FROM performers").all();
console.log("Total performers:", performers.length);

performers.forEach((p, i) => {
  const aliases = JSON.parse(p.aliases || "[]");
  const extIds = JSON.parse(p.external_ids || "[]");
  console.log(`${i + 1}. ${p.name}`);
  console.log(`   Aliases: ${aliases.length > 0 ? aliases.join(", ") : "(none)"}`);
  console.log(`   TPDB IDs: ${extIds.filter(e => e.source === "tpdb").map(e => e.id).join(", ") || "(none)"}`);
});

// Get performers_scenes junction table
console.log("\n=== Performers-Scenes Links (first 20) ===");
const links = db.prepare("SELECT * FROM performers_scenes LIMIT 20").all();
console.log("Total links:", db.prepare("SELECT COUNT(*) as count FROM performers_scenes").get().count);
links.slice(0, 10).forEach(l => {
  console.log(`Scene: ${l.scene_id} <- Performer: ${l.performer_id}`);
});

db.close();
