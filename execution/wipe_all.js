const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("WIPING ALL USERS AND DATA...");

db.serialize(() => {
    // Disable Foreign Keys? No, just delete children first.

    // 1. Delete Interviews
    db.run("DELETE FROM interviews", () => console.log("Deleted ALL interviews"));

    // 2. Delete Candidates
    db.run("DELETE FROM candidates", () => console.log("Deleted ALL candidates"));

    // 3. Delete Jobs
    db.run("DELETE FROM jobs", () => console.log("Deleted ALL jobs"));

    // 4. Delete Notifications
    db.run("DELETE FROM notifications", () => console.log("Deleted ALL notifications"));

    // 5. Delete Users
    db.run("DELETE FROM users", (err) => {
        if (err) console.error("Error deleting users:", err);
        else console.log("Deleted ALL users.");
        process.exit(0);
    });
});
