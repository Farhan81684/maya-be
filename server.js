require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const pool = require('./config/db.config'); // Our MySQL pool
const path = require('path')

const app = express();
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));




// Route imports
const conversationRoutes = require('./routes/conversations');
const scheduledMeetingsRoutes = require('./routes/scheduledMeetings');
const talkTimeRoutes = require('./routes/talkTime');
const conversionsRoutes = require('./routes/conversions');
const screeningFormRoutes = require('./routes/screeningForm.routes');
const auth = require('./routes/auth');
const util = require('./routes/util');


// Mount routes
app.use('/server/conversations', conversationRoutes);

app.use('/server/scheduled-meetings', scheduledMeetingsRoutes);

app.use('/server/talk-time', talkTimeRoutes);

app.use('/server/conversions', conversionsRoutes);

app.use('/server/auth', auth);

app.use('/server/util', util);

app.use('/server/screening-form', screeningFormRoutes);


//test
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to the Analytics API!' });
});

// app.post('/server/calendly', (req, res) => {
//   // Log the payload for debugging
//   console.log('Received Calendly webhook:', req.body);

//   // (Optional) Validate the webhook signature here if you want to verify authenticity.
//   // Example: 
//   // const signature = req.headers['calendly-signature'];
//   // if (!verifySignature(req.body, signature, process.env.CALENDLY_SIGNING_SECRET)) {
//   //   return res.sendStatus(401);
//   // }

//   // Process the event data as needed
//   // For instance, you might extract the invitee URL to fetch more detailed information:
//   // const inviteeURL = req.body.payload.invitee ? req.body.payload.invitee.uri : null;

//   res.sendStatus(200); // Respond with 200 OK to acknowledge receipt
// });

// app.use('/server', (req, res) => {
//   res.status(200).json({ message: 'Welcome to the Analytics API!' });
// });

// const crypto = require('crypto');

// app.post('/server/hubspot-webhook', (req, res) => {
//   const signature = req.headers['x-hubspot-signature-v3'];
//   const clientSecret = process.env.HUBSPOT_SECRET_KEY;
//   const requestBody = JSON.stringify(req.body);
//   const httpMethod = 'POST';
//   const requestUri = '/hubspot-webhook';

//   const sourceString = httpMethod + requestUri + requestBody;
//   const hash = crypto.createHmac('sha256', clientSecret).update(sourceString).digest('base64');

//   if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))) {
//     console.log('Valid webhook signature.');
//     // process webhook payload
//   } else {
//     console.log('Invalid signature.');
//     return res.status(401).send('Invalid signature');
//   }

//   res.status(200).send('Webhook received');
// });

app.post('/server/hubspot-webhook', async (req, res) => {
  try {
    const events = req.body;
    // console.log('webhook events:', events);
    const vid = events?.vid || events?.properties?.hs_object_id?.value || events['canonical-vid'];
    const email = events?.properties?.email?.value;
    const periodDate = new Date().toISOString().slice(0, 10);

    // const { startTime, endTime } = await fetchMeetingStart(vid);
    const { startTime, endTime } = await fetchLatestMeeting(vid);
    console.log('startTime: ', startTime, 'email: ', email, 'periodDate: ', periodDate);

    const [rows] = await pool.query(`SELECT * FROM scheduled_meetings_copy WHERE email = ? AND start_time = ?`, [email, startTime]);
    if (rows.length > 0) {
      return res.status(200).send('Webhook received');
    }

    await pool.query(
      `INSERT INTO scheduled_meetings_copy (period_date, meeting_count, email, start_time, end_time) VALUES (?, ?, ?, ?, ?)`,
      [periodDate, 1, email, startTime.slice(0, 19).replace('T', ' '), endTime.slice(0, 19).replace('T', ' ')]
    );

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Error in /server/hubspot-webhook', error?.message || error);
  }
});

