const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../server/database.sqlite');
const db = new sqlite3.Database(dbPath);

const migrate = () => {
    db.serialize(() => {
        // Add 'name' column
        db.run("ALTER TABLE users ADD COLUMN name TEXT", (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error("Error adding name column:", err.message);
            } else {
                console.log("Added 'name' column or already exists.");
            }
        });

        // Add 'role' column
        db.run("ALTER TABLE users ADD COLUMN role TEXT", (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error("Error adding role column:", err.message);
            } else {
                console.log("Added 'role' column or already exists.");
            }
        });
    });
};

migrate();
// Close after a short delay to ensure query executes
setTimeout(() => db.close(), 1000);
