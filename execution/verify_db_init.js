const db = require('../server/database.js');
const fs = require('fs');

console.log('--- Starting DB Init Verification ---');
const start = Date.now();

db.init()
    .then(() => {
        const duration = Date.now() - start;
        console.log(`DB Init Success! Took ${duration}ms`);
        // Check a simple query
        db.getDb().get('SELECT count(*) as count FROM users', (err, row) => {
            if (err) console.error('Query Failed:', err);
            else console.log('User Count:', row.count);
            process.exit(0);
        });
    })
    .catch(err => {
        console.error('DB Init Failed:', err);
        process.exit(1);
    });
