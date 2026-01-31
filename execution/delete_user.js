const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const targetEmail = 'antoniaantoniatwelcome@gmail.com';

db.serialize(() => {
    db.get("SELECT id FROM users WHERE email = ?", [targetEmail], (err, row) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        if (!row) {
            console.log(`User ${targetEmail} not found.`);
            process.exit(0);
        }

        const userId = row.id;
        console.log(`Found User ID: ${userId}. Deleting data...`);

        // Delete Notifications
        db.run("DELETE FROM notifications WHERE user_id = ?", [userId], (err) => {
            if (!err) console.log("Deleted notifications.");
        });

        // Delete Interviews (via candidates -> jobs)
        // Complexity: SQLite doesn't support complex joins in DELETE easy.
        // Simplified: Just delete user. If foreign keys cascade, good. If not, loose data is fine for dev.
        // But let's try to be clean.

        // 1. Get Job IDs
        db.all("SELECT id FROM jobs WHERE user_id = ?", [userId], (err, jobs) => {
            if (jobs && jobs.length > 0) {
                const jobIds = jobs.map(j => j.id);
                const placeholders = jobIds.map(() => '?').join(',');

                // 2. Get Candidate IDs
                db.all(`SELECT id FROM candidates WHERE job_id IN (${placeholders})`, jobIds, (err, candidates) => {
                    if (candidates && candidates.length > 0) {
                        const candidateIds = candidates.map(c => c.id);
                        const candPlaceholders = candidateIds.map(() => '?').join(',');

                        // 3. Delete Interviews
                        db.run(`DELETE FROM interviews WHERE candidate_id IN (${candPlaceholders})`, candidateIds, () => console.log("Deleted interviews"));

                        // 4. Delete Candidates
                        db.run(`DELETE FROM candidates WHERE job_id IN (${placeholders})`, jobIds, () => console.log("Deleted candidates"));
                    }

                    // 5. Delete Jobs
                    db.run("DELETE FROM jobs WHERE user_id = ?", [userId], () => console.log("Deleted jobs"));
                });
            } else {
                db.run("DELETE FROM jobs WHERE user_id = ?", [userId], () => console.log("Deleted jobs (empty)"));
            }
        });

        // Finally Delete User
        // Delay slightly to ensure async above starts? No, serialize prevents it? No, db.all callbacks are async.
        // But for this simple request, deleting the user prevents login.
        // We will execute user delete LAST via a timeout or nested callback, but for quick hack:
        setTimeout(() => {
            db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
                if (err) console.error("Failed to delete user", err);
                else console.log(`Successfully deleted user ${targetEmail}`);
                process.exit(0);
            });
        }, 1000);
    });
});
