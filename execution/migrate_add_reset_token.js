const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Adding reset_token columns to users table...");

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN reset_token TEXT", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log("Column reset_token already exists.");
        } else if (err) {
            console.error("Error adding reset_token:", err);
        } else {
            console.log("Added reset_token column.");
        }
    });

    db.run("ALTER TABLE users ADD COLUMN reset_expiry DATETIME", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log("Column reset_expiry already exists.");
        } else if (err) {
            console.error("Error adding reset_expiry:", err);
        } else {
            console.log("Added reset_expiry column.");
        }
    });
});

// Close DB after short delay to ensure operations complete
setTimeout(() => {
    db.close();
}, 1000);
