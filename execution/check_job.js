const db = require('../server/database');

db.init().then(() => {
    const database = db.getDb();
    database.get('SELECT * FROM jobs WHERE id = ?', [13], (err, row) => {
        if (err) {
            console.error('Error fetching job:', err);
            return;
        }
        console.log('Job 13:', row);
        if (!row) {
            console.log('Job 13 NOT FOUND in root DB.');
        }
    });
}).catch(err => {
    console.error('Failed to initialize DB:', err);
});
