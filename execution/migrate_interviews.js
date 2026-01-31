const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const createTableSql = `
    CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id INTEGER,
        google_event_id TEXT,
        scheduled_at DATETIME,
        title TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id)
    );
`;

db.serialize(() => {
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating interviews table:', err);
        } else {
            console.log('Interviews table created successfully.');
        }
    });
});

db.close();
