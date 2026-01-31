const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(process.cwd(), './database.sqlite');

let db;

const fs = require('fs');

function connect() {
    return new Promise((resolve, reject) => {
        // ALLOW AUTO-CREATION: SQLite will create the file if it doesn't exist

        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Could not connect to database', err);
                reject(err);
            } else {
                console.log(`Connected to SQLite database at: ${dbPath}`);
                // Verify data integrity immediately
                db.get("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='candidates'", (err, row) => {
                    if (!err && row) console.log(`Database Integrity Check: Found candidates table.`);
                });
                resolve(db);
            }
        });
    });
}

function init() {
    return connect().then(() => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Creates Users Table
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    email TEXT UNIQUE,
                    password TEXT,
                    role TEXT,
                    google_id TEXT,
                    google_refresh_token TEXT,
                    microsoft_refresh_token TEXT,
                    microsoft_cache TEXT,
                    zoom_refresh_token TEXT,
                    calendly_auth_token TEXT,
                    calendly_link TEXT,
                    whatsapp_number TEXT,
                    company_name TEXT,
                    company_description TEXT,
                    company_website TEXT,
                    company_logo TEXT,
                    subscription_status TEXT DEFAULT 'inactive',
                    enable_teams BOOLEAN DEFAULT 0,
                    enable_zoom BOOLEAN DEFAULT 0,
                    enable_manual BOOLEAN DEFAULT 1,
                    chatbot_instructions TEXT,
                    smtp_host TEXT,
                    smtp_port TEXT,
                    smtp_user TEXT,
                    smtp_pass TEXT,
                    reset_token TEXT,
                    reset_expiry DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Create Jobs Table
                db.run(`CREATE TABLE IF NOT EXISTS jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    title TEXT,
                    description TEXT,
                    location TEXT,
                    employment_type TEXT,
                    department TEXT,
                    chatbot_instructions TEXT,
                    status TEXT DEFAULT 'draft',
                    republished_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )`, (err) => {
                    if (!err) {
                        // MIGRATION: Ensure columns exist if table was already created
                        const columns = ['location', 'employment_type', 'department', 'chatbot_instructions', 'republished_at'];
                        columns.forEach(col => {
                            db.run(`ALTER TABLE jobs ADD COLUMN ${col} TEXT`, (alterErr) => {
                                // Ignore "duplicate column name" error
                                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                                    console.error(`Migration error adding ${col}:`, alterErr.message);
                                }
                            });
                        });
                    }
                });

                db.run(`CREATE TABLE IF NOT EXISTS candidates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id INTEGER,
                    name TEXT,
                    email TEXT,
                    phone TEXT,
                    linkedin TEXT,
                    resume_text TEXT,
                    chat_transcript TEXT,
                    resume_summary TEXT,
                    resume_filename TEXT,
                    match_score INTEGER,
                    status TEXT DEFAULT 'new',
                    whatsapp_number TEXT,
                    source TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(job_id) REFERENCES jobs(id)
                )`, (err) => {
                    if (!err) {
                        const columns = ['whatsapp_number', 'source'];
                        columns.forEach(col => {
                            db.run(`ALTER TABLE candidates ADD COLUMN ${col} TEXT`, (alterErr) => {
                                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                                    console.error(`Migration error adding ${col} to candidates:`, alterErr.message);
                                }
                            });
                        });

                        // Migration: Update any existing 'applied' status to 'new'
                        db.run("UPDATE candidates SET status = 'new' WHERE status = 'applied' OR status IS NULL", (migErr) => {
                            if (migErr) console.error('Migration error updating candidate statuses:', migErr.message);
                            else console.log('Candidate statuses migrated to "new" successfully');
                        });
                    }
                });

                // Create Interviews Table
                db.run(`CREATE TABLE IF NOT EXISTS interviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER,
                    scheduled_at DATETIME,
                    meeting_link TEXT,
                    meeting_provider TEXT,
                    status TEXT DEFAULT 'scheduled',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(candidate_id) REFERENCES candidates(id)
                )`);

                // Create Notifications Table
                db.run(`CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    type TEXT,
                    title TEXT,
                    message TEXT,
                    link TEXT,
                    is_read BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    });
}

module.exports = {
    init,
    getDb: () => db
};
