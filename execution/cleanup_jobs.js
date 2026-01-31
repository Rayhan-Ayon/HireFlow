const db = require('../server/database');

db.init().then(() => {
    console.log("Cleaning up invalid jobs...");
    db.getDb().run("DELETE FROM jobs WHERE title IS NULL", [], function (err) {
        if (err) console.error(err);
        else console.log(`Deleted ${this.changes} invalid jobs.`);
    });
});
