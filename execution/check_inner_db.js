const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../server/database.sqlite');
console.log('Checking DB at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        return;
    }
    console.log('Connected to SQLite database');

    db.all('SELECT * FROM candidates', [], (err, rows) => {
        if (err) {
            console.error('Error fetching candidates:', err);
            return;
        }
        console.log('Candidates count:', rows.length);
        console.log('Candidate IDs:', rows.map(r => r.id));
    });
});
