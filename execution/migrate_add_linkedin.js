const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
});

db.serialize(() => {
    db.run("ALTER TABLE candidates ADD COLUMN linkedin TEXT", (err) => {
        if (err) {
            // Ignore error if column already exists (common in SQLite if run multiple times without checking)
            if (err.message.includes('duplicate column name')) {
                console.log('Column "linkedin" already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Successfully added "linkedin" column to candidates table.');
        }
    });
});

db.close();
