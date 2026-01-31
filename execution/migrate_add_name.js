const db = require('../server/database');

db.init().then(() => {
    const database = db.getDb();

    // Add 'name' column
    database.run('ALTER TABLE users ADD COLUMN name TEXT', (err) => {
        if (err) {
            console.log('Column name might already exist or error:', err.message);
        } else {
            console.log('SUCCESS: Added name column');
        }
    });

    // Add 'role' column just in case
    database.run('ALTER TABLE users ADD COLUMN role TEXT', (err) => {
        if (err) {
            console.log('Column role might already exist or error:', err.message);
        } else {
            console.log('SUCCESS: Added role column');
        }
    });

}).catch(err => {
    console.error('DB Init Error:', err);
});
