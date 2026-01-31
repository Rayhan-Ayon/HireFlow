const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Running migration...');

db.serialize(() => {
    // Check if column exists first to avoid double-adding
    db.all("PRAGMA table_info(candidates)", [], (err, rows) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        const hasChatTranscript = rows.some(r => r.name === 'chat_transcript');

        if (!hasChatTranscript) {
            console.log('Adding chat_transcript column to candidates table...');
            db.run("ALTER TABLE candidates ADD COLUMN chat_transcript TEXT", (err) => {
                if (err) {
                    console.error('Migration failed:', err.message);
                } else {
                    console.log('Migration successful: chat_transcript added.');
                }
                process.exit(0);
            });
        } else {
            console.log('chat_transcript already exists. No migration needed.');
            process.exit(0);
        }
    });
});
