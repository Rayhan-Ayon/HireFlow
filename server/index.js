require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

// GLOBAL CRASH HANDLER
function logCrash(type, err) {
    const msg = `[${new Date().toISOString()}] ${type}: ${err.message}\n${err.stack}\n`;
    try {
        fs.appendFileSync(path.join(__dirname, '../crash_report.txt'), msg);
        console.error(msg);
    } catch (e) {
        console.error('Failed to write crash log', e);
    }
}
process.on('uncaughtException', (err) => {
    logCrash('UNCAUGHT EXCEPTION', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logCrash('UNHANDLED REJECTION', reason instanceof Error ? reason : new Error(String(reason)));
});

const cors = require('cors');
const db = require('./database');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve React App in Production (Prioritized)
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
    console.log('[Static] Serving from client/dist');
    app.use(express.static(clientDist));
}

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const { getNextChatMessage } = require('../execution/ai_chat');
const authProvider = require('./auth_provider');
const zoomService = require('./zoom_service');
const microsoftService = require('./microsoft_service');
const calendlyService = require('./calendly');

// Helper: Create Notification
const createNotification = (userId, type, title, message, link) => {
    const sql = 'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)';
    db.getDb().run(sql, [userId, type, title, message, link], (err) => {
        if (err) console.error('Failed to create notification:', err.message);
        else console.log(`[Notification] Created: ${title}`);
    });
};

// Start Calendly Poller (DISABLED)
// calendlyService.startService(db.getDb());

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this';

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || 'ethereal_user', // Generate Ethereal credentials if needed
        pass: process.env.SMTP_PASS || 'ethereal_pass'
    }
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

authProvider.registerService('microsoft', microsoftService);

// Middleware: Authenticate Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        next();
    });
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    const { name, company_name, company_website, role, email, password } = req.body;

    if (!email || !password || !name) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `INSERT INTO users (name, company_name, company_website, role, email, password) VALUES (?, ?, ?, ?, ?, ?)`;
        db.getDb().run(sql, [name, company_name, company_website, role, email, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }

            const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '24h' });
            res.status(201).json({ token, user: { id: this.lastID, name, email, role, company_name } });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.getDb().get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        if (user.password) {
            // Password Auth
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        } else {
            // Only Social Auth exists? Allow login if password empty? No.
            return res.status(401).json({ error: 'Please login with Google/Microsoft' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, company_name: user.company_name } });
    });
});


app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    db.getDb().get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Generate Token
        const token = require('crypto').randomBytes(20).toString('hex');
        const expiry = Date.now() + 3600000; // 1 Hour

        db.getDb().run('UPDATE users SET reset_token = ?, reset_expiry = ? WHERE id = ?', [token, expiry, user.id], async (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save token' });

            const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

            try {
                // Send Email
                const info = await transporter.sendMail({
                    from: '"HireFlow Support" <support@hireflow.ai>',
                    to: email,
                    subject: 'Password Reset Request',
                    html: `
                        <p>You requested a password reset.</p>
                        <p>Click this link to reset your password:</p>
                        <a href="${resetLink}">${resetLink}</a>
                        <p>This link expires in 1 hour.</p>
                    `
                });
                console.log('Reset Email Sent: %s', info.messageId);
                if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
                    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
                }
                res.json({ message: 'Reset email sent' });
            } catch (mailErr) {
                console.error('Mail Error:', mailErr);
                res.status(500).json({ error: 'Failed to send email' });
            }
        });
    });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and Password required' });

    db.getDb().get('SELECT * FROM users WHERE reset_token = ?', [token], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

        if (user.reset_expiry < Date.now()) {
            return res.status(400).json({ error: 'Token expired' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.getDb().run('UPDATE users SET password = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?', [hashedPassword, user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to update password' });
            res.json({ message: 'Password updated successfully' });
        });
    });
});


app.post('/api/chat', async (req, res) => {
    const { job_id, history, message } = req.body;

    if (!job_id) return res.status(400).json({ error: 'Job ID is required' });

    try {
        // Get JD and Company Profile for context
        // Fetching the first user's profile for now (MVP simplification)
        const sql = `
            SELECT j.description, j.chatbot_instructions, u.company_name, u.company_description, u.name 
            FROM jobs j 
            LEFT JOIN users u ON j.user_id = u.id OR u.id = (SELECT id FROM users LIMIT 1) 
            WHERE j.id = ?
        `;

        db.getDb().get(sql, [job_id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Job context not found' });

            const companyProfile = {
                name: row.company_name,
                description: row.company_description,
                recruiterName: row.name ? row.name.split(' ')[0] : 'Recruiter'
            };

            // FIX: Append the latest user message to history if provided separately
            const fullHistory = history || [];
            console.log(`[DEBUG] History from Client: ${history?.length || 0}`);
            if (message) {
                console.log(`[DEBUG] Appending new message: "${message}"`);
                fullHistory.push({ role: 'user', parts: [{ text: message }] });
            }
            console.log(`[DEBUG] Full History to AI: ${fullHistory.length}`);

            const aiResponse = await getNextChatMessage(row.description, fullHistory, companyProfile, row.chatbot_instructions);
            res.json(aiResponse);
        });
    } catch (error) {
        res.status(500).json({ error: 'Chat failed' });
    }
});

const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${FRONTEND_URL}` // Redirect to frontend first, which will call backend
);



// OAuth Routes
app.get('/api/auth/google', (req, res) => {
    // Added gmail.send scope
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email', // REQUIRED for Login
        'https://www.googleapis.com/auth/userinfo.profile', // REQUIRED for Login name
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly' // REQUIRED for Mailbox
    ];

    // Pass state (login or settings)
    const state = req.query.state || 'settings'; // Default to settings for backward compat

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for refresh token
        scope: scopes,
        prompt: 'consent', // Force consent prompt to ensure we get refresh token
        state: state
    });
    res.json({ url });
});

app.post('/api/auth/google/callback', async (req, res) => {
    const { code, state, signupData } = req.body; // Expect state & signupData from frontend
    console.log('[DEBUG] Google Callback Received:', { state, hasSignupData: !!signupData, signupData });
    const fs = require('fs');
    const logFile = path.resolve(__dirname, '../debug_oauth.txt');
    const log = (msg) => fs.appendFileSync(logFile, new Date().toISOString() + ': ' + msg + '\n');

    try {
        log(`Callback received. Code length: ${code ? code.length : 'N/A'}, State: ${state}`);
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens); // Set globally for this request scope (careful in concurrent, but fine for now as we just use it immediately)

        log(`Tokens received. Scopes: ${tokens.scope}`);

        // Handle LOGIN/SIGNUP Flow
        if (state === 'login') {
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            const { email, name, picture } = userInfo.data;

            log(`Login Flow: Email=${email}`);

            db.getDb().get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
                if (err) throw err;

                if (user) {
                    // Update tokens if they provided new ones
                    if (tokens.refresh_token) {
                        db.getDb().run('UPDATE users SET google_refresh_token = ? WHERE id = ?', [tokens.refresh_token, user.id]);
                    }

                    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
                    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
                } else {
                    // Create User
                    const sql = `INSERT INTO users (name, email, company_name, role, company_website, google_refresh_token, company_logo) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    // Use signupData if available, othewise defaults
                    const companyName = (signupData && signupData.company_name) ? signupData.company_name : (name + "'s Company");
                    const role = (signupData && signupData.role) ? signupData.role : 'Recruiter';
                    const website = (signupData && signupData.company_website) ? signupData.company_website : '';

                    db.getDb().run(sql, [name, email, companyName, role, website, tokens.refresh_token, picture], function (err) {
                        if (err) {
                            console.error('Create User Error:', err);
                            return res.status(500).json({ error: 'Failed to create user' });
                        }
                        const newId = this.lastID;
                        const token = jwt.sign({ id: newId, email }, JWT_SECRET, { expiresIn: '24h' });
                        return res.json({ token, user: { id: newId, name, email, role, company_name: companyName } });
                    });
                }
            });
            return; // Async handled above
        }

        // Handle SETTINGS Flow (Connect Calendar)
        // Ensure user is logged in? The frontend calls this. 
        // We really should use req.user.id but for MVP we might have issues if token not passed?
        // But Settings.jsx calls this. If authenticated, we should have Auth header?
        // Wait, Settings.jsx uses `fetch` but did I add Auth Header to IT?
        // I checked Settings.jsx lines ~106. No Auth Header added to callback fetch yet.
        // It relies on finding the user... how? 
        // Previously it was hardcoded validation: `WHERE id = (SELECT id FROM users LIMIT 1)`.
        // I MUST fix this to use the currently logged in user if possible, OR use the email from the token to match the user.

        // Safer: Use Email to find user to update.
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const { email } = userInfo.data;

        log(`Settings Flow: Matching email ${email}`);

        // Match by JWT if available (Settings Flow)
        let userId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const tokenStr = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(tokenStr, JWT_SECRET);
                userId = decoded.id;
                log(`Authenticated User ID: ${userId}`);
            } catch (e) {
                log('Invalid Token in Callback');
            }
        }

        if (tokens.refresh_token) {
            // Update logic: Prefer User ID, fallback to Email
            let sql, params;
            if (userId) {
                sql = 'UPDATE users SET google_refresh_token = ?, microsoft_refresh_token = NULL, microsoft_cache = NULL WHERE id = ?';
                params = [tokens.refresh_token, userId];
            } else {
                sql = 'UPDATE users SET google_refresh_token = ?, microsoft_refresh_token = NULL, microsoft_cache = NULL WHERE email = ?';
                params = [tokens.refresh_token, email];
            }

            db.getDb().run(sql, params, function (err) {
                if (err) log(`DB UPDATE ERROR: ${err.message}`);
                else if (this.changes === 0) log("WARNING: Email mismatch or user not found during connect.");
                else log("DB UPDATE SUCCESS (G-Active)");

                res.json({ success: true, tokens });
            }
            );
        } else {
            // Even if no refresh token (re-auth without consent?), if we have userId, we might assume existing token is valid?
            // But usually we want to warn. With prompt='consent', this shouldn't happen unless revoked.
            log("WARNING: No refresh token received.");
            res.json({ success: true });
        }

    } catch (error) {
        log(`AUTH ERROR: ${error.message}`);
        console.error('Auth error', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});


