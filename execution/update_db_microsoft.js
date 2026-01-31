const db = require('../server/database');

db.init().then(() => {
    const sql = `ALTER TABLE users ADD COLUMN microsoft_refresh_token TEXT`;

    // We can't use 'IF NOT EXISTS' for ADD COLUMN in SQLite versions older than 3.35.0 (which node-sqlite3 might use)
    // So we try to run it and catch the specific error if the column exists.

    db.getDb().run(sql, function (err) {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column microsoft_refresh_token already exists.');
            } else {
                console.error('Error adding column:', err.message);
                process.exit(1);
            }
        } else {
            console.log('Successfully added microsoft_refresh_token column to users table.');
        }
        process.exit(0);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
