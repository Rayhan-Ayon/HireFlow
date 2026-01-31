const db = require('../server/database');

const REAL_EMAIL = 'rayhansarwar95@gmail.com';

db.init().then(() => {
    const database = db.getDb();
    database.run('UPDATE users SET email = ? WHERE id = 1', [REAL_EMAIL], (err) => {
        if (err) {
            console.error('Update failed:', err);
        } else {
            console.log(`SUCCESS: User email updated to ${REAL_EMAIL}. This should fix the filter loop.`);
        }
    });
}).catch(err => {
    console.error('DB Init Error:', err);
});
