// Test TPDB API for the Jade performer IDs
const TPDB_IDS = [
  "ef394e2c-d192-4147-8a2e-b81ff7a01a9e", // Jade Harper (with alias in our DB)
  "c0d7b4ce-d198-487e-90e3-d97629d05c18", // Jadehub (from debug log)
  "a5af7f52-8274-42dc-9813-aa34fd47125f", // Jadehubx
  "d3d8a9dd-98d0-4f98-92f7-00e90d502bd4", // Jade Hutchison
];

// Get API key from Docker
const { execSync } = require("child_process");
const settings = execSync("docker exec eros-app cat /data/app.db.settings.json 2>/dev/null || echo '{}'").toString();
let apiKey = "";
try {
  const parsed = JSON.parse(settings);
  apiKey = parsed.tpdb?.apiKey || parsed.apiKey || "";
} catch (e) {
  console.log("Could not parse settings");
}

if (!apiKey) {
  console.log("No API key found, trying from env...");
  apiKey = process.env.TPDB_API_KEY || "";
}

if (!apiKey) {
  console.log("ERROR: No TPDB API key found!");
  process.exit(1);
}

async function testTPDB(id) {
  const url = `https://api.theporndb.net/performers/${id}`;
  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    console.log(`\n=== TPDB ID: ${id} ===`);
    console.log(`Name: ${data.data?.name || "N/A"}`);
    console.log(`Aliases: [${data.data?.aliases?.join(", ") || "(empty)"}]`);
    if (data.data?.aliases && data.data.aliases.length > 0) {
      console.log("✓ HAS ALIASES!");
    } else {
      console.log("✗ NO ALIASES");
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}

async function main() {
  console.log("Testing TPDB API for Jade performer entries...\n");
  for (const id of TPDB_IDS) {
    await testTPDB(id);
  }
}

main();
