const Database = require("better-sqlite3");
const db = new Database("/tmp/eros-app.db", { readonly: true });

// Get all Jade Harper entries
const performers = db.prepare("SELECT id, name, full_name, aliases, external_ids, created_at FROM performers WHERE name LIKE '%Jade%' OR full_name LIKE '%Jade%'").all();

console.log("=== Jade Performers in Database ===");
performers.forEach((p, i) => {
  const aliases = JSON.parse(p.aliases || "[]");
  const extIds = JSON.parse(p.external_ids || "[]");
  console.log(`\n[${i + 1}] ID: ${p.id}`);
  console.log(`    Name: ${p.name}`);
  console.log(`    Full Name: ${p.full_name}`);
  console.log(`    Aliases: ${aliases.length > 0 ? aliases.join(", ") : "(none)"}`);
  console.log(`    External IDs: ${extIds.map(e => `${e.source}: ${e.id}`).join(", ")}`);
  console.log(`    Created: ${p.created_at}`);
});

// Check subscriptions for Jade
console.log("\n=== Subscriptions for Jade ===");
const subs = db.prepare("SELECT * FROM subscriptions WHERE entity_name LIKE '%Jade%' OR entity_name LIKE '%jade%'").all();
console.log("Found", subs.length, "subscriptions");
subs.forEach(s => {
  console.log(`- ${s.entity_type}: ${s.entity_name} (ID: ${s.entity_id})`);
});

db.close();
