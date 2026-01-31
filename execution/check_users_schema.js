const db = require('../server/database');

const checkUsers = async () => {
    try {
        db.getDb().all("PRAGMA table_info(users)", [], (err, rows) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log("Users Table Columns:");
            console.table(rows);
        });
    } catch (error) {
        console.error(error);
    }
};

setTimeout(checkUsers, 1000);
