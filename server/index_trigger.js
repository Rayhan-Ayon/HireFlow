require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const { getNextChatMessage } = require('../execution/ai_chat');


// POST /api/chat - Dynamic AI Interview
app.post('/api/chat', async (req, res) => {
    const { job_id, history, message } = req.body;

    if (!job_id) return res.status(400).json({ error: 'Job ID is required' });

    try {
        // Get JD and Company Profile for context
        // Fetching the first user's profile for now (MVP simplification)
        const sql = `
            SELECT j.description, u.company_name, u.company_description 
            FROM jobs j 
            LEFT JOIN users u ON j.user_id = u.id OR u.id = (SELECT id FROM users LIMIT 1) 
            WHERE j.id = ?
        `;

        db.getDb().get(sql, [job_id], async (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Job context not found' });

            const companyProfile = {
                name: row.company_name,
                description: row.company_description
            };

            // FIX: Append the latest user message to history if provided separately
            const fullHistory = history || [];
            console.log(`[DEBUG] History from Client: ${history?.length || 0}`);
            if (message) {
                console.log(`[DEBUG] Appending new message: "${message}"`);
                fullHistory.push({ role: 'user', parts: [{ text: message }] });
            }
            console.log(`[DEBUG] Full History to AI: ${fullHistory.length}`);

            const aiResponse = await getNextChatMessage(row.description, fullHistory, companyProfile);
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
    'http://localhost:5173' // Redirect to frontend first, which will call backend
);



// OAuth Routes
app.get('/api/auth/google', (req, res) => {
    // Added gmail.send scope
    const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/gmail.send'
    ];
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for refresh token
        scope: scopes,
        prompt: 'consent' // Force refresh token on re-auth
    });
    res.json({ url });
});

app.post('/api/auth/google/callback', async (req, res) => {
    const { code } = req.body;
    const fs = require('fs');
    const logFile = path.resolve(__dirname, '../debug_oauth.txt');
    const log = (msg) => fs.appendFileSync(logFile, new Date().toISOString() + ': ' + msg + '\n');

    try {
        log(`Callback received. Code length: ${code ? code.length : 'N/A'}`);
        const { tokens } = await oauth2Client.getToken(code);
        log(`Tokens received. Scopes: ${tokens.scope}`);
        log(`Refresh Token present: ${!!tokens.refresh_token}`);

        if (tokens.refresh_token) {
            db.getDb().run(
                'UPDATE users SET google_refresh_token = ? WHERE id = (SELECT id FROM users LIMIT 1)',
                [tokens.refresh_token],
                (err) => {
                    if (err) log(`DB UPDATE ERROR: ${err.message}`);
                    else log("DB UPDATE SUCCESS");
                }
            );
        } else {
            log("WARNING: No refresh token. User needs to revoke access.");
        }
        res.json({ success: true, tokens });
    } catch (error) {
        log(`AUTH ERROR: ${error.message}`);
        console.error('Auth error', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});



app.get('/api/calendar/events', async (req, res) => {
    try {
        // Get token from DB
        db.getDb().get('SELECT google_refresh_token FROM users LIMIT 1', async (err, row) => {
            if (err || !row || !row.google_refresh_token) {
                return res.status(401).json({ error: 'Not connected' });
            }

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
    const { summary, description, startTime, endTime, candidateEmail, candidateId } = req.body;

    if (!startTime || !endTime) {
        return res.status(400).json({ error: 'Start and End time are required' });
    }

    try {
        // Get token from DB
        db.getDb().get('SELECT google_refresh_token FROM users LIMIT 1', async (err, row) => {
            if (err || !row || !row.google_refresh_token) {
                return res.status(401).json({ error: 'Not connected to Google Calendar' });
            }

            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
                summary: summary || 'Interview',
                description: description || 'Interview scheduled via HireFlow',
                start: { dateTime: startTime },
                end: { dateTime: endTime },
                attendees: candidateEmail ? [{ email: candidateEmail }] : [],
                conferenceData: {
                    createRequest: { requestId: "sample123", conferenceSolutionKey: { type: "hangoutsMeet" } },
                },
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                conferenceDataVersion: 1, // Required for creating Meet links
                sendUpdates: 'all', // Send emails to attendees
            });

            // Save to local interviews table
            if (response.data && response.data.id) {
                const sql = `INSERT INTO interviews (candidate_id, google_event_id, scheduled_at, title, meeting_link, notes) VALUES (?, ?, ?, ?, ?, ?)`;
                // Use a default note or empty string
                const notes = '';
                const meetingLink = response.data.hangoutLink || response.data.htmlLink || null;

                db.getDb().run(sql, [candidateId || null, response.data.id, startTime, summary, meetingLink, notes], function (err) {
                    if (err) console.error('Failed to save interview to DB:', err);
                    else console.log('Interview saved to DB, ID:', this.lastID);
                });
            }

            res.json(response.data);
        });
    } catch (error) {
        console.error('Calendar create error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Gmail Integration
// POST /api/gmail/send - Send an email
app.post('/api/gmail/send', async (req, res) => {
    const { to, subject, message, candidateId } = req.body;

    if (!to || !subject || !message) {
        return res.status(400).json({ error: 'To, Subject, and Message are required' });
    }

    try {
        db.getDb().get('SELECT google_refresh_token, email FROM users LIMIT 1', async (err, row) => {
            if (err || !row || !row.google_refresh_token) {
                return res.status(401).json({ error: 'Not connected to Gmail' });
            }

            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Helper to encode email
            const makeBody = (to, from, subject, message) => {
                const str = [
                    "Content-Type: text/plain; charset=\"UTF-8\"\n",
                    "MIME-Version: 1.0\n",
                    "Content-Transfer-Encoding: 7bit\n",
                    "to: ", to, "\n",
                    "from: ", from, "\n",
                    "subject: ", subject, "\n\n",
                    message
                ].join('');
                return Buffer.from(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
            };

            const raw = makeBody(to, row.email, subject, message);

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw }
            });

            // Log to local DB (CRM) - optional, for now we rely on Gmail Sent items
            console.log('Email sent:', response.data.id);
            res.json(response.data);
        });
    } catch (error) {
        console.error('Gmail send error:', error);
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to send email';
        res.status(500).json({ error: errorMessage });
    }
});

// GET /api/gmail/messages - List messages for a candidate
app.post('/api/gmail/messages', async (req, res) => {
    const { email } = req.body; // Candidate email to search for

    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        db.getDb().get('SELECT google_refresh_token FROM users LIMIT 1', async (err, row) => {
            if (err || !row || !row.google_refresh_token) {
                return res.status(401).json({ error: 'Not connected to Gmail' });
            }

            oauth2Client.setCredentials({ refresh_token: row.google_refresh_token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Search for messages to/from this email
            const q = `(from:${email} OR to:${email})`;
            const listRes = await gmail.users.messages.list({
                userId: 'me',
                q: q,
                maxResults: 10
            });

            const messages = listRes.data.messages || [];

            // Fetch validation snippet
            const fullMessages = await Promise.all(messages.map(async (msg) => {
                const detail = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Date', 'Subject', 'To']
                });

                const headers = detail.data.payload.headers;
                return {
                    id: msg.id,
                    snippet: detail.data.snippet,
                    from: headers.find(h => h.name === 'From')?.value,
                    to: headers.find(h => h.name === 'To')?.value,
                    subject: headers.find(h => h.name === 'Subject')?.value,
                    date: headers.find(h => h.name === 'Date')?.value,
                };
            }));

            res.json({ messages: fullMessages });
        });
    } catch (error) {
        console.error('Gmail fetch error:', error);
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to fetch emails';
        res.status(500).json({ error: errorMessage });
    }
});

// GET /api/interviews - List all interviews (Upcoming & Recent)
app.get('/api/interviews', (req, res) => {
    const sql = `
        SELECT i.*, c.name as candidate_name, c.job_id, j.title as job_title
        FROM interviews i
        LEFT JOIN candidates c ON i.candidate_id = c.id
        LEFT JOIN jobs j ON c.job_id = j.id
        ORDER BY i.scheduled_at ASC
    `;
    db.getDb().all(sql, [], (err, rows) => {
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

// Database Initialization
db.init()
    .then(() => {
        console.log('Database initialized successfully');
        // Start Server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
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

// GET /api/user/profile
app.get('/api/user/profile', (req, res) => {
    // Assuming single user for now or getting the first user
    // Start with a check for connection
    const sql = `SELECT id, email, name, role, company_name, company_description, company_website, company_logo, whatsapp_number, 
                 CASE WHEN google_refresh_token IS NOT NULL THEN 1 ELSE 0 END as is_connected
                 FROM users ORDER BY id ASC LIMIT 1`;
    db.getDb().get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) {
            // Create default user if none
            db.getDb().run('INSERT INTO users (email) VALUES (?)', ['demo@example.com'], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, email: 'demo@example.com', is_connected: 0 });
            });
        } else {
            res.json({ ...row, is_connected: !!row.is_connected });
        }
    });
});

// PUT /api/user/profile
app.put('/api/user/profile', (req, res) => {
    const { name, role, company_name, company_description, company_website, company_logo, whatsapp_number } = req.body;
    // Update the first user for now
    const sql = `UPDATE users SET 
        name = ?,
        role = ?,
        company_name = ?, 
        company_description = ?, 
        company_website = ?, 
        company_logo = ?,
        whatsapp_number = ?
        WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)`;

    db.getDb().run(sql, [name, role, company_name, company_description, company_website, company_logo, whatsapp_number], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Profile updated' });
    });
});

// GET /api/jobs - List all jobs
app.get('/api/jobs', (req, res) => {
    // SELECT jobs.*, COUNT(candidates.id) as applicant_count FROM jobs...
    const sql = `
        SELECT j.*, COUNT(c.id) as applicant_count 
        FROM jobs j 
        LEFT JOIN candidates c ON j.id = c.job_id 
        GROUP BY j.id 
        ORDER BY j.created_at DESC
    `;
    db.getDb().all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ jobs: rows });
    });
});

