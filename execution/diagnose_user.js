const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.get("SELECT * FROM users ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err) {
            console.error(err);
            return;
        }
        if (row) {
            console.log('Latest User:', JSON.stringify(row, null, 2));
        } else {
            console.log('No users found.');
        }
    });
});
