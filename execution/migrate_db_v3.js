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

        const hasResumeFilename = rows.some(r => r.name === 'resume_filename');

        if (!hasResumeFilename) {
            console.log('Adding resume_filename column to candidates table...');
            db.run("ALTER TABLE candidates ADD COLUMN resume_filename TEXT", (err) => {
                if (err) {
                    console.error('Migration failed:', err.message);
                } else {
                    console.log('Migration successful: resume_filename added.');
                }
                process.exit(0);
            });
        } else {
            console.log('resume_filename already exists. No migration needed.');
            process.exit(0);
        }
    });
});
