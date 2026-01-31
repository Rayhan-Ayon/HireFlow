const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Running migration...');

db.serialize(() => {
    db.all("PRAGMA table_info(candidates)", [], (err, rows) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        const hasResumeSummary = rows.some(r => r.name === 'resume_summary');

        if (!hasResumeSummary) {
            console.log('Adding resume_summary column to candidates table...');
            db.run("ALTER TABLE candidates ADD COLUMN resume_summary TEXT", (err) => {
                if (err) {
                    console.error('Migration failed:', err.message);
                } else {
                    console.log('Migration successful: resume_summary added.');
                }
                process.exit(0);
            });
        } else {
            console.log('resume_summary already exists. No migration needed.');
            process.exit(0);
        }
    });
});
