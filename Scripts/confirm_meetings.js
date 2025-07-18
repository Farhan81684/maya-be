// cron_confirm_meetings_db.js
(async () => {

    require('dotenv').config();
    const mysql = require('mysql2/promise');

    function formatToMySQLDatetime(input) {
        return new Date(input).toISOString().slice(0, 19).replace('T', ' ');
    }

    // Create a MySQL connection pool using environment variables
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || ''
    });

    const [confirmations] = await pool.query(
        'SELECT * FROM confirmation_queue WHERE processed = 0 ORDER BY created_at ASC LIMIT 100'
    );

    if (confirmations.length === 0) {
        console.log('No confirmations to process.');
        await pool.end();
        return;
    }

    const periodDate = new Date().toISOString().slice(0, 10);

    for (const item of confirmations) {
        try {
            await pool.query(
                `INSERT INTO scheduled_meetings 
          (project_name, user_id, period_date, meeting_count, email, start_time, end_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.project_name,
                    item.user_id,
                    periodDate,
                    1,
                    item.email,
                    formatToMySQLDatetime(item.start_time),
                    formatToMySQLDatetime(item.end_time)
                ]
            );

            // Mark as processed
            await pool.query('UPDATE confirmation_queue SET processed = 1 WHERE id = ?', [item.id]);
            console.log(`Processed confirmation for ${item.email} @ ${item.start_time}`);

        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log(`Duplicate confirmation skipped for ${item.email} @ ${item.start_time}`);
                // Mark duplicate as processed to avoid reprocessing
                await pool.query('UPDATE confirmation_queue SET processed = 1 WHERE id = ?', [item.id]);
            } else {
                console.error(`Error processing confirmation id ${item.id}:`, err.message);
                // Do not mark processed to retry later
            }
        }
    }

    await pool.end();
})()