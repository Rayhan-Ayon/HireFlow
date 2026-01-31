const db = require('../server/database');

db.init().then(() => {
    const database = db.getDb();
    const sql = `
        SELECT c.*, j.title as job_title 
        FROM candidates c 
        LEFT JOIN jobs j ON c.job_id = j.id 
        WHERE c.id = ?
    `;
    database.get(sql, [15], (err, row) => {
        if (err) {
            console.error('Error fetching candidate:', err);
            return;
        }
        console.log('Candidate 15:', row);
        if (!row) {
            console.log('Candidate 15 NOT FOUND with exact query.');
        }
    });
}).catch(err => {
    console.error('Failed to initialize DB:', err);
});
