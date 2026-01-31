const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    const sql = `
        SELECT j.*, COUNT(c.id) as applicant_count 
        FROM jobs j 
        LEFT JOIN candidates c ON j.id = c.job_id 
        GROUP BY j.id 
        ORDER BY j.created_at DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('DB Error:', err);
        } else {
            console.log('Jobs Found:', rows.length);
            if (rows.length > 0) {
                console.log('Sample Job:', JSON.stringify(rows[0], null, 2));
            }
        }
        db.close();
    });
});