app.post('/server/hubspot-webhook-confirmation', async (req, res) => {
  try {
    const { project_name, user_id, start_time, end_time, email } = req.body;
    const periodDate = new Date().toISOString().slice(0, 10);
    const startTime = new Date(start_time).toISOString().slice(0, 19).replace('T', ' ');
    const endTime = new Date(end_time).toISOString().slice(0, 19).replace('T', ' ');

    await pool.query(
      `INSERT INTO scheduled_meetings (project_name, user_id, period_date, meeting_count, email, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [project_name, user_id, periodDate, 1, email, startTime, endTime]
    );
    res.json({ message: 'Scheduled meeting created successfully!' });
  } catch (error) {
    console.error('Error in /server/hubspot-webhook-confirmation: ', error?.message || error);
    res.status(500).json({ error: 'Failed to validate hubspot webhooks data!' });
  }
});

// async function fetchMeetingStart(vid) {
//   try {
//     const token = process.env.HUBSPOT_API_KEY;
//     const { data:assocData } = await axios.get(
//       `https://api.hubapi.com/crm/v3/objects/contacts/${vid}/associations/meetings?archived=false`,
//       { headers: { Authorization: `Bearer ${token}` } }
//     );
//     console.log('assoc api data: ', assocData);
//     const latestMeetingId = assocData?.results[assocData?.results?.length-1]?.id;
//     console.log('meetingId: ', latestMeetingId, typeof(latestMeetingId));
//     const { data } = await axios.get(
//       `https://api.hubapi.com/crm/v3/objects/meetings/${latestMeetingId}?properties=hs_meeting_start_time,hs_meeting_end_time,hs_meeting_title&archived=false`,
//       { headers: { Authorization: `Bearer ${token}` } }
//     );
//     console.log('hubspot api data: ', data);
//     return { startTime: data.properties.hs_meeting_start_time, endTime: data.properties.hs_meeting_end_time };
//   } catch (error) {
//     console.error('Error in fetchMeetingStart: ', error?.response?.data || error?.message || error);
//   }
// }
// fetchMeetingStart('104474914536');

async function fetchLatestMeeting(vid) {
  // 1) Build endpoint and token
  const token = process.env.HUBSPOT_API_KEY;
  const url = 'https://api.hubapi.com/crm/v3/objects/meetings/search';

  // 2) Construct search payload
  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'associations.contact',
            operator: 'EQ',
            value: vid
          }
        ]
      }
    ],
    sorts: [
      {
        propertyName: 'hs_createdate',
        direction: 'DESCENDING'
      }
    ],
    properties: [
      'hs_meeting_start_time',
      'hs_meeting_end_time'
    ],
    limit: 1
  };

  try {
    // 3) POST to the Search API
    const { data } = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('data new api: ', data);

    // 4) Extract the single hit (if any)
    const hit = data.results?.[0];
    if (!hit) return null;

    console.log('new data: ', {
      startTime: hit.properties.hs_meeting_start_time,
      endTime: hit.properties.hs_meeting_end_time
    });

    return {
      startTime: hit.properties.hs_meeting_start_time,
      endTime: hit.properties.hs_meeting_end_time
    };
  } catch (err) {
    console.error('Error fetching latest meeting:', err.response?.data || err.message);
    throw err;
  }
}


app.use('/server', (req, res) => {
  res.status(200).json({ message: 'Welcome to the Analytics API!' });
});


