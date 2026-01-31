const db = require('../server/database');
db.init().then(() => {
    db.getDb().get('SELECT * FROM users LIMIT 1', (err, row) => {
        if (err) console.error(err);
        else console.log('User Row:', JSON.stringify(row, null, 2));
    });
});
