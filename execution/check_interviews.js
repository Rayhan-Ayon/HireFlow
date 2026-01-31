const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT id, title, scheduled_at, meeting_link FROM interviews ORDER BY id DESC LIMIT 5", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log('Recent Interviews:');
            console.table(rows);
        }
    });
});

db.close();
