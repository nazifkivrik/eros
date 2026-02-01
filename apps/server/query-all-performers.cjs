const Database = require("better-sqlite3");
const db = new Database("/home/nazif/work/eros/data/app.db", { readonly: true });

// Get all performers
const performers = db.prepare("SELECT id, name, aliases FROM performers LIMIT 20").all();

console.log("All performers (first 20):");
performers.forEach(p => {
  const aliases = JSON.parse(p.aliases || "[]");
  console.log(`- ${p.name}: ${aliases.length > 0 ? aliases.join(", ") : "(no aliases)"}`);
});

console.log("\nTotal performers:", db.prepare("SELECT COUNT(*) as count FROM performers").get().count);
db.close();
