const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    const columns = [
        "ALTER TABLE users ADD COLUMN smtp_host TEXT",
        "ALTER TABLE users ADD COLUMN smtp_port INTEGER",
        "ALTER TABLE users ADD COLUMN smtp_user TEXT",
        "ALTER TABLE users ADD COLUMN smtp_pass TEXT"
    ];

    columns.forEach(sql => {
        db.run(sql, (err) => {
            if (err && err.message.includes('duplicate column')) {
                // Ignore
            } else if (err) {
                console.error('Error:', err.message);
            } else {
                console.log('Executed:', sql);
            }
        });
    });
});

db.close();
