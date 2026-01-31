const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
});

db.all(`SELECT id, email, google_refresh_token, 
        CASE WHEN google_refresh_token IS NOT NULL THEN 'HAS_TOKEN' ELSE 'NO_TOKEN' END as status 
        FROM users`, [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.log("Users in DB:", rows);
});

db.close();
