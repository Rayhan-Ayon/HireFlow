const db = require('../server/database');

async function migrate() {
    await db.init();
    db.getDb().run('ALTER TABLE users ADD COLUMN microsoft_cache TEXT', (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column already exists');
            } else {
                console.error('Migration failed:', err);
            }
        } else {
            console.log('Column added successfully');
        }
    });
}

migrate();
