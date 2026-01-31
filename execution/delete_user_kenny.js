const db = require('../server/database');

const USER_ID = 14; // Kenny

setTimeout(() => {
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    const rawDb = new sqlite3.Database(dbPath);

    rawDb.serialize(() => {
        // Try deleting from jobs first
        rawDb.run('DELETE FROM jobs WHERE user_id = ?', [USER_ID], (err) => {
            if (err) console.error("Jobs delete error (ignoring):", err.message);
        });

        // Notifications
        rawDb.run('DELETE FROM notifications WHERE user_id = ?', [USER_ID], (err) => {
            if (err) console.error("Notifications delete error (ignoring):", err.message);
        });

        // Delete User
        rawDb.run('DELETE FROM users WHERE id = ?', [USER_ID], function (err) {
            if (err) console.error(err);
            else console.log(`Deleted User ID ${USER_ID}. Changes: ${this.changes}`);
        });
    });

}, 1000);
