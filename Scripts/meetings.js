// cron_check_all_contacts.js

(async () => {
    console.log('Script starting...');

    const LAST_RUN_FILE = './.last_run_timestamp.txt';
    require('dotenv').config();
    const axios = require('axios');
    const fs = require('fs');
    const mysql = require('mysql2/promise');

    function readLastRunTime() {
        const defaultTimestamp = '2025-01-01T00:00:00.000Z';
        try {
            return fs.readFileSync(LAST_RUN_FILE, 'utf-8').trim();
        } catch {
            fs.writeFileSync(LAST_RUN_FILE, defaultTimestamp);
            return defaultTimestamp;
        }
    }

    function writeLastRunTime(dateStr) {
        fs.writeFileSync(LAST_RUN_FILE, dateStr);
    }

    async function fetchAllContacts() {
        const token = process.env.HUBSPOT_API_KEY;
        const url = 'https://api.hubapi.com/crm/v3/objects/contacts';
        let after = null;
        const contacts = [];

        while (true) {
            const res = await axios.get(after
                ? `${url}?limit=100&after=${after}&properties=email`
                : `${url}?limit=100&properties=email`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = res.data;
            data.results.forEach(c => {
                if (c.properties?.email) {
                    contacts.push({ vid: c.id, email: c.properties.email });
                }
            });

            if (!data.paging?.next?.after) break;
            after = data.paging.next.after;
        }

        return contacts;
    }

    async function fetchMeetingsAfter(vid, after) {
        const token = process.env.HUBSPOT_API_KEY;
        const url = 'https://api.hubapi.com/crm/v3/objects/meetings/search';

        const body = {
            filterGroups: [
                {
                    filters: [
                        { propertyName: 'associations.contact', operator: 'EQ', value: vid },
                        { propertyName: 'hs_createdate', operator: 'GT', value: after }
                    ]
                }
            ],
            sorts: [{ propertyName: 'hs_createdate', direction: 'ASCENDING' }],
            properties: ['hs_meeting_start_time', 'hs_meeting_end_time'],
            limit: 100
        };

        const { data } = await axios.post(url, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return data.results || [];
    }

    // Initialize DB pool
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || ''
    });

    const lastRun = readLastRunTime();
    const contacts = await fetchAllContacts();
    let insertedRecords = 0;

    for (const contact of contacts) {
        try {
            const meetings = await fetchMeetingsAfter(contact.vid, lastRun);
            const validMeetings = meetings.filter(m => m.properties.hs_meeting_start_time && m.properties.hs_meeting_end_time);

            if (validMeetings.length === 0) {
                console.log(`No new meetings for ${contact.email}`);
                continue;
            }

            // Deduplicate meetings
            const seen = new Set();
            const uniqueMeetings = [];

            for (const m of validMeetings) {
                const key = `${m.properties.hs_meeting_start_time}_${m.properties.hs_meeting_end_time}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMeetings.push(m);
                }
            }

            const meetingCount = uniqueMeetings.length;
            const firstStart = uniqueMeetings[0].properties.hs_meeting_start_time.slice(0, 19).replace('T', ' ');
            const lastEnd = uniqueMeetings[meetingCount - 1].properties.hs_meeting_end_time.slice(0, 19).replace('T', ' ');

            // Derive period date from first meeting's date
            const periodDate = firstStart.slice(0, 10);

            try {
                await pool.query(
                    `INSERT INTO scheduled_meetings 
                     (project_name, user_id, period_date, meeting_count, email, start_time, end_time) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'smoothai',
                        contact.vid,
                        periodDate,
                        meetingCount,
                        contact.email,
                        firstStart,
                        lastEnd
                    ]
                );
                insertedRecords++;
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                    console.log(`Duplicate record skipped for ${contact.email}`);
                } else {
                    console.error(`DB error for ${contact.email}:`, e.message);
                }
            }
        } catch (err) {
            console.error(`Error processing ${contact.email}:`, err.message);
        }
    }

    console.log(`✅ Finished. Inserted summary records for ${insertedRecords} contacts.`);
    await pool.end();
    writeLastRunTime(new Date().toISOString());
})();