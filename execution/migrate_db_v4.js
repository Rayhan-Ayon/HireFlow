const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Migrating database: Adding google_refresh_token column...');

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN google_refresh_token TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column google_refresh_token already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Successfully added google_refresh_token column to users table.');
        }
    });
});

db.close();
