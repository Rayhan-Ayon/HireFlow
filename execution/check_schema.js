const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('Columns:', rows.map(r => r.name));
    process.exit(0);
});