// POST /api/jobs - Create a new job
app.post('/api/jobs', (req, res) => {
    const { title, description } = req.body;
    // For now, hardcode user_id to 1 until Auth is ready
    const user_id = 1;

    const sql = 'INSERT INTO jobs (user_id, title, description, status) VALUES (?, ?, ?, ?)';
    db.getDb().run(sql, [user_id, title, description, 'published'], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, title, description, status: 'published' });
    });
});

// DELETE /api/jobs/:id - Delete a job
app.delete('/api/jobs/:id', (req, res) => {
    const jobId = req.params.id;
    // Optional: Delete candidates first to clean up (if no CASCADE)
    db.getDb().run('DELETE FROM candidates WHERE job_id = ?', [jobId], (err) => {
        if (err) console.warn("Failed to clean up candidates", err);

        db.getDb().run('DELETE FROM jobs WHERE id = ?', [jobId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Job deleted', id: jobId });
        });
    });
});

// PUT /api/jobs/:id - Edit a job
// PUT /api/jobs/:id - Edit a job
app.put('/api/jobs/:id', (req, res) => {
    const jobId = req.params.id;
    const { title, description, location, employment_type, department, status } = req.body;

    // Dynamic Query Builder
    let fields = [];
    let values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (location !== undefined) { fields.push('location = ?'); values.push(location); }
    if (employment_type !== undefined) { fields.push('employment_type = ?'); values.push(employment_type); }
    if (department !== undefined) { fields.push('department = ?'); values.push(department); }

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

// Public Job API (No Auth)
app.get('/api/public/jobs/:id', (req, res) => {
    const sql = 'SELECT id, title, description FROM jobs WHERE id = ?';
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
            // Get Job Description for scoring
            const jobSql = 'SELECT description FROM jobs WHERE id = ?';
            const job = await new Promise((resolve, reject) => {
                db.getDb().get(jobSql, [job_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (job) {
                const analysis = await processResume(req.file.path, job.description, transcriptStr);
                resume_text = analysis.resume_text;
                match_score = analysis.match_score;
                resume_summary = analysis.summary;
            }
        } else {
            // If no resume, still analyze the chat transcript against the JD
            const jobSql = 'SELECT description FROM jobs WHERE id = ?';
            const job = await new Promise((resolve, reject) => {
                db.getDb().get(jobSql, [job_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (job && transcriptStr) {
                // We'll modify processResume to handle no-file case or create a separate one
                // For now, let's just use the transcript if it exists
                const analysis = await processResume(null, job.description, transcriptStr);
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
            res.json({ id: this.lastID, message: 'Application submitted successfully', match_score, resume_filename });
        });
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Failed to process application' });
    }
});

// GET /api/jobs/:id/candidates - List candidates for a specific job
app.get('/api/jobs/:id/candidates', (req, res) => {
    const jobId = req.params.id;
    const sql = 'SELECT * FROM candidates WHERE job_id = ? ORDER BY created_at DESC';
    db.getDb().all(sql, [jobId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ candidates: rows });
    });
});

// GET /api/candidates/:id - Get single candidate details
app.get('/api/candidates/:id', (req, res) => {
    const candidateId = req.params.id;
    console.log(`Fetching candidate details for ID: ${candidateId}`);

    const sql = `
        SELECT c.*, j.title as job_title 
        FROM candidates c 
        LEFT JOIN jobs j ON c.job_id = j.id 
        WHERE c.id = ?
    `;
    db.getDb().get(sql, [candidateId], (err, row) => {
        if (err) {
            console.error(`Database error for candidate ${candidateId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            console.warn(`Candidate ${candidateId} not found in DB.`);
            return res.status(404).json({ error: 'Candidate not found' });
        }
        res.json(row);
    });
});

// PATCH /api/candidates/:id/status - Update candidate status
app.patch('/api/candidates/:id/status', (req, res) => {
    const { status } = req.body;
    const sql = 'UPDATE candidates SET status = ? WHERE id = ?';
    db.getDb().run(sql, [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
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
