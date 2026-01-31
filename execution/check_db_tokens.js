const db = require('../server/database');

// Wait for init
setTimeout(() => {
    // Db inits on require? No, usually explicitly. 
    // Checking server/index.js... it calls db.initDb().
    // Checking server/database.js...
    // I'll try calling initDb or just use getDb if it's a singleton already init.
    // If it's sqlite3, it needs open.

    // Attempt to access directly assuming standard sqlite3 wrapper
    try {
        if (!db.getDb()) {
            // Try valid init method if exists, or just use sqlite3 directly
            const sqlite3 = require('sqlite3').verbose();
            const path = require('path');
            const dbPath = path.resolve(__dirname, '../database.sqlite');
            const rawDb = new sqlite3.Database(dbPath);

            rawDb.all('SELECT id, email, name, google_refresh_token, microsoft_refresh_token FROM users', [], (err, rows) => {
                if (err) console.error(err);
                else console.log('Users:', JSON.stringify(rows, null, 2));
            });
        } else {
            db.getDb().all('SELECT id, email, name, google_refresh_token, microsoft_refresh_token FROM users', [], (err, rows) => {
                if (err) console.error(err);
                else console.log('Users:', JSON.stringify(rows, null, 2));
            });
        }
    } catch (e) {
        console.error("Wrapper failed, trying raw:", e.message);
        const sqlite3 = require('sqlite3').verbose();
        const path = require('path');
        const dbPath = path.resolve(__dirname, '../database.sqlite');
        const rawDb = new sqlite3.Database(dbPath);

        rawDb.all('SELECT id, email, name, google_refresh_token, microsoft_refresh_token FROM users', [], (err, rows) => {
            if (err) console.error(err);
            else console.log('Users:', JSON.stringify(rows, null, 2));
        });
    }

}, 1000);
