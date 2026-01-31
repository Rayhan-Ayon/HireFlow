const db = require('../server/database');

async function diag() {
    await db.init();
    db.getDb().get('SELECT microsoft_refresh_token, microsoft_cache FROM users LIMIT 1', (err, row) => {
        if (err) {
            console.error('Diag Error:', err);
        } else {
            console.log('--- DB TOKEN DIAGNOSTIC ---');
            console.log('Microsoft Connected:', !!row.microsoft_refresh_token);
            console.log('Cache Populated:', !!row.microsoft_cache);
            if (row.microsoft_cache) {
                console.log('Cache Size:', row.microsoft_cache.length);
            }
            console.log('---------------------------');
        }
        process.exit(0);
    });
}

diag();
