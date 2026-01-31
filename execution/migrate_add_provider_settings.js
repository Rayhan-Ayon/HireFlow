const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Migrating users table to add provider settings...');

db.serialize(() => {
    // Add enable_teams
    db.run("ALTER TABLE users ADD COLUMN enable_teams BOOLEAN DEFAULT 0", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('enable_teams column already exists.');
        } else if (err) {
            console.error('Error adding enable_teams:', err.message);
        } else {
            console.log('Added enable_teams column.');
        }
    });

    // Add enable_zoom
    db.run("ALTER TABLE users ADD COLUMN enable_zoom BOOLEAN DEFAULT 0", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('enable_zoom column already exists.');
        } else if (err) {
            console.error('Error adding enable_zoom:', err.message);
        } else {
            console.log('Added enable_zoom column.');
        }
    });

    // Add enable_manual (for "Link" option) - defaulting to 1 (true) as safe fallback? Or 0?
    // User said "user will determine what platform". Let's default to 0 to be clean, but maybe 1 for safety?
    // Let's stick to the plan: explicit toggles. Default 0 is fine, user can enable.
    // Actually, "Link" is useful. Let's default to 1 for manual link so they have *something*.
    db.run("ALTER TABLE users ADD COLUMN enable_manual BOOLEAN DEFAULT 1", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('enable_manual column already exists.');
        } else if (err) {
            console.error('Error adding enable_manual:', err.message);
        } else {
            console.log('Added enable_manual column.');
        }
    });
});

db.close(() => {
    console.log('Migration completed.');
});
