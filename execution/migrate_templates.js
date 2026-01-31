const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath);

console.log("Running migration: Create and seed templates table...");

db.serialize(() => {
    // Create Table
    db.run(`CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT CHECK(category IN ('invite', 'availability', 'rejection', 'hiring', 'custom')),
        is_enabled INTEGER DEFAULT 1,
        is_prebuilt INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error("Failed to create templates table:", err.message);
            process.exit(1);
        }
        console.log("Templates table ready.");

        // Check if seeded
        db.get("SELECT COUNT(*) as count FROM templates WHERE is_prebuilt = 1", (err, row) => {
            if (row && row.count === 0) {
                console.log("Seeding prebuilt templates...");
                const templates = [
                    {
                        name: "Interview Invite",
                        category: "invite",
                        subject: "Interview Invitation: {{job_title}} at {{company_name}}",
                        content: "Hi {{candidate_name}},\n\nWe were very impressed by your background and would like to invite you to an interview for the {{job_title}} position.\n\nPlease let us know if you are available for a brief conversation this week.\n\nBest regards,\n{{user_name}}\n{{company_name}}"
                    },
                    {
                        name: "Availability Request",
                        category: "availability",
                        subject: "Availability Check: {{job_title}}",
                        content: "Hi {{candidate_name}},\n\nI hope you're having a great week! We're currently coordinating interviews for the {{job_title}} role and would love to find a time that works for you.\n\nCould you please share a few time slots when you'd be available for a 30-minute call?\n\nThanks,\n{{user_name}}"
                    },
                    {
                        name: "Candidate Rejection",
                        category: "rejection",
                        subject: "Update regarding your application for {{job_title}}",
                        content: "Hi {{candidate_name}},\n\nThank you for giving us the opportunity to review your application for the {{job_title}} position. \n\nAt this time, we have decided to move forward with other candidates whose experience more closely aligns with our current needs. We appreciate your interest in {{company_name}} and wish you the best in your job search.\n\nBest,\n{{company_name}} Team"
                    },
                    {
                        name: "Job Offer / Hiring",
                        category: "hiring",
                        subject: "Job Offer: {{job_title}} at {{company_name}}",
                        content: "Dear {{candidate_name}},\n\nWe are absolutely thrilled to offer you the position of {{job_title}} at {{company_name}}! \n\nWe were all very impressed with your skills and believe you'll be a fantastic addition to our team. We've attached the formal offer letter with the details of your compensation and benefits.\n\nPlease review and let us know your decision by the end of the week. We look forward to having you on board!\n\nCheers,\n{{user_name}}"
                    }
                ];

                const stmt = db.prepare("INSERT INTO templates (name, category, subject, content, is_prebuilt) VALUES (?, ?, ?, ?, 1)");
                templates.forEach(t => stmt.run(t.name, t.category, t.subject, t.content));
                stmt.finalize();
                console.log("Prebuilt templates seeded successfully.");
            } else {
                console.log("Templates already seeded.");
            }
            db.close();
        });
    });
});
