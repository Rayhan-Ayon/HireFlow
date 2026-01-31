const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Migrating database: Adding whatsapp_number column...');

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN whatsapp_number TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column whatsapp_number already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Successfully added whatsapp_number column to users table.');
        }
    });
});

db.close();
