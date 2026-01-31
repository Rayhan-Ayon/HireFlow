const db = require('../server/database');

db.init().then(() => {
    const database = db.getDb();
    // Clear Google tokens
    database.run('UPDATE users SET google_refresh_token = NULL', (err) => {
        if (err) {
            console.error('Failed to clear tokens:', err);
        } else {
            console.log('SUCCESS: All Google tokens cleared from DB.');
        }
    });
}).catch(err => {
    console.error('DB Init Error:', err);
});