app.post('/api/auth/google/disconnect', async (req, res) => {
    try {
        db.getDb().run(
            'UPDATE users SET google_refresh_token = NULL WHERE id = (SELECT id FROM users LIMIT 1)',
            (err) => {
                if (err) return res.status(500).json({ error: 'DB Error' });
                res.json({ success: true });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

// Microsoft Auth Routes
app.get('/api/auth/microsoft', async (req, res) => {
    try {
        let state = '';
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const tokenStr = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(tokenStr, JWT_SECRET);
                state = decoded.id.toString(); // Pass UserID as state
            } catch (e) {
                console.warn('MS Auth: Invalid Token for state');
            }
        }
        const url = await microsoftService.getAuthUrl(state);
        res.json({ url });
    } catch (error) {
        console.error('Microsoft Auth URL Error:', error);
        res.status(500).json({ error: 'Failed to generate Microsoft auth URL. Check server logs.' });
    }
});

app.get('/api/auth/microsoft/callback', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state; // User ID
    try {
        if (!code) throw new Error('No code provided');

        const response = await microsoftService.getTokenFromCode(code);

        // Save to DB and clear Google
        let sql = 'UPDATE users SET microsoft_refresh_token = ?, google_refresh_token = NULL WHERE id = (SELECT id FROM users LIMIT 1)';
        let params = [JSON.stringify(response)];

        if (state) {
            sql = 'UPDATE users SET microsoft_refresh_token = ?, google_refresh_token = NULL WHERE id = ?';
            params = [JSON.stringify(response), state];
        }

        db.getDb().run(sql, params, (err) => {
            if (err) console.error('DB MS Update Error:', err);
            // Redirect back to frontend settings
            res.redirect(`${FRONTEND_URL}/settings?auth=microsoft_success`);
        }
        );
    } catch (error) {
        console.error('Microsoft Callback Error:', error);
        res.redirect(`${FRONTEND_URL}/settings?auth=error`);
    }
});

app.post('/api/auth/microsoft/disconnect', async (req, res) => {
    try {
        db.getDb().run(
            'UPDATE users SET microsoft_refresh_token = NULL, microsoft_cache = NULL WHERE id = (SELECT id FROM users LIMIT 1)',
            (err) => {
                if (err) return res.status(500).json({ error: 'DB Error' });
                res.json({ success: true });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Disconnect failed' });
    }
});



app.get('/api/calendar/events', async (req, res) => {
    try {
        // Get token from DB
        db.getDb().get('SELECT google_refresh_token, microsoft_refresh_token FROM users LIMIT 1', async (err, row) => {
            if (err || !row || (!row.google_refresh_token && !row.microsoft_refresh_token)) {
                return res.status(401).json({ error: 'Not connected' });
            }

            if (row.microsoft_refresh_token) {
                try {
                    const events = await authProvider.getService('microsoft').listEvents(row);
                    return res.json(events);
                } catch (msErr) {
                    console.error('Microsoft Calendar Error:', msErr);
                    return res.status(500).json({ error: 'Failed to fetch Microsoft events' });
                }
            }

            // Google Fallback
            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                maxResults: 10,
                singleEvents: true,
                orderBy: 'startTime',
            });

            res.json(response.data.items);
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// POST /api/calendar/events - Create a new event
app.post('/api/calendar/events', async (req, res) => {
    let { summary, description, startTime, endTime, candidateEmail, candidateId, meetingProvider, meetingLink: customMeetingLink } = req.body;

    if (!startTime || !endTime) {
        return res.status(400).json({ error: 'Start and End time are required' });
    }

    try {
        // Get token from DB
        db.getDb().get('SELECT google_refresh_token, microsoft_refresh_token, zoom_refresh_token FROM users LIMIT 1', async (err, row) => {
            if (err || !row || (!row.google_refresh_token && !row.microsoft_refresh_token)) {
                return res.status(401).json({ error: 'Not connected to Calendar' });
            }

            let responseData;
            let meetingLink = null;
            let finalMeetingLink = customMeetingLink;

            // Handle Zoom Generation First
            if (meetingProvider === 'zoom' && row.zoom_refresh_token) {
                try {
                    const zoomMeeting = await zoomService.createMeeting(row, { summary, description, startTime });
                    finalMeetingLink = zoomMeeting.joinUrl;

                    // Add Zoom details to description
                    description = (description || '') + `\n\nZoom Meeting: ${finalMeetingLink}`;
                    if (zoomMeeting.password) description += `\nPasscode: ${zoomMeeting.password}`;
                } catch (zoomErr) {
                    console.error('Zoom Create Error:', zoomErr.message);
                    return res.status(500).json({ error: 'Failed to create Zoom meeting: ' + zoomErr.message });
                }
            } else if (meetingProvider === 'zoom' && !row.zoom_refresh_token && !customMeetingLink) {
                // User chose Zoom but isn't connected and didn't provide a manual link?
                // For now, proceed, but it might be missing a link. Frontend should prevent this.
            }

            if (row.microsoft_refresh_token) {
                try {
                    const result = await authProvider.getService('microsoft').createEvent(row, {
                        summary, description, startTime, endTime, candidateEmail, meetingProvider, meetingLink: finalMeetingLink
                    });
                    responseData = result;
                    meetingLink = result.hangoutLink || finalMeetingLink || result.htmlLink;
                } catch (msErr) {
                    console.error('Microsoft Calendar Create Error (Non-fatal):', msErr.message);
                    // Fallback to Zoom link if Microsoft fails
                    meetingLink = finalMeetingLink;
                    // Mock response to ensure DB insertion and client response
                    responseData = { id: 'ms-failed-fallback', eventId: 'ms-failed-fallback' };
                }
            } else {
                // Google
                oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

                const event = {
                    summary: summary || 'Interview',
                    description: description || 'Interview scheduled via HireFlow',
                    start: { dateTime: startTime },
                    end: { dateTime: endTime },
                    attendees: candidateEmail ? [{ email: candidateEmail }] : [],
                };

                // Add meeting link to description if manual OR Zoom
                // Note: If Zoom was generated above, it's already in 'description' AND 'finalMeetingLink'
                const isManualOrZoom = meetingProvider === 'zoom' || meetingProvider === 'manual' || meetingProvider === 'teams';

                if (isManualOrZoom && finalMeetingLink) {
                    // Description update handled above for Zoom, or here for manual if not done
                    if (meetingProvider !== 'zoom') { // Zoom details added above
                        event.description = (event.description || '') + `\n\nJoin Meeting: ${finalMeetingLink}`;
                    }
                    event.location = finalMeetingLink; // Set location
                } else {
                    event.conferenceData = {
                        createRequest: { requestId: Date.now().toString(), conferenceSolutionKey: { type: "hangoutsMeet" } },
                    };
                }

                const gRes = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                    conferenceDataVersion: 1, // Required for creating Meet links
                    sendUpdates: 'all', // Send emails to attendees
                });
                responseData = gRes.data;
                meetingLink = gRes.data.hangoutLink || finalMeetingLink || gRes.data.htmlLink;
            }

            // Save to local interviews table
            if (responseData && (responseData.id || responseData.eventId)) {
                const sql = `INSERT INTO interviews (candidate_id, google_event_id, scheduled_at, title, meeting_link, notes) VALUES (?, ?, ?, ?, ?, ?)`;
                const notes = '';

                db.getDb().run(sql, [candidateId || null, responseData.id, startTime, summary, meetingLink, notes], function (err) {
                    if (err) console.error('Failed to save interview to DB:', err);
                    else console.log('Interview saved to DB, ID:', this.lastID);
                });
            }

            res.json(responseData);
        });
    } catch (error) {
        console.error('Calendar create error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Gmail / Mail Integration
// POST /api/gmail/send - Send an email
app.post('/api/gmail/send', async (req, res) => {
    const { to, subject, message, candidateId } = req.body;

    if (!to || !subject || !message) {
        return res.status(400).json({ error: 'To, Subject, and Message are required' });
    }

    try {
        db.getDb().get('SELECT google_refresh_token, microsoft_refresh_token, email, name FROM users LIMIT 1', async (err, row) => {
            if (err || !row || (!row.google_refresh_token && !row.microsoft_refresh_token)) {
                return res.status(401).json({ error: 'Not connected to Email Provider' });
            }

            if (row.microsoft_refresh_token) {
                try {
                    const result = await authProvider.getService('microsoft').sendEmail(row, { to, subject, message });
                    console.log('Email sent via Microsoft:', result.id);
                    return res.json(result);
                } catch (msErr) {
                    console.error('Microsoft Send Error:', msErr);
                    return res.status(500).json({ error: 'Failed to send email via Outlook' });
                }
            }

            // Google Logic
            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Helper to encode email with multi-part alternative and display names
            const makeBody = (to, fromEmail, fromName, subject, message) => {
                const date = new Date().toUTCString();
                const msgId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@hireflow.talentmanager>`;
                const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

                const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
                const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

                // Simple HTML version
                const htmlMessage = `
                    <div style="font-family: sans-serif; line-height: 1.6; color: #334155; max-width: 600px;">
                        <div style="padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <div style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
                            <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e2e8f0;">
                            <div style="font-size: 12px; color: #64748b;">
                                Sent via <strong>HireFlow Talent Manager</strong><br>
                                Focused on finding the right talent for your team.
                            </div>
                        </div>
                    </div>
                `;

                const str = [
                    "MIME-Version: 1.0\n",
                    `Date: ${date}\n`,
                    `Message-ID: ${msgId}\n`,
                    `Subject: ${utf8Subject}\n`,
                    `From: ${fromHeader}\n`,
                    `To: ${to}\n`,
                    `Content-Type: multipart/alternative; boundary="${boundary}"\n`,
                    "Auto-Submitted: auto-generated\n",
                    "X-Mailer: HireFlow-Talent-Manager\n",
                    "\n",
                    `--${boundary}\n`,
                    "Content-Type: text/plain; charset=\"UTF-8\"\n",
                    "Content-Transfer-Encoding: base64\n",
                    "\n",
                    Buffer.from(message).toString("base64"),
                    "\n\n",
                    `--${boundary}\n`,
                    "Content-Type: text/html; charset=\"UTF-8\"\n",
                    "Content-Transfer-Encoding: base64\n",
                    "\n",
                    Buffer.from(htmlMessage).toString("base64"),
                    "\n\n",
                    `--${boundary}--`
                ].join('');

                return Buffer.from(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
            };

            const raw = makeBody(to, row.email, row.name, subject, message);

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw }
            });

            console.log('Email sent:', response.data.id);
            res.json(response.data);
        });
    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/gmail/messages - List messages (Global or Candidate)
app.post('/api/gmail/messages_old', async (req, res) => {
    // ... old logic ...
});

// NEW: POST /api/gmail/messages - Full content & Filters
app.post('/api/gmail/messages', async (req, res) => {
    const { email, q: searchParam, filterByCandidates, filterType } = req.body;

    console.log(`[MAILBOX DEBUG] Request received. filterByCandidates=${filterByCandidates}, type=${filterType}, search=${searchParam}`);

    try {
        db.getDb().get('SELECT google_refresh_token, microsoft_refresh_token, email FROM users LIMIT 1', async (err, row) => {
            if (err || !row || (!row.google_refresh_token && !row.microsoft_refresh_token)) {
                return res.status(401).json({ error: 'Not connected to Email Provider' });
            }

            if (row.microsoft_refresh_token) {
                try {
                    let candidateEmails = [];
                    if (filterByCandidates) {
                        const candidates = await new Promise((resolve, reject) => {
                            db.getDb().all('SELECT email FROM candidates WHERE email IS NOT NULL', [], (err, rows) => {
                                if (err) reject(err);
                                else resolve(rows);
                            });
                        });
                        candidateEmails = candidates.map(c => c.email).filter(e => e && e.includes('@'));
                    }

                    const messages = await authProvider.getService('microsoft').listMessages(row, searchParam, candidateEmails);
                    return res.json({ messages });
                } catch (msErr) {
                    console.error('Microsoft List Messages Error:', msErr);
                    return res.status(500).json({ error: 'Failed to fetch Outlook messages' });
                }
            }

            // Google Logic
            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            let q = searchParam || '';
            let baseFilter = 'in:inbox'; // Default

            if (filterType === 'sent') baseFilter = 'label:SENT';
            if (filterType === 'unread') baseFilter = 'is:unread in:inbox';
            if (filterType === 'all') baseFilter = ''; // Search everything

            // Filter by candidates logic
            if (filterByCandidates) {
                // Fetch all candidate emails
                const candidates = await new Promise((resolve, reject) => {
                    db.getDb().all('SELECT email FROM candidates WHERE email IS NOT NULL', [], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                if (candidates.length === 0) {
                    return res.json({ messages: [] });
                }

                const adminEmail = row.email ? row.email.toLowerCase() : '';
                const emailList = candidates
                    .slice(0, 50)
                    .map(c => c.email)
                    .filter(e => e && e.includes('@') && e.toLowerCase() !== adminEmail);

                if (emailList.length > 0) {
                    const fromQuery = emailList.map(e => `from:${e}`).join(' OR ');
                    const toQuery = emailList.map(e => `to:${e}`).join(' OR ');
                    const candidateFilter = `(${fromQuery} OR ${toQuery})`;

                    // Combine base filter + candidate filter
                    if (baseFilter) {
                        q = `${baseFilter} AND ${candidateFilter}`;
                    } else {
                        q = candidateFilter;
                    }

                    if (searchParam) {
                        q = `${q} AND ${searchParam}`;
                    }
                } else {
                    return res.json({ messages: [] });
                }
            } else {
                // Standard no-candidate filter mode
                if (email) {
                    // IF fetching conversation for specific email
                    q = email;
                    if (filterType !== 'all') {
                        q = `${q} (in:inbox OR label:SENT)`;
                    }
                    // If filterType is strictly 'sent', we might want to narrow it? 
                    // But usually for conversation view we want BOTH.
                    // The Frontend does strict filtering anyway.
                } else {
                    if (baseFilter) q = baseFilter;
                    if (searchParam) q = q ? `${q} AND ${searchParam}` : searchParam;
                    if (!q) q = 'in:inbox';
                }
            }

            console.log(`Gmail Search Query: ${q}`);

            let listRes;
            try {
                listRes = await gmail.users.messages.list({
                    userId: 'me',
                    q: q,
                    maxResults: 20
                });
            } catch (listErr) {
                console.error('Gmail List Error:', listErr);
                if (listErr.code === 403 || (listErr.errors && listErr.errors.some(e => e.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'))) {
                    return res.status(403).json({ error: 'Insufficient Permissions. Please go to Settings and "Connect" your Google account again.' });
                }
                throw listErr;
            }

            const messages = listRes.data.messages || [];

            const fullMessages = await Promise.all(messages.map(async (msg) => {
                try {
                    // Fetch FULL message content
                    const detail = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'full'
                    });

                    const payload = detail.data.payload;
                    const headers = payload.headers;

                    // Helper to get body
                    const getBody = (parts) => {
                        if (!parts) return '';

                        // BFS/DFS to find html and plain parts
                        let htmlPart = null;
                        let plainPart = null;

                        const traverse = (pList) => {
                            for (const part of pList) {
                                if (part.mimeType === 'text/html' && part.body && part.body.data) {
                                    htmlPart = part;
                                } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                                    plainPart = part; // Keep first plain text found
                                } else if (part.parts) {
                                    traverse(part.parts);
                                }
                            }
                        };
                        traverse(parts);

                        const selectedPart = htmlPart || plainPart;
                        if (selectedPart) {
                            return Buffer.from(selectedPart.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
                        }
                        return '';
                    };

                    let bodyContent = '';
                    if (payload.body && payload.body.data) {
                        bodyContent = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                    } else if (payload.parts) {
                        bodyContent = getBody(payload.parts);
                    }

                    const getHeader = (name) => {
                        return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
                    };

                    return {
                        id: msg.id,
                        threadId: msg.threadId,
                        snippet: detail.data.snippet,
                        body: bodyContent, // FULL HTML BODY
                        from: getHeader('From'),
                        to: getHeader('To'),
                        subject: getHeader('Subject'),
                        date: getHeader('Date'),
                        labelIds: detail.data.labelIds, // Expose labels (SENT, INBOX, etc.)
                    };
                } catch (e) {
                    console.warn(`Failed to fetch message details for ${msg.id}`, e.message);
                    return null;
                }
            }));

            res.json({ messages: fullMessages.filter(m => m !== null) });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/gmail/thread - Fetch full thread content
app.post('/api/gmail/thread', async (req, res) => {
    const { threadId } = req.body;
    if (!threadId) return res.status(400).json({ error: 'threadId is required' });

    try {
        db.getDb().get('SELECT google_refresh_token, microsoft_refresh_token FROM users LIMIT 1', async (err, row) => {
            if (err || !row || (!row.google_refresh_token && !row.microsoft_refresh_token)) {
                return res.status(401).json({ error: 'Not connected to Email Provider' });
            }

            if (row.microsoft_refresh_token) {
                try {
                    const messages = await authProvider.getService('microsoft').getThread(row, threadId);
                    return res.json({ messages });
                } catch (msErr) {
                    console.error('Microsoft Thread Error:', msErr);
                    return res.status(500).json({ error: 'Failed to fetch Outlook conversation' });
                }
            }

            // Google Logic
            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            const threadRes = await gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'full'
            });

            const messages = threadRes.data.messages || [];

            const fullMessages = messages.map(msg => {
                const payload = msg.payload;
                const headers = payload.headers;

                const getHeader = (name) => {
                    return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
                };

                const getBody = (parts) => {
                    if (!parts) return '';

                    let htmlPart = null;
                    let plainPart = null;

                    const traverse = (pList) => {
                        for (const part of pList) {
                            if (part.mimeType === 'text/html' && part.body && part.body.data) {
                                htmlPart = part;
                            } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                                if (!plainPart) plainPart = part;
                            } else if (part.parts) {
                                traverse(part.parts);
                            }
                        }
                    };
                    traverse(parts);

                    const selectedPart = htmlPart || plainPart;
                    if (selectedPart) {
                        return Buffer.from(selectedPart.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
                    }
                    return '';
                };

                let bodyContent = '';
                if (payload.body && payload.body.data) {
                    bodyContent = Buffer.from(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
                } else if (payload.parts) {
                    bodyContent = getBody(payload.parts);
                }

                console.log(`[THREAD DEBUG] Msg ${msg.id}: BodyLen=${bodyContent?.length || 0}, SnippetLen=${msg.snippet?.length || 0}`);

                return {
                    id: msg.id,
                    threadId: msg.threadId,
                    subject: getHeader('Subject'),
                    date: getHeader('Date'),
                    from: getHeader('From'),
                    to: getHeader('To'),
                    body: bodyContent || '',
                    snippet: msg.snippet,
                    labelIds: msg.labelIds
                };
            });

            res.json({ messages: fullMessages });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/gmail/messages_old', async (req, res) => {
    const { email, q: queryParam, filterByCandidates } = req.body;

    console.log(`[MAILBOX DEBUG] Request received. filterByCandidates=${filterByCandidates}, email=${email}, q=${queryParam}`);

    try {
        db.getDb().get('SELECT google_refresh_token, email FROM users LIMIT 1', async (err, row) => {
            if (err || !row || !row.google_refresh_token) {
                return res.status(401).json({ error: 'Not connected to Gmail' });
            }

            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            let q = queryParam || '';

            // Filter by candidates logic
            if (filterByCandidates) {
                // Fetch all candidate emails
                const candidates = await new Promise((resolve, reject) => {
                    db.getDb().all('SELECT email FROM candidates WHERE email IS NOT NULL', [], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                if (candidates.length === 0) {
                    return res.json({ messages: [] }); // No candidates, empty mailbox
                }

                // Construct query: "from:c1@a.com OR from:c2@b.com ..."
                // Limit to prevent query overflow (Gmail limit ~2000 chars)

                // CRITICAL: Exclude the admin's own email if they added themselves as a candidate
                const adminEmail = row.email ? row.email.toLowerCase() : '';
                const emailList = candidates
                    .slice(0, 50)
                    .map(c => c.email)
                    .filter(e => e && e.includes('@') && e.toLowerCase() !== adminEmail);
                if (emailList.length > 0) {
                    const fromQuery = emailList.map(e => `from:${e}`).join(' OR ');
                    const toQuery = emailList.map(e => `to:${e}`).join(' OR ');
                    const candidateFilter = `(${fromQuery} OR ${toQuery})`;

                    q = q ? `${q} AND ${candidateFilter}` : candidateFilter;
                } else {
                    return res.json({ messages: [] });
                }
            } else if (!q && email) {
                q = `(from:${email} OR to:${email})`;
            }

            if (!q) {
                // Fallback if no filter provided
                q = 'in:inbox';
            }

            console.log(`Gmail Search Query: ${q}`); // Debug logging

            let listRes;
            try {
                listRes = await gmail.users.messages.list({
                    userId: 'me',
                    q: q,
                    maxResults: 20
                });
            } catch (listErr) {
                console.error('Gmail List Error:', listErr);
                // Check for insufficient scope specifically here
                if (listErr.code === 403 || (listErr.errors && listErr.errors.some(e => e.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'))) {
                    return res.status(403).json({ error: 'Insufficient Permissions. Please go to Settings and "Connect" your Google account again.' });
                }
                throw listErr; // Re-throw to main catcher
            }

            const messages = listRes.data.messages || [];

            const fullMessages = await Promise.all(messages.map(async (msg) => {
                try {
                    const detail = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'full'
                    });

                    const payload = detail.data.payload;
                    const headers = payload.headers;

                    const getBody = (parts) => {
                        let body = '';
                        if (!parts) return '';
                        for (const part of parts) {
                            if (part.mimeType === 'text/html' && part.body && part.body.data) {
                                return Buffer.from(part.body.data, 'base64').toString('utf-8');
                            }
                            if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) {
                                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                            }
                            if (part.parts) {
                                const sub = getBody(part.parts);
                                if (sub) return sub;
                            }
                        }
                        return body;
                    };

                    let bodyContent = '';
                    if (payload.body && payload.body.data) {
                        bodyContent = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                    } else if (payload.parts) {
                        bodyContent = getBody(payload.parts);
                    }

                    return {
                        id: msg.id,
                        snippet: detail.data.snippet,
                        body: bodyContent || detail.data.snippet,
                        from: headers.find(h => h.name === 'From')?.value,
                        to: headers.find(h => h.name === 'To')?.value,
                        subject: headers.find(h => h.name === 'Subject')?.value,
                        date: headers.find(h => h.name === 'Date')?.value,
                    };
                } catch (e) {
                    console.warn(`Failed to fetch message details for ${msg.id}`, e.message);
                    return null;
                }
            }));

            res.json({ messages: fullMessages.filter(m => m !== null) });
        });
    } catch (error) {
        console.error('Gmail fetch error:', error);

        let errorMessage = error.message || 'Failed to fetch emails';
        const errorData = error.response?.data?.error;

        if (errorData) {
            if (errorData.message) errorMessage = errorData.message;
            if (errorData.details) {
                const serviceDisabled = errorData.details.find(d => d.reason === 'SERVICE_DISABLED');
                if (serviceDisabled) errorMessage = 'Gmail API is not enabled. Please enable it in Google Console.';
            }
            // Handle Scope Insufficient
            if (errorData.status === 'PERMISSION_DENIED' || errorMessage.includes('scope')) {
                errorMessage = 'Insufficient Permissions. Please go to Settings and "Connect" your Google account again to grant Gmail access.';
            }
        }
        res.status(500).json({ error: errorMessage });


    }
});

// POST /api/gmail/send - Send an email
app.post('/api/gmail/send', async (req, res) => {
    const { to, subject, message, inReplyTo, threadId } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'To and Message are required' });
    }

    try {
        db.getDb().get('SELECT google_refresh_token FROM users LIMIT 1', async (err, row) => {
            if (err || !row || !row.google_refresh_token) {
                return res.status(401).json({ error: 'Not connected to Gmail' });
            }

            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Construct MIME message
            // Construct MIME message
            // Use text/plain to avoid HTML tag issues or double escaping
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `To: ${to}`,
                'Content-Type: text/plain; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                ''
            ];

            if (inReplyTo) {
                messageParts.splice(1, 0, `In-Reply-To: ${inReplyTo}`);
                messageParts.splice(2, 0, `References: ${inReplyTo}`);
            }

            messageParts.push(message);
            const rawMessage = messageParts.join('\n');
            const encodedMessage = Buffer.from(rawMessage)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const sendParams = {
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            };

            if (threadId) {
                sendParams.requestBody.threadId = threadId;
            }

            const sendRes = await gmail.users.messages.send(sendParams);
            res.json(sendRes.data);
        });
    } catch (error) {
        console.error('Gmail send error:', error);
        let errorMessage = error.message || 'Failed to send email';
        if (error.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
});

// GET /api/interviews - List all interviews (Upcoming & Recent)
app.get('/api/interviews', authenticateToken, (req, res) => {
    const sql = `
        SELECT i.*, c.name as candidate_name, c.job_id, j.title as job_title
        FROM interviews i
        LEFT JOIN candidates c ON i.candidate_id = c.id
        LEFT JOIN jobs j ON c.job_id = j.id
        WHERE j.user_id = ?
        ORDER BY i.scheduled_at ASC
    `;
    db.getDb().all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ interviews: rows });
    });
});

// GET /api/candidates/:id/interviews - Get interviews for a specific candidate
app.get('/api/candidates/:id/interviews', (req, res) => {
    const sql = `SELECT * FROM interviews WHERE candidate_id = ? ORDER BY scheduled_at DESC`;
    db.getDb().all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ interviews: rows });
    });
});

// PATCH /api/interviews/:id - Update interview notes AND/OR reschedule
app.patch('/api/interviews/:id', (req, res) => {
    const { notes, scheduled_at } = req.body;
    const interviewId = req.params.id;

    db.getDb().get('SELECT * FROM interviews WHERE id = ?', [interviewId], (err, currentInterview) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!currentInterview) return res.status(404).json({ error: 'Interview not found' });

        let newNotes = currentInterview.notes || '';
        let newScheduledAt = currentInterview.scheduled_at;
        let fields = [];
        let values = [];

        // Handle Reschedule
        if (scheduled_at && scheduled_at !== currentInterview.scheduled_at) {
            const oldTime = new Date(currentInterview.scheduled_at).toLocaleString();
            const newTime = new Date(scheduled_at).toLocaleString();
            const systemNote = `\n[System] Rescheduled from ${oldTime} to ${newTime}`;

            newNotes += systemNote;
            newScheduledAt = scheduled_at;

            fields.push('scheduled_at = ?');
            values.push(newScheduledAt);
        }

        // Handle Manual Notes Update (if provided, otherwise keep existing + system note)
        if (notes !== undefined) {
            // If user sends notes, they likely sent the *full* updated text, 
            // but we just appended a system note to the *old* text.
            // Strategy: If user is rescheduling, they probably didn't edit notes manually in the same request.
            // If they ONLY edited notes, scheduled_at is undefined.

            // Simplification: just overwrite with provided notes if present
            if (scheduled_at) {
                // Rescheduling implies system note append.
                // If `notes` was passed, it replaces the manual part? 
                // Let's assume `notes` param is ONLY for manual edits. 
                // If rescheduling, we just access `currentInterview.notes`.
                // BUT, if the user explicitly cleared notes?

                // Let's just append system note to whatever is the CURRENT DB state
                // unless `notes` is provided, in which case we append to THAT.
                newNotes = (notes !== undefined ? notes : (currentInterview.notes || '')) + (scheduled_at ? `\n[System] Rescheduled from ${new Date(currentInterview.scheduled_at).toLocaleString()} to ${new Date(scheduled_at).toLocaleString()}` : '');
            } else {
                newNotes = notes;
            }
        }

        fields.push('notes = ?');
        values.push(newNotes);

        values.push(interviewId);

        const sql = `UPDATE interviews SET ${fields.join(', ')} WHERE id = ?`;

        db.getDb().run(sql, values, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes, notes: newNotes, scheduled_at: newScheduledAt });
        });
    });
});

// Poller: Check for Upcoming Interviews (Every 1 min)
setInterval(() => {
    const now = new Date();
    const futureLimit = new Date(now.getTime() + 15 * 60000); // 15 mins lookahead

    // Find interviews scheduled between NOW and NOW+15m that haven't been reminded
    // Note: scheduled_at is ISO string
    const sql = `SELECT * FROM interviews WHERE reminder_sent = 0 AND scheduled_at > ? AND scheduled_at < ?`;
    db.getDb().all(sql, [now.toISOString(), futureLimit.toISOString()], (err, rows) => {
        if (err || !rows || rows.length === 0) return;

        rows.forEach(interview => {
            console.log(`[Reminder] Sending alert for Interview ID ${interview.id}`);
            createNotification(1, 'interview', 'Upcoming Interview', `Interview "${interview.title}" starts in < 15 minutes.`, `/interviews`);

            // Mark Sent
            db.getDb().run('UPDATE interviews SET reminder_sent = 1 WHERE id = ?', [interview.id]);
        });
    });
}, 60000);

// Database Initialization
db.init()
    .then(() => {
        console.log('Database initialized successfully');
        // Start Server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT} (0.0.0.0)`);
            // Initialize WhatsApp Service moved to external

        });
    })
    .catch(err => {
        console.error('Failed to initialize database:', err);
    });

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is healthy', timestamp: new Date() });
});



// PUT /api/user/profile
app.put('/api/user/profile', authenticateToken, (req, res) => {
    const { name, role, company_name, company_description, company_website, company_logo, whatsapp_number, enable_teams, enable_zoom, enable_manual, calendly_link, calendly_auth_token, smtp_host, smtp_port, smtp_user, smtp_pass } = req.body;

    // Check if new columns exist first (migration should have run).
    const sql = `UPDATE users SET 
        name = ?,
        role = ?,
        company_name = ?, 
        company_description = ?, 
        company_website = ?, 
        company_logo = ?,
        whatsapp_number = ?,
        enable_teams = ?,
        enable_zoom = ?,
        enable_manual = ?,
        calendly_link = ?,
        calendly_auth_token = ?,
        smtp_host = ?,
        smtp_port = ?,
        smtp_user = ?,
        smtp_pass = ?
        WHERE id = ?`;

    db.getDb().run(sql, [name, role, company_name, company_description, company_website, company_logo, whatsapp_number, enable_teams, enable_zoom, enable_manual, calendly_link, calendly_auth_token, smtp_host, smtp_port, smtp_user, smtp_pass, req.user.id], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Profile updated' });
    });
});

// GET /api/jobs - List all jobs
app.get('/api/jobs', authenticateToken, (req, res) => {
    // SELECT jobs.*, COUNT(candidates.id) as applicant_count FROM jobs...
    // Filter by user_id
    const sql = `
        SELECT j.*, COUNT(c.id) as applicant_count 
        FROM jobs j 
        LEFT JOIN candidates c ON j.id = c.job_id 
        WHERE j.user_id = ?
        GROUP BY j.id 
        ORDER BY j.created_at DESC
    `;
    db.getDb().all(sql, [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ jobs: rows });
    });
});

// POST /api/calendar/events - Schedule Interview & Send Invite
app.post('/api/calendar/events', async (req, res) => {
    const { summary, description, startTime, endTime, candidateEmail, candidateId, meetingProvider, meetingLink } = req.body;
    console.log('[Schedule] Request:', { summary, meetingProvider, candidateEmail });

    let finalLink = meetingLink;
    let location = 'Online';

    try {
        // 1. Handle Zoom Generation
        if (meetingProvider === 'zoom') {
            const user = await new Promise((resolve, reject) => {
                db.getDb().get('SELECT zoom_refresh_token FROM users LIMIT 1', (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            if (!user || (!user.zoom_refresh_token && !meetingLink)) {
                return res.status(401).json({ error: 'Zoom not connected' });
            }

            if (user.zoom_refresh_token) {
                console.log('[Schedule] Generating Zoom Meeting...');
                // FIX: Pass the user object, not the token string
                const meeting = await zoomService.createMeeting(user, {
                    topic: summary,
                    start_time: startTime,
                    duration: 60, // Default 1h
                    agenda: description
                });
                finalLink = meeting.join_url;
                location = 'Zoom Meeting';
                console.log('[Schedule] Zoom Meeting Created:', finalLink);
            }
        }

        // 1.5 Handle Google Meet Generation (if provider is google or auto-default to google)
        // If meetingProvider is 'google' OR (auto and user has google token and NOT zoom)
        if (!finalLink && (meetingProvider === 'google' || (meetingProvider === 'auto' && user.google_refresh_token))) {
            if (user.google_refresh_token) {
                console.log('[Schedule] Creating Google Calendar Event with Meet...');
                try {
                    oauth2Client.setCredentials({ refresh_token: user.google_refresh_token });
                    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

                    // Create Event with Conference Data
                    const eventRes = await calendar.events.insert({
                        calendarId: 'primary',
                        conferenceDataVersion: 1,
                        requestBody: {
                            summary: summary,
                            description: description,
                            start: { dateTime: startTime },
                            end: { dateTime: endTime },
                            attendees: candidateEmail ? [{ email: candidateEmail }] : [],
                            conferenceData: {
                                createRequest: {
                                    requestId: `meet-${Date.now()}`,
                                    conferenceSolutionKey: { type: "hangoutsMeet" }
                                }
                            }
                        }
                    });

                    if (eventRes.data) {
                        finalLink = eventRes.data.hangoutLink || eventRes.data.htmlLink;
                        location = 'Google Meet';
                        console.log('[Schedule] Google Event Created:', eventRes.data.id, 'Link:', finalLink);

                        // If we created a calendar event, Google sends invites automatically if we ask it to?
                        // The API default is usually FALSE for sendUpdates unless specified.
                        // But we also have our own email logic. 
                        // To avoid double emails, we rely on our own email logic below, 
                        // BUT the Google Event will be on their calendar now too.
                    }
                } catch (gErr) {
                    console.error('[Schedule] Google Meet Creation Failed:', gErr.message);
                    // Fallback?
                }
            }
        }

        // 2. Prepare Email Content
        const subject = `Invitation: ${summary}`;
        const emailBody = `
Hi,

You are invited to an interview.

Topic: ${summary}
Time: ${new Date(startTime).toLocaleString()}
Location: ${location}
Link: ${finalLink || 'See details below'}

${description}

Best regards,
Recruiting Team
        `.trim();

        // 3. Send Email (Gmail or Outlook)
        let emailSent = false;
        let emailError = null;

        db.getDb().get('SELECT google_refresh_token, microsoft_refresh_token, smtp_host, smtp_port, smtp_user, smtp_pass, company_name FROM users WHERE id = ?', [req.user.id], async (err, row) => {
            if (err) {
                console.error('[Schedule] DB Error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            // Custom SMTP Logic (Highest Priority)
            if (row && row.smtp_host && row.smtp_user && row.smtp_pass) {
                try {
                    console.log('[Schedule] Sending Email via Custom SMTP...');
                    const transporter = nodemailer.createTransport({
                        host: row.smtp_host,
                        port: row.smtp_port || 587,
                        secure: row.smtp_port === 465, // True if 465, false otherwise (TLS upgrade)
                        auth: {
                            user: row.smtp_user,
                            pass: row.smtp_pass
                        }
                    });

                    await transporter.sendMail({
                        from: `"${row.company_name || 'Recruiting'}" <${row.smtp_user}>`,
                        to: candidateEmail,
                        subject: subject,
                        text: emailBody
                    });

                    console.log('[Schedule] Email sent successfully via SMTP.');
                    emailSent = true;
                    emailError = null; // Clear error if success
                } catch (smtpErr) {
                    console.error('[Schedule] SMTP Send Failed:', smtpErr.message);
                    emailError = "SMTP Error: " + smtpErr.message;
                    // Fallthrough to other providers
                }
            }

            // Microsoft Outlook Logic (Only if not sent yet)
            if (!emailSent && row && row.microsoft_refresh_token) {
                try {
                    console.log('[Schedule] Sending Email via Outlook...');
                    await authProvider.getService('microsoft').sendMail(row, {
                        subject: subject,
                        content: emailBody,
                        toRecipients: [{ emailAddress: { address: candidateEmail } }]
                    });
                    console.log('[Schedule] Email sent successfully via Outlook.');
                    emailSent = true;
                    emailError = null; // Cleaning up any previous SMTP error
                } catch (msEsc) {
                    console.error('[Schedule] Outlook Send Failed:', msEsc.message);
                    if (msEsc.code === 'ErrorExceededMessageLimit' || msEsc.statusCode === 429) {
                        emailError = "Daily email limit exceeded by Outlook. Please verify your account.";
                    } else {
                        emailError = "Outlook Error: " + msEsc.message;
                    }
                }
            }

            // Google Gmail Logic (Fallback)
            if (!emailSent && row && row.google_refresh_token) {
                try {
                    console.log('[Schedule] Sending Email via Gmail...');
                    oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
                    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

                    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
                    const messageParts = [
                        `To: ${candidateEmail}`,
                        'Content-Type: text/plain; charset=utf-8',
                        'MIME-Version: 1.0',
                        `Subject: ${utf8Subject}`,
                        '',
                        emailBody
                    ];
                    const rawMessage = messageParts.join('\n');
                    const encodedMessage = Buffer.from(rawMessage)
                        .toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=+$/, '');

                    await gmail.users.messages.send({
                        userId: 'me',
                        requestBody: { raw: encodedMessage }
                    });
                    console.log('[Schedule] Email sent successfully via Gmail.');
                    emailSent = true;
                } catch (emailErr) {
                    console.error('[Schedule] Gmail Send Failed:', emailErr.message);
                    emailError = "Gmail Error: " + emailErr.message;
                }
            } else if (!emailSent) {
                console.log('[Schedule] No Email Provider connected or both failed. Skipping email.');
            }

            // 4. Save Interview to DB
            const insertSql = `INSERT INTO interviews (candidate_id, job_id, title, scheduled_at, duration_minutes, location, meeting_link, notes, status) 
                               VALUES (?, (SELECT job_id FROM candidates WHERE id = ?), ?, ?, 60, ?, ?, ?, 'scheduled')`;

            db.getDb().run(insertSql, [candidateId, candidateId, summary, startTime, location, finalLink, description], function (err) {
                if (err) console.error('[Schedule] Failed to save interview to DB:', err);

                // Use the captured specific error, or a fallback if email failed but no specific error was caught
                const finalEmailError = emailError || (!emailSent ? "Could not send email (Unknown reason)" : null);

                res.json({ success: true, meetingLink: finalLink, emailSent, emailError: finalEmailError });
            });
        });

    } catch (error) {
        console.error('[Schedule] Critical Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/user/profile - Get user profile and connection status
app.get('/api/user/profile', authenticateToken, (req, res) => {
    console.log(`${new Date().toISOString()} - GET /api/user/profile`);
    db.getDb().get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) {
            console.error('Profile DB Error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            console.log('[DEBUG] Profile Fetch - No user found');
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't send password
        const { password, ...profile } = row;

        res.json({
            profile,
            tokens: {
                google: !!row.google_refresh_token,
                microsoft: !!row.microsoft_refresh_token,
                zoom: !!row.zoom_refresh_token,
                calendly: !!row.calendly_auth_token
            },
            name: row.name, // Legacy frontend might expect these at root
            role: row.role
        });
    });
});


// Zoom Auth Routes
app.get('/api/auth/zoom', (req, res) => {
    try {
        const url = zoomService.getAuthUrl();
        res.json({ url });
    } catch (error) {
        console.error('Zoom Auth Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/zoom/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('No code provided');

    try {
        const tokens = await zoomService.getToken(code);
        // Save refresh token to DB (ID 1)
        db.getDb().run('UPDATE users SET zoom_refresh_token = ? WHERE id = 1', [tokens.refresh_token], (err) => {
            if (err) {
                console.error(err);
                return res.redirect(`${FRONTEND_URL}/settings?auth=error`);
            }
            res.redirect(`${FRONTEND_URL}/settings?auth=zoom_success`);
        });
    } catch (error) {
        console.error('Zoom Callback Error:', error);
        res.redirect(`${FRONTEND_URL}/settings?auth=error`);
    }
});

app.post('/api/auth/zoom/disconnect', (req, res) => {
    db.getDb().run('UPDATE users SET zoom_refresh_token = NULL WHERE id = 1', (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Disconnected from Zoom' });
    });
});

// POST /api/jobs - Create a new job
app.post('/api/jobs', authenticateToken, (req, res) => {
    const { title, description, chatbot_instructions } = req.body;
    const user_id = req.user.id;

    const sql = 'INSERT INTO jobs (user_id, title, description, chatbot_instructions, status) VALUES (?, ?, ?, ?, ?)';
    db.getDb().run(sql, [user_id, title, description, chatbot_instructions, 'published'], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        createNotification(user_id, 'job', 'Job Published', `Job "${title}" is now live.`, `/jobs`);
        res.json({ id: this.lastID, title, description, chatbot_instructions, status: 'published' });
    });
});

// DELETE /api/jobs/:id - Delete a job
app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
    const jobId = req.params.id;
    // Optional: Delete candidates first to clean up (if no CASCADE)
    // Check ownership first
    db.getDb().get('SELECT id FROM jobs WHERE id = ? AND user_id = ?', [jobId, req.user.id], (err, job) => {
        if (err || !job) return res.status(403).json({ error: 'Access denied' });

        db.getDb().run('DELETE FROM candidates WHERE job_id = ?', [jobId], (err) => {
            if (err) console.warn("Failed to clean up candidates", err);

            db.getDb().run('DELETE FROM jobs WHERE id = ?', [jobId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Job deleted', id: jobId });
            });
        });
    });
});

// PUT /api/jobs/:id - Edit a job
// PUT /api/jobs/:id - Edit a job
app.put('/api/jobs/:id', (req, res) => {
    const jobId = req.params.id;
    const { title, description, location, employment_type, department, status, chatbot_instructions } = req.body;

    // Dynamic Query Builder
    let fields = [];
    let values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (location !== undefined) { fields.push('location = ?'); values.push(location); }
    if (employment_type !== undefined) { fields.push('employment_type = ?'); values.push(employment_type); }
    if (department !== undefined) { fields.push('department = ?'); values.push(department); }
    if (chatbot_instructions !== undefined) { fields.push('chatbot_instructions = ?'); values.push(chatbot_instructions); }

    if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);

        // Update republished_at if status becomes 'published'
        if (status === 'published') {
            fields.push('republished_at = ?');
            values.push(new Date().toISOString());
        }
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(jobId);

    const sql = `UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`;

    db.getDb().run(sql, values, function (err) {
        if (err) {
            console.error('DB Update Error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Job updated', id: jobId });
    });
});

// Email Templates API
// GET /api/templates - List all templates
app.get('/api/templates', (req, res) => {
    const sql = 'SELECT * FROM templates ORDER BY is_prebuilt DESC, created_at DESC';
    db.getDb().all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ templates: rows });
    });
});

// POST /api/templates - Create a custom template
app.post('/api/templates', (req, res) => {
    const { name, subject, content, category } = req.body;
    if (!name || !subject || !content) return res.status(400).json({ error: 'Name, Subject and Content are required' });

    const sql = 'INSERT INTO templates (name, subject, content, category, is_prebuilt) VALUES (?, ?, ?, ?, 0)';
    db.getDb().run(sql, [name, subject, content, category || 'custom'], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, subject, content, category: category || 'custom' });
    });
});

// PUT /api/templates/:id - Update a template
app.put('/api/templates/:id', (req, res) => {
    const { name, subject, content, is_enabled } = req.body;
    const { id } = req.params;

    let fields = [];
    let values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (subject !== undefined) { fields.push('subject = ?'); values.push(subject); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (is_enabled !== undefined) { fields.push('is_enabled = ?'); values.push(is_enabled ? 1 : 0); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id);
    const sql = `UPDATE templates SET ${fields.join(', ')} WHERE id = ?`;

    db.getDb().run(sql, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// DELETE /api/templates/:id - Delete a custom template
app.delete('/api/templates/:id', (req, res) => {
    const { id } = req.params;
    // Only allow deleting custom templates (MVP)
    const sql = 'DELETE FROM templates WHERE id = ? AND is_prebuilt = 0';
    db.getDb().run(sql, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// POST /api/templates/generate - Generate email content using Gemini
app.post('/api/templates/generate', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const genAI = new googleAI.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemPrompt = `
        You are an expert HR copywriter. Generate a professional email template based on the following request: "${prompt}"
        
        RULES:
        1. Use placeholders: {{candidate_name}}, {{job_title}}, {{company_name}}, {{user_name}}.
        2. Keep the tone professional yet warm.
        3. Output a JSON object with:
           {
             "name": "Short Descriptive Name",
             "subject": "Email Subject Line",
             "content": "Full Email Body Text"
           }
        4. No markdown, just clean JSON.
        `;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        res.json(JSON.parse(text));
    } catch (error) {
        console.error('AI Template Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Public Job API (No Auth)
app.get('/api/public/jobs/:id', (req, res) => {
    const sql = 'SELECT id, title, description, chatbot_instructions FROM jobs WHERE id = ?';
    db.getDb().get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Job not found' });
        res.json(row);
    });
});

// POST /api/candidates - Submit application
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
const { processResume } = require('../execution/parse_resume');

app.post('/api/candidates', upload.single('resume'), async (req, res) => {
    console.log('Received application request:', req.body, req.file ? 'with file' : 'no file');
    const { job_id, name, email, phone, linkedin, chat_transcript } = req.body;

    if (!job_id || !name || !email) {
        console.warn('Submission failed: Missing fields', { job_id, name, email });
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const transcriptStr = typeof chat_transcript === 'string' ? chat_transcript : JSON.stringify(chat_transcript);
        let resume_text = '';
        let match_score = 0;
        let resume_summary = '';

        if (req.file) {
            // Get Job Description and Chatbot Instructions for scoring
            const jobSql = 'SELECT description, chatbot_instructions FROM jobs WHERE id = ?';
            const job = await new Promise((resolve, reject) => {
                db.getDb().get(jobSql, [job_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (job) {
                const analysis = await processResume(req.file.path, job.description, transcriptStr, job.chatbot_instructions);
                resume_text = analysis.resume_text;
                match_score = analysis.match_score;
                resume_summary = analysis.summary;
            }
        } else {
            // If no resume, still analyze the chat transcript against the JD and Instructions
            const jobSql = 'SELECT description, chatbot_instructions FROM jobs WHERE id = ?';
            const job = await new Promise((resolve, reject) => {
                db.getDb().get(jobSql, [job_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (job && transcriptStr) {
                // We'll modify processResume to handle no-file case or create a separate one
                // For now, let's just use the transcript if it exists
                const analysis = await processResume(null, job.description, transcriptStr, job.chatbot_instructions);
                match_score = analysis.match_score;
                resume_summary = analysis.summary;

                // Use AI extracted linkedin if not explicitly provided
                if (!linkedin && analysis.extracted_linkedin) {
                    req.body.extractedLinkedin = analysis.extracted_linkedin;
                }
            }
        }

        // Fallback: Try regex on transcript if still missing
        if (!req.body.extractedLinkedin && !linkedin && transcriptStr) {
            const linkedinMatch = transcriptStr.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%]+/i);
            if (linkedinMatch) {
                req.body.extractedLinkedin = linkedinMatch[0];
            }
        }

        const finalLinkedin = linkedin || req.body.extractedLinkedin || null;
        const resume_filename = req.file ? req.file.filename : null;
        const whatsapp_number = req.body.whatsapp_number || null;

        const sql = 'INSERT INTO candidates (job_id, name, email, phone, linkedin, chat_transcript, resume_text, resume_summary, resume_filename, match_score, status, whatsapp_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        db.getDb().run(sql, [job_id, name, email, phone, finalLinkedin, transcriptStr, resume_text, resume_summary, resume_filename, match_score, 'new', whatsapp_number], function (err) {
            if (err) {
                console.error('Database error during candidate submission:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('Application submitted successfully, ID:', this.lastID, 'Score:', match_score);
            createNotification(1, 'application', 'New Application', `Candidate ${name} applied for Job #${job_id}`, `/candidates/${this.lastID}`);
            res.json({ id: this.lastID, message: 'Application submitted successfully', match_score, resume_filename });
        });
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Failed to process application' });
    }
});

// GET /api/jobs/:id/candidates - List candidates for a specific job
app.get('/api/jobs/:id/candidates', authenticateToken, (req, res) => {
    const jobId = req.params.id;

    // First, verify Job belongs to User
    db.getDb().get('SELECT id FROM jobs WHERE id = ? AND user_id = ?', [jobId, req.user.id], (err, job) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!job) return res.status(403).json({ error: 'Access denied or Job not found' });

        const sql = 'SELECT * FROM candidates WHERE job_id = ? ORDER BY created_at DESC';
        db.getDb().all(sql, [jobId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            // Add resume_url for convenience
            const candidates = rows.map(c => ({
                ...c,
                resume_url: c.resume_filename ? `/uploads/${c.resume_filename}` : null
            }));

            res.json({ candidates });
        });
    });
});

// GET /api/candidates/:id - Get single candidate details
app.get('/api/candidates/:id', authenticateToken, (req, res) => {
    const candidateId = req.params.id;
    console.log(`Fetching candidate details for ID: ${candidateId}`);

    const sql = `
        SELECT c.*, j.title as job_title 
        FROM candidates c 
        LEFT JOIN jobs j ON c.job_id = j.id 
        WHERE c.id = ? AND j.user_id = ?
    `;
    db.getDb().get(sql, [candidateId, req.user.id], (err, row) => {
        if (err) {
            console.error(`Database error for candidate ${candidateId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            console.warn(`Candidate ${candidateId} not found or access denied.`);
            return res.status(404).json({ error: 'Candidate not found' });
        }
        res.json(row);
    });
});

// PATCH /api/candidates/:id/status - Update candidate status
app.patch('/api/candidates/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    // Verify ownership via Join
    const sqlVerify = `SELECT c.id FROM candidates c JOIN jobs j ON c.job_id = j.id WHERE c.id = ? AND j.user_id = ?`;

    db.getDb().get(sqlVerify, [req.params.id, req.user.id], (err, row) => {
        if (err || !row) return res.status(403).json({ error: 'Access denied' });

        const sql = 'UPDATE candidates SET status = ? WHERE id = ?';
        db.getDb().run(sql, [status, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        });
    });
});

// POST /api/jobs/draft - Draft JD using Gemini
const { spawn } = require('child_process');

app.post('/api/jobs/draft', (req, res) => {
    const { notes } = req.body;
    if (!notes) {
        return res.status(400).json({ error: 'Notes are required' });
    }

    const scriptPath = path.join(__dirname, '../execution/draft_job.js');
    const pythonProcess = spawn('node', [scriptPath, notes]);

    let dataString = '';

    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Gemini script failed. Code: ${code}. Error: ${errorString}`);
            return res.status(500).json({ error: 'Failed to draft job description' });
        }
        try {
            const jsonResponse = JSON.parse(dataString);
            res.json(jsonResponse);
        } catch (e) {
            res.json({ title: 'Draft Job', description: dataString });
        }
    });
});

// POST /api/webhooks/calendly - Handle Calendly Webhooks
app.post('/api/webhooks/calendly', (req, res) => {
    // Basic verification - usually verify signature, but skipping for MVP
    const event = req.body;

    console.log('[Calendly Webhook] Received event:', event.event);

    if (event.event === 'invitee.created') {
        const payload = event.payload;
        const email = payload.email;
        const name = payload.name;

        console.log(`[Calendly] Interview booked for ${name} (${email})`);

        // Find candidate and update status
        db.getDb().get('SELECT id, job_id FROM candidates WHERE email = ?', [email], (err, row) => {
            if (err) {
                console.error('[Calendly] Database error finding candidate:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (row) {
                console.log(`[Calendly] Updating status for Candidate ID ${row.id}`);
                db.getDb().run('UPDATE candidates SET status = ? WHERE id = ?', ['interview', row.id], (err) => {
                    if (err) console.error('[Calendly] Failed to update status:', err);
                    else {
                        createNotification(1, 'interview', 'Interview Booked', `Interview scheduled for ${name}`, `/interviews`);
                    }
                });
            } else {
                console.log(`[Calendly] No candidate found for email ${email}`);
            }
        });
    }

    res.status(200).send('Received');
});

// PUT /api/candidates/:id/status - Update Candidate Status
app.put('/api/candidates/:id/status', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!status) return res.status(400).json({ error: 'Status required' });

    db.getDb().run('UPDATE candidates SET status = ? WHERE id = ?', [status, id], function (err) {
        if (err) {
            console.error('[Candidate] Update Status Failed:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, status });
    });
});




// Notifications API
app.get('/api/notifications', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
    db.getDb().all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ notifications: rows });
    });
});

app.put('/api/notifications/:id/read', (req, res) => {
    const sql = 'UPDATE notifications SET is_read = 1 WHERE id = ?';
    db.getDb().run(sql, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
    const sql = 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
    db.getDb().run(sql, [req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// GET /api/dashboard/stats - Real Dashboard Data
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Active Jobs
        const activeJobsQuery = "SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND (status = 'active' OR status = 'published')";

        // 2. Total Candidates (Candidates for MY jobs)
        const candidatesQuery = "SELECT COUNT(*) as count FROM candidates c JOIN jobs j ON c.job_id = j.id WHERE j.user_id = ?";

        // 3. New Applications (Candidates with status 'new')
        const newAppsQuery = "SELECT COUNT(*) as count FROM candidates c JOIN jobs j ON c.job_id = j.id WHERE j.user_id = ? AND c.status = 'new'";

        // 4. Interviews (Scheduled this week - simplified to > NOW)
        // 4. Interviews (Scheduled > NOW)
        const interviewsQuery = "SELECT COUNT(*) as count FROM interviews i JOIN candidates c ON i.candidate_id = c.id JOIN jobs j ON c.job_id = j.id WHERE j.user_id = ? AND i.scheduled_at > ?";

        // 5. Pipeline Stats (New, Screening, Interview, Offer, Rejected)
        const pipelineQuery = `
            SELECT c.status, COUNT(*) as count 
            FROM candidates c 
            JOIN jobs j ON c.job_id = j.id 
            WHERE j.user_id = ? 
            GROUP BY c.status
        `;

        // Execute all promises
        const getCount = (sql, params) => new Promise((resolve, reject) => {
            db.getDb().get(sql, params, (err, row) => err ? reject(err) : resolve(row.count));
        });

        const getList = (sql, params) => new Promise((resolve, reject) => {
            db.getDb().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });

        const [activeJobs, totalCandidates, newApps, interviews, pipelineRows] = await Promise.all([
            getCount(activeJobsQuery, [userId]),
            getCount(candidatesQuery, [userId]),
            getCount(newAppsQuery, [userId]),
            getCount(interviewsQuery, [userId, new Date().toISOString()]),
            getList(pipelineQuery, [userId])
        ]);

        // Process Pipeline
        const pipeline = {
            new: 0, screening: 0, interview: 0, offer: 0, rejected: 0
        };
        pipelineRows.forEach(row => {
            if (pipeline[row.status] !== undefined) pipeline[row.status] = row.count;
        });

        res.json({
            stats: {
                activeJobs,
                totalCandidates,
                newApplications: newApps,
                interviews,
            },
            pipeline
        });

    } catch (err) {
        console.error('Stats Error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
// Catch-all for React Router
app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
    res.sendFile(path.join(clientDist, 'index.html'));
});
