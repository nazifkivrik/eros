const Database = require("better-sqlite3");
const db = new Database("/home/nazif/work/eros/data/app.db", { readonly: true });

// Get performers with names like Jade
const performers = db.prepare("SELECT id, name, aliases, external_ids FROM performers WHERE LOWER(name) LIKE '%jade%' LIMIT 10").all();

console.log("Performers with Jade in name:");
performers.forEach(p => {
  const extIds = JSON.parse(p.external_ids || "[]");
  const aliases = JSON.parse(p.aliases || "[]");
  console.log("---");
  console.log("ID:", p.id);
  console.log("Name:", p.name);
  console.log("Aliases:", aliases.length > 0 ? aliases.join(", ") : "(empty)");
  console.log("External IDs:", extIds.map(e => e.source + ": " + e.id).join(", "));
});

db.close();
