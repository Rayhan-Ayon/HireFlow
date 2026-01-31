const db = require('../server/database');

db.init().then(() => {
    console.log("Checking jobs...");
    db.getDb().all("SELECT * FROM jobs", [], (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log(JSON.stringify(rows, null, 2));
        }
    });
});
