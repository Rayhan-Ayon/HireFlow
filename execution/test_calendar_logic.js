const db = require('../server/database');
const authProvider = require('../server/auth_provider');
const microsoftService = require('../server/microsoft_service');

authProvider.registerService('microsoft', microsoftService);

const all = (sql, params = []) => new Promise((res, rej) => db.getDb().all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const get = (sql, params = []) => new Promise((res, rej) => db.getDb().get(sql, params, (err, row) => err ? rej(err) : res(row)));

async function testCalendar() {
    try {
        console.log('Initializing DB...');
        await db.init();

        console.log('Querying interviews...');
        const interviewRows = await all('SELECT google_event_id FROM interviews WHERE google_event_id IS NOT NULL');
        console.log('Interview IDs found:', interviewRows.length);
        const hireFlowIds = new Set(interviewRows.map(r => r.google_event_id));

        console.log('Querying users...');
        const row = await get('SELECT google_refresh_token, microsoft_refresh_token FROM users LIMIT 1');
        console.log('Connection status:', { google: !!row.google_refresh_token, microsoft: !!row.microsoft_refresh_token });

        if (row.microsoft_refresh_token) {
            console.log('Fetching Microsoft events...');
            const allEvents = await authProvider.getService('microsoft').listEvents(row);
            console.log('Microsoft events found:', allEvents.length);

            console.log('Filtering events...');
            const filteredEvents = allEvents.filter(evt => hireFlowIds.has(evt.id) || hireFlowIds.has(evt.iCalUID));
            console.log('Filtered events:', filteredEvents.length);
        }

        console.log('Test complete!');
        process.exit(0);
    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exit(1);
    }
}

testCalendar();
