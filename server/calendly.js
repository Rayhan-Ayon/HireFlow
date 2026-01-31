const fetch = require('isomorphic-fetch');

let currentUserUri = null;

async function pollCalendly(db) {
    // console.log('[Calendly] Polling...'); // Commented out to reduce noise

    // 1. Get Token
    const row = await new Promise((resolve, reject) => {
        db.get('SELECT calendly_auth_token FROM users WHERE id = 1', (err, row) => {
            if (err) reject(err); else resolve(row);
        });
    });

    if (!row || !row.calendly_auth_token) {
        // console.log('[Calendly] No token found.');
        return;
    }
    const token = row.calendly_auth_token;

    // 2. Get User URI (Cache it)
    if (!currentUserUri) {
        try {
            const userRes = await fetch('https://api.calendly.com/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!userRes.ok) throw new Error('Failed to fetch user: ' + userRes.statusText);
            const userData = await userRes.json();
            currentUserUri = userData.resource.uri;
            const schedulingUrl = userData.resource.scheduling_url;
            console.log('[Calendly] User URI:', currentUserUri);

            // Auto-save scheduling link if missing
            if (schedulingUrl) {
                db.get('SELECT calendly_link FROM users WHERE id = 1', (err, row) => {
                    if (row && !row.calendly_link) {
                        console.log('[Calendly] Auto-saving Scheduling Link:', schedulingUrl);
                        db.run('UPDATE users SET calendly_link = ? WHERE id = 1', [schedulingUrl]);
                    }
                });
            }
        } catch (e) {
            console.error('[Calendly] Auth Error:', e.message);
            return;
        }
    }

    // 3. Get Recent Events (Last 10 created)
    try {
        const eventsRes = await fetch(`https://api.calendly.com/scheduled_events?user=${currentUserUri}&status=active&sort=created_at:desc&count=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!eventsRes.ok) throw new Error('Failed to fetch events: ' + eventsRes.statusText);

        const eventsData = await eventsRes.json();
        const events = eventsData.collection;

        for (const event of events) {
            // Check invitees
            const inviteesRes = await fetch(`${event.uri}/invitees`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!inviteesRes.ok) continue;

            const inviteesData = await inviteesRes.json();
            const invitees = inviteesData.collection;

            for (const invitee of invitees) {
                const email = invitee.email;
                const name = invitee.name;

                // Sync with DB
                db.get('SELECT id, status, job_id FROM candidates WHERE email = ?', [email], (err, cRow) => {
                    if (err) return;
                    if (cRow) {
                        // 1. Update Status
                        if (cRow.status !== 'interview') {
                            console.log(`[Calendly] Match found! Updating ${name} (${email}) to 'interview'.`);
                            db.run('UPDATE candidates SET status = ? WHERE id = ?', ['interview', cRow.id]);
                        }

                        // 2. Sync Interview to DB
                        const startTime = event.start_time;
                        const endTime = event.end_time;
                        const title = event.name || 'Interview';
                        const location = event.location?.join_url || event.location?.type || 'Calendly';

                        // Check if exists
                        db.get('SELECT id FROM interviews WHERE candidate_id = ? AND scheduled_at = ?', [cRow.id, startTime], (err, iRow) => {
                            if (!iRow) {
                                console.log(`[Calendly] Syncing interview for candidate ${cRow.id}`);
                                const insert = `INSERT INTO interviews (candidate_id, job_id, title, scheduled_at, duration_minutes, location, meeting_link, status, notes)
                                                 VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', '[Auto-Synced from Calendly]')`;

                                const duration = (new Date(endTime) - new Date(startTime)) / 60000;
                                db.run(insert, [cRow.id, cRow.job_id, title, startTime, duration, location, event.uri]);
                            }
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.error('[Calendly] Poll Error:', e.message);
    }
}

function startService(db) {
    console.log('[Calendly] Service Started');
    setInterval(() => pollCalendly(db), 60000); // Poll every minute
    pollCalendly(db); // Initial run
}

module.exports = { startService };
