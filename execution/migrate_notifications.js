const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Migrating DB: Adding notifications table...');

db.serialize(() => {
    // 1. Create table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT, -- 'job', 'application', 'system'
        title TEXT,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Failed to create table:', err);
        else console.log('✅ Created notifications table or it exists.');
    });

    // 2. Insert dummy notification
    db.run(`INSERT INTO notifications (user_id, type, title, message, link) 
            VALUES (1, 'system', 'Welcome', 'Notification system initialized.', '/settings')`, (err) => {
        if (!err) console.log('✅ Dummy notification inserted.');
    });
});
