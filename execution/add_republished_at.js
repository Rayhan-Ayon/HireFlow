const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Running migration: Adding republished_at to jobs...');

    db.run(`ALTER TABLE jobs ADD COLUMN republished_at DATETIME`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column republished_at already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Column republished_at added successfully.');
        }
    });
});

db.close();
