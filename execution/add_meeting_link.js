const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Adding meeting_link column to interviews table...');
    db.run("ALTER TABLE interviews ADD COLUMN meeting_link TEXT", (err) => {
        if (err) {
            // Ignore error if column already exists
            if (err.message.includes('duplicate column name')) {
                console.log('Column meeting_link already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Column meeting_link added successfully.');
        }
    });
});

db.close();