// OPTIONAL: Initialize / ensure DB tables exist. 
// In production, use migrations (e.g., Sequelize, Knex, etc.).
async function initDB() {
  try {
    const createConversationTable = `
        CREATE TABLE IF NOT EXISTS conversation_analytics (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          project_name VARCHAR(255) NOT NULL,
          period_date DATE NOT NULL,
          period_time DATETIME NOT NULL,
          conversation_count INT NOT NULL
        );
      `;
    const createMeetingsTable = `
        CREATE TABLE IF NOT EXISTS scheduled_meetings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          project_name VARCHAR(255),
          period_date DATE NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          email VARCHAR(255) NOT NULL,
          meeting_count INT DEFAULT 1 NOT NULL
        );
      `;
    const createMeetingsTable2 = `
        CREATE TABLE IF NOT EXISTS scheduled_meetings_copy (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255),
          project_name VARCHAR(255),
          period_date DATE NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          email VARCHAR(1000) NOT NULL,
          meeting_count INT DEFAULT 1 NOT NULL
        );
      `;
    const createTalkTimeTable = `
        CREATE TABLE IF NOT EXISTS talk_time (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          project_name VARCHAR(255) NOT NULL,
          period_date DATE NOT NULL,
          start_time DATETIME NOT NULL,
          total_talk_time INT DEFAULT 0,
          conversation_id VARCHAR(255)
        );
      `;
    const createTalkTimeAllTable = `
        CREATE TABLE IF NOT EXISTS talk_time_all (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          project_name VARCHAR(255) NOT NULL,
          period_date DATE NOT NULL,
          start_time DATETIME NOT NULL,
          total_talk_time INT DEFAULT 0,
          conversation_id VARCHAR(255)
        );
      `;
    // purchase rate
    const createConversionTable = `
        CREATE TABLE IF NOT EXISTS conversions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          project_name VARCHAR(255) NOT NULL,
          period_date DATE NOT NULL,
          purchase_count INT NOT NULL
        );
      `;
    //   const createConversionTable = `
    //     CREATE TABLE IF NOT EXISTS conversion_rates (
    //       id INT AUTO_INCREMENT PRIMARY KEY,
    //       project_name VARCHAR(255) NOT NULL,
    //       period_date DATE NOT NULL,
    //       purchase_rate DECIMAL(5,2) NOT NULL,
    //       meeting_rate DECIMAL(5,2) NOT NULL,
    //       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    //     );
    //   `;


    /* Updates */

    const Role = `CREATE TABLE IF NOT EXISTS role (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role_id INT NOT NULL UNIQUE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`
    const User = `CREATE TABLE IF NOT EXISTS user (
        id INT AUTO_INCREMENT PRIMARY KEY,
        password VARCHAR(255),
        name VARCHAR(255),
        email_address VARCHAR(255) UNIQUE,
        profile_pic_url VARCHAR(255),
        provider VARCHAR(255),
        status INT NOT NULL,
        role_id INT,
        first_login BOOLEAN DEFAULT TRUE,
        otp VARCHAR(255),
        otp_expiry DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_name (name),
        FOREIGN KEY (role_id) REFERENCES role(role_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      );`
    const Session = `
          CREATE TABLE IF NOT EXISTS session (
        id INT AUTO_INCREMENT PRIMARY KEY,
        jwt_token TEXT,
        firebase_token TEXT,
        user_id INT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );`
    const KPIs = `
       CREATE TABLE IF NOT EXISTS kpi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        single_kpi BOOLEAN DEFAULT FALSE,
        purchase_clicks INT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );`

    const CallToAction = `
       CREATE TABLE IF NOT EXISTS call_to_action (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) DEFAULT NULL,
        user_id VARCHAR(255) DEFAULT NULL,
        email_id VARCHAR(255) DEFAULT NULL,
        email_sent BOOLEAN DEFAULT FALSE,
        conversation_summary VARCHAR(2000) DEFAULT NULL,
        talk_time VARCHAR(255) DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );`
    const CallToActionKPIs = `
       CREATE TABLE IF NOT EXISTS call_to_action_kpi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        flag BOOLEAN DEFAULT FALSE,
        user_id VARCHAR(255) DEFAULT NULL,
        type VARCHAR(255) DEFAULT 'pricing',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );`

      const createScreeningFormTable = `
  CREATE TABLE IF NOT EXISTS screening_forms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    date_of_birth DATE,
    sex VARCHAR(20),
    support_text TEXT,
    therapist_history TEXT,
    emotional_score_1 INT,
    session_type_1 VARCHAR(50),
    emotional_score_2 INT,
    session_type_2 VARCHAR(50),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
`;



    const seedRole1 = `INSERT INTO role (name, role_id) VALUES ('Super Admin', 1);`
    const seedRole2 = `INSERT INTO role (name, role_id) VALUES ('Admin', 2);`
    const connection = await pool.getConnection();
    await connection.query(createConversationTable);
    await connection.query(createMeetingsTable);
    await connection.query(createMeetingsTable2);
    await connection.query(createTalkTimeTable);
    await connection.query(createTalkTimeAllTable);
    await connection.query(createConversionTable);
    await connection.query(createScreeningFormTable);


    /* Updates */
    await connection.query(Role);
    await connection.query(User);
    await connection.query(CallToAction);
    await connection.query(Session);
    await connection.query(KPIs);
    await connection.query(CallToActionKPIs);
    connection.release();

    console.log('All tables ensured/created successfully');
  } catch (err) {
    console.error('Error initializing the database:', err);
  }
}
initDB();

app.use('/images', express.static(path.join(__dirname, 'uploads')));

// const PORT = process.env.PORT || 4000;
app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Analytics server running on port ${process.env.PORT}`);
});