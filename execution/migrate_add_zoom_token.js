const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Migrating users table to add zoom_refresh_token...');

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN zoom_refresh_token TEXT", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('zoom_refresh_token column already exists.');
        } else if (err) {
            console.error('Error adding zoom_refresh_token:', err.message);
        } else {
            console.log('Added zoom_refresh_token column.');
        }
    });
});

db.close(() => {
    console.log('Migration completed.');
});
