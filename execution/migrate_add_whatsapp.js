const db = require('../server/database');

async function migrate() {
    await db.init();
    const database = db.getDb();

    console.log("Adding whatsapp_number to candidates table...");

    database.run(`ALTER TABLE candidates ADD COLUMN whatsapp_number TEXT`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log("Column already exists.");
            } else {
                console.error("Error adding column:", err);
            }
        } else {
            console.log("Column added successfully.");
        }
    });

    // Wait a bit before exiting to allow query to finish
    setTimeout(() => process.exit(0), 1000);
}

migrate();
