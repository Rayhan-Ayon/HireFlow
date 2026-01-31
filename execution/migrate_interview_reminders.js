const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Migrating DB: Adding reminder_sent column to interviews...');

db.run("ALTER TABLE interviews ADD COLUMN reminder_sent INTEGER DEFAULT 0", (err) => {
    if (err) {
        if (err.message.includes('duplicate column')) {
            console.log('✅ Column reminder_sent already exists.');
        } else {
            console.error('❌ Failed to add column:', err.message);
        }
    } else {
        console.log('✅ Column reminder_sent added successfully.');
    }
});
