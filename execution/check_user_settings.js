const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.get('SELECT enable_zoom, zoom_refresh_token, enable_manual, enable_teams FROM users WHERE id = 1', (err, row) => {
    if (err) console.error(err);
    else console.log('User Settings:', row);
});
