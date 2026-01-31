const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const columnsToAdd = [
    { name: 'company_name', type: 'TEXT' },
    { name: 'company_description', type: 'TEXT' },
    { name: 'company_website', type: 'TEXT' },
    { name: 'company_logo', type: 'TEXT' }
];

db.serialize(() => {
    columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column ${col.name} already exists.`);
                } else {
                    console.error(`Error adding column ${col.name}:`, err);
                }
            } else {
                console.log(`Added column ${col.name}`);
            }
        });
    });
});

db.close();
