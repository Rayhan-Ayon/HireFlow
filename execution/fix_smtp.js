const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Fixing SMTP in:', dbPath);

db.serialize(() => {
    // 1. Get Email
    db.get('SELECT email FROM users WHERE id=1', (err, row) => {
        if (err) {
            console.error('Error fetching user:', err);
            return;
        }
        if (!row) {
            console.error('No user found with id=1');
            return;
        }
        const email = row.email;
        console.log('Found user email:', email);

        // 2. Update SMTP
        const sql = `UPDATE users SET 
            smtp_host = ?, 
            smtp_port = ?, 
            smtp_user = ?, 
            smtp_pass = ? 
            WHERE id = 1`;

        // Strip spaces from password: 'sthd zcsk nkyo tvmi' -> 'sthdzcsknkyotvmi'
        db.run(sql, ['smtp.gmail.com', 587, 'rayhanayon75@gmail.com', 'sthdzcsknkyotvmi'], function (updateErr) {
            if (updateErr) {
                console.error('Update failed:', updateErr);
            } else {
                console.log(`Updated Credentials. Changes: ${this.changes}`);
            }
        });
    });
});
