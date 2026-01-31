const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath);

console.log("Running migration: Add chatbot_instructions to jobs...");

db.serialize(() => {
    db.run("ALTER TABLE jobs ADD COLUMN chatbot_instructions TEXT", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'chatbot_instructions' already exists. Skipping.");
            } else {
                console.error("Migration failed:", err.message);
                process.exit(1);
            }
        } else {
            console.log("Column 'chatbot_instructions' added successfully.");
        }
        db.close();
    });
});
