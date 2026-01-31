const db = require('../server/database');
const fs = require('fs');

async function extract() {
    await db.init();
    db.getDb().get('SELECT microsoft_refresh_token FROM users LIMIT 1', (err, row) => {
        if (row && row.microsoft_refresh_token) {
            const data = JSON.parse(row.microsoft_refresh_token);
            fs.writeFileSync('token.txt', data.accessToken);
            console.log('Token saved to token.txt');
        } else {
            console.log('No token found');
        }
    });
}
extract();
