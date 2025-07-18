require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Create a pooled MySQL connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// (Optional) Ensure tables exist. In production, you might manage
// migrations separately rather than doing this at runtime.
async function initDB() {
  try {
    const createConversationTable = `
      CREATE TABLE IF NOT EXISTS conversation_analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        period_date DATE NOT NULL,
        conversation_count INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    const createMeetingsTable = `
      CREATE TABLE IF NOT EXISTS scheduled_meetings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        period_date DATE NOT NULL,
        meeting_count INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    const createTalkTimeTable = `
      CREATE TABLE IF NOT EXISTS talk_time (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        period_date DATE NOT NULL,
        total_talk_time INT NOT NULL,
        avg_talk_time INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    // purchase rate
    const createConversionTable = `
      CREATE TABLE IF NOT EXISTS conversion_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        period_date DATE NOT NULL,
        purchase_rate DECIMAL(5,2) NOT NULL,
        meeting_rate DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    const connection = await pool.getConnection();
    await connection.query(createConversationTable);
    await connection.query(createMeetingsTable);
    await connection.query(createTalkTimeTable);
    await connection.query(createConversionTable);
    connection.release();
    console.log('All tables ensured/created successfully');
  } catch (err) {
    console.error('Error initializing the database:', err);
  }
}

// Call initDB on startup
initDB();

/* 
  ================
   ROUTE EXAMPLES
  ================
*/

/**
 * 1. Conversations
 * POST /api/conversations
 * GET /api/conversations
 * GET /api/conversations/:id
 * PUT /api/conversations/:id
 * DELETE /api/conversations/:id
 */

// POST - Add conversation analytics entry
app.post('/api/conversations', async (req, res) => {
  try {
    const { project_name, period_date, conversation_count } = req.body;
    const [result] = await pool.query(
      `INSERT INTO conversation_analytics (project_name, period_date, conversation_count)
       VALUES (?, ?, ?)`,
      [project_name, period_date, conversation_count]
    );
    res.status(201).json({ id: result.insertId, message: 'Conversation data added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add conversation data' });
  }
});

// GET - Fetch all conversation analytics
app.get('/api/conversations', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM conversation_analytics`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation data' });
  }
});

// GET - Fetch a single conversation entry by ID
app.get('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT * FROM conversation_analytics WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Conversation data not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation data' });
  }
});

// PUT - Update a conversation entry
app.put('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, period_date, conversation_count } = req.body;
    const [result] = await pool.query(
      `UPDATE conversation_analytics
       SET project_name = ?, period_date = ?, conversation_count = ?
       WHERE id = ?`,
      [project_name, period_date, conversation_count, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Conversation data not found' });
    }
    res.json({ message: 'Conversation data updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update conversation data' });
  }
});

// DELETE - Remove a conversation entry
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`DELETE FROM conversation_analytics WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Conversation data not found' });
    }
    res.json({ message: 'Conversation data deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation data' });
  }
});


/**
 * 2. Scheduled Meetings
 * (Similar pattern to "Conversations")
 */

// POST - Add scheduled meeting
app.post('/api/scheduled-meetings', async (req, res) => {
  try {
    const { project_name, period_date, meeting_count } = req.body;
    const [result] = await pool.query(
      `INSERT INTO scheduled_meetings (project_name, period_date, meeting_count)
       VALUES (?, ?, ?)`,
      [project_name, period_date, meeting_count]
    );
    res.status(201).json({ id: result.insertId, message: 'Meeting data added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add meeting data' });
  }
});

// GET all scheduled meetings
app.get('/api/scheduled-meetings', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM scheduled_meetings`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch meeting data' });
  }
});

// ...and so on (GET by ID, PUT, DELETE) similarly.


/**
 * 3. Talk Time
 * (Similar pattern again)
 */

// POST - Add talk time record
app.post('/api/talk-time', async (req, res) => {
  try {
    const { project_name, period_date, total_talk_time, avg_talk_time } = req.body;
    const [result] = await pool.query(
      `INSERT INTO talk_time (project_name, period_date, total_talk_time, avg_talk_time)
       VALUES (?, ?, ?, ?)`,
      [project_name, period_date, total_talk_time, avg_talk_time]
    );
    res.status(201).json({ id: result.insertId, message: 'Talk time data added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add talk time data' });
  }
});

// GET - talk time
app.get('/api/talk-time', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM talk_time`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch talk time data' });
  }
});

// ...and so on for PUT, DELETE.


/**
 * 4. Conversion Rates
 */

// POST - Add conversion rate
app.post('/api/conversion-rates', async (req, res) => {
  try {
    const { project_name, period_date, purchase_rate, meeting_rate } = req.body;
    const [result] = await pool.query(
      `INSERT INTO conversion_rates (project_name, period_date, purchase_rate, meeting_rate)
       VALUES (?, ?, ?, ?)`,
      [project_name, period_date, purchase_rate, meeting_rate]
    );
    res.status(201).json({ id: result.insertId, message: 'Conversion rate data added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add conversion rate data' });
  }
});

// GET - conversion rates
app.get('/api/conversion-rates', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM conversion_rates`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversion rate data' });
  }
});

// ...and so on for GET by ID, PUT, DELETE.


/* ===========================
   START THE EXPRESS SERVER
   =========================== */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Analytics server running on port ${PORT}`);
});
