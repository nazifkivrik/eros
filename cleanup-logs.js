const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = '/data/eros.db';
console.log('Opening database:', dbPath);
const db = new Database(dbPath);

// Check if we can read logs
const checkResult = db.prepare('SELECT COUNT(*) as count, event_type FROM logs GROUP BY event_type').all();
console.log('Current log types:', checkResult);

// Delete missing-scenes logs
const deleteResult = db.prepare("DELETE FROM logs WHERE event_type = 'missing-scenes'").run();
console.log('Deleted rows:', deleteResult.changes);

// Verify deletion
const afterResult = db.prepare('SELECT COUNT(*) as count, event_type FROM logs GROUP BY event_type').all();
console.log('After cleanup:', afterResult);

db.close();
console.log('Done');
