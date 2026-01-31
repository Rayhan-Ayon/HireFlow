const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking SMTP Configuration...');

db.get('SELECT smtp_host, smtp_port, smtp_user, smtp_pass FROM users WHERE id = 1', async (err, row) => {
    if (err) {
        console.error('DB Error:', err);
        process.exit(1);
    }

    if (!row || !row.smtp_host || !row.smtp_pass) {
        console.error('SMTP settings not found in DB.');
        process.exit(1);
    }

    console.log(`Config: ${row.smtp_host}:${row.smtp_port} (${row.smtp_user})`);

    const transporter = nodemailer.createTransport({
        host: row.smtp_host,
        port: row.smtp_port || 587,
        secure: row.smtp_port === 465,
        auth: {
            user: row.smtp_user,
            pass: row.smtp_pass
        }
    });

    try {
        await transporter.verify();
        console.log('✅ SMTP Connection verified successfully!');

        // Optional: Send a test email to self?
        // await transporter.sendMail({ from: row.smtp_user, to: row.smtp_user, subject: 'Test', text: 'It works.' });
        // console.log('Test email sent.');
    } catch (error) {
        console.error('❌ SMTP Connection Failed:', error.message);
        console.log('Hint: Check if App Password is correct or if 2-Step Verification is on.');
    }
});
