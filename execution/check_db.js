const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT * FROM jobs", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Jobs:", rows);
        }
    });
});

db.close();
