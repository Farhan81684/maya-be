const pool = require('../config/db.config');

exports.createTalkTime = async (req, res) => {

  try {

    const { project_name, period_date, user_id, conversation_id } = req.body;
    const startTime = new Date();
    const periodDate = period_date || new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT * FROM talk_time WHERE user_id = ? AND period_date = ?`, [user_id, periodDate]);
    // const [[rows], [rowsAll]] = await Promise.all([pool.query(`SELECT * FROM talk_time WHERE user_id = ? AND period_date = ?`, [user_id, periodDate]),
    //   pool.query(`SELECT * FROM talk_time_all WHERE user_id = ? AND period_date = ?`, [user_id, periodDate])]);
    if (rows.length > 0) {
      // await pool.query(
      //   `UPDATE talk_time SET start_time = ? WHERE id = ?`,
      //   [startTime, rows[0].id]
      // );
      await Promise.all([
        await pool.query(
          `UPDATE talk_time SET start_time = ? WHERE id = ?`,
          [startTime, rows[0].id]
        ),
        pool.query(
          `INSERT INTO talk_time_all (project_name, period_date, start_time, user_id, conversation_id)
           VALUES (?, ?, ?, ?, ?)`,
          [project_name, periodDate, startTime, user_id, conversation_id]
        )
      ]);
      return res.json({ message: 'Talk time session added successfully' });
    }

    // const [result] = await pool.query(
    //   `INSERT INTO talk_time (project_name, period_date, start_time, user_id)
    //    VALUES (?, ?, ?, ?)`,
    //   [project_name, periodDate, startTime, user_id]
    // );
    const [[result, resultAll]] = await Promise.all([
      pool.query(
        `INSERT INTO talk_time (project_name, period_date, start_time, user_id, conversation_id)
         VALUES (?, ?, ?, ?, ?)`,
        [project_name, periodDate, startTime, user_id, conversation_id]
      ),
      pool.query(
        `INSERT INTO talk_time_all (project_name, period_date, start_time, user_id, conversation_id)
         VALUES (?, ?, ?, ?, ?)`,
        [project_name, periodDate, startTime, user_id, conversation_id]
      )
    ]);
    res.status(201).json({
      id: result.insertId,
      message: 'Talk time session added successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add talk time data' });
  }
};

// exports.endTalkTime = async (req, res) => {
//   try {
//     // const { id } = req.params;
//     const { period_date, user_id } = req.body;
//     const periodDate = period_date || new Date().toISOString().slice(0, 10);

//     // const [rows] = await pool.query(`SELECT * FROM talk_time WHERE user_id = ? AND period_date = ?`, [user_id, periodDate]);
//     const [[rows], [rowsAll]] = await Promise.all([
//       pool.query(`SELECT * FROM talk_time WHERE user_id = ? AND period_date = ?`, [user_id, periodDate]),
//       pool.query(`SELECT * FROM talk_time_all WHERE user_id = ? AND period_date = ? ORDER BY start_time DESC LIMIT 1;`, [user_id, periodDate])
//     ]);

//     if (rows.length === 0) {
//       return res.status(404).json({ error: 'Talk time record not found' });
//     }

//     // const totalTalkTime = Math.floor((new Date() - rows[0]?.start_time) / 1000);
//     const totalTalkTime = Math.floor((new Date() - new Date(rows[0].start_time)) / 1000);
//     const totalTalkTimeAll = Math.floor((new Date() - new Date(rowsAll[0].start_time)) / 1000);

//     // const [result] = await pool.query(
//     //   `UPDATE talk_time
//     //    SET total_talk_time = total_talk_time + ?
//     //    WHERE user_id = ? AND period_date = ?`,
//     //   [totalTalkTime, user_id, periodDate]
//     // );
//     const [[result], [resultAll]] = await Promise.all([
//       pool.query(
//         `UPDATE talk_time
//           SET total_talk_time = total_talk_time + ?
//           WHERE user_id = ? AND period_date = ?`,
//         [totalTalkTime, user_id, periodDate]
//       ),
//       pool.query(
//         `UPDATE talk_time_all
//          SET total_talk_time = total_talk_time + ?
//          WHERE id = ?`,
//         [totalTalkTimeAll, rowsAll[0].id]
//       )
//     ]);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: 'Talk time record not found' });
//     }
//     res.json({ message: 'Talk time data updated successfully' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to update talk time data' });
//   }
// };

exports.endTalkTime = async (req, res) => {
  try {
    const { period_date, user_id } = req.body;
    const periodDate = period_date || new Date().toISOString().slice(0, 10);

    // Get current active session and latest talk_time_all entry
    const [[rows], [rowsAll]] = await Promise.all([
      pool.query(
        `SELECT * FROM talk_time WHERE user_id = ? AND period_date = ?`,
        [user_id, periodDate]
      ),
      pool.query(
        `SELECT * FROM talk_time_all WHERE user_id = ? AND period_date = ? ORDER BY start_time DESC LIMIT 1`,
        [user_id, periodDate]
      )
    ]);

    // No record found
    if (rows.length === 0 || rowsAll.length === 0) {
      return res.status(404).json({ error: 'Talk time record not found' });
    }

    const currentTime = new Date();

    const totalTalkTime = Math.floor((currentTime - new Date(rows[0].start_time)) / 1000);
    const totalTalkTimeAll = Math.floor((currentTime - new Date(rowsAll[0].start_time)) / 1000);

    await Promise.all([
      pool.query(
        `UPDATE talk_time
         SET total_talk_time = ?
         WHERE user_id = ? AND period_date = ?`,
        [totalTalkTime, user_id, periodDate]
      ),
      pool.query(
        `UPDATE talk_time_all
         SET total_talk_time = ?
         WHERE id = ?`,
        [totalTalkTimeAll, rowsAll[0].id]
      )
    ]);

    res.json({ message: 'Talk time data updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update talk time data' });
  }
};

exports.getTalkTimeByRange = async (req, res) => {
  try {
    let { project_names, start_date, end_date, all } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);
    if (all) {
      const [rows] = await pool.query(`SELECT * FROM talk_time_all WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
      return res.json(rows);
    }
    const [rows] = await pool.query(`SELECT total_talk_time, period_date, project_name, conversation_id FROM talk_time WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
    // const [rows] = await pool.query(`SELECT * FROM talk_time WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
    // if (rows.length === 0) {
    //   return res.status(404).json({ error: 'No talk time data found' });
    // }
    // Process the rows
    console.log({ rows })
    let total = {};
    rows.forEach((row) => {
      const { project_name, total_talk_time } = row;
      if (!total[project_name]) {
        total[project_name] = 0;
      }
      total[project_name] += total_talk_time;
    });
    project_names.forEach((project_name) => {
      if (!total[project_name]) {
        total[project_name] = 0;
      }
    });

    return res.json(total);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch talk time data' });
  }
};

exports.getTalkTimeByRangeCSV = async (req, res, next) => {

  try {

    let { project_names, start_date, end_date, all } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);
    if (all) {
      const [rows] = await pool.query(`SELECT * FROM talk_time_all WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
      res.locals.data = rows;
      res.locals.fileName = 'talk_time_all';
      return next();
    }
    const [rows] = await pool.query(`SELECT total_talk_time, period_date, project_name, conversation_id FROM talk_time WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
    let total = {};
    rows.forEach((row) => {
      const { project_name, total_talk_time } = row;
      if (!total[project_name]) {
        total[project_name] = 0;
      }
      total[project_name] += total_talk_time;
    });
    project_names.forEach((project_name) => {
      if (!total[project_name]) {
        total[project_name] = 0;
      }
    });
    res.locals.data = total;
    res.locals.fileName = 'talk_time';
    return next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch talk time data' });
  }
};

exports.getAllTalkTime = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM talk_time`);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch talk time data' });
  }
};

exports.GetCallToAction = async (req, res) => {

  try {

    let { limit = 10, offset = 0, start_date = null, end_date = null } = req.query;
    if (start_date)
      start_date = new Date(start_date).toISOString().slice(0, 10);
    if (end_date)
      end_date = new Date(end_date).toISOString().slice(0, 10);

    let email_count = 0
    if (start_date && end_date) {
      const [rows] = await pool.query(
        `SELECT * FROM call_to_action WHERE createdAt >= ? AND createdAt <= ? ORDER BY id DESC LIMIT ? OFFSET ?`,
        [start_date, end_date, Number(limit), Number(offset)]
      );
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM call_to_action WHERE createdAt >= ? AND createdAt <= ?`,
        [start_date, end_date]
      );
      rows?.forEach((row) => {
        if (row?.email_sent)
          email_count += 1
      })
      return res.json({ data: rows, total, email_count });
    }
    const [rows] = await pool.query(
      `SELECT * FROM call_to_action  order by id desc LIMIT ? OFFSET ?`, [Number(limit), Number(offset)]
    );
    rows?.forEach((row) => {
      if (row?.email_sent)
        email_count += 1
    })
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM call_to_action`);
    res.json({ data: rows, total, email_count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch talk time data' });
  }
};

exports.GetCallToActionCSV = async (req, res, next) => {

  try {

    let { limit = 10, offset = 0, start_date = null, end_date = null } = req.query;
    let email_count = 0
    if (start_date)
      start_date = new Date(start_date).toISOString().slice(0, 10);
    if (end_date)
      end_date = new Date(end_date).toISOString().slice(0, 10);
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM call_to_action`);
    if (start_date && end_date) {
      const [rows] = await pool.query(
        `SELECT * FROM call_to_action WHERE createdAt >= ? AND createdAt <= ? ORDER BY id DESC LIMIT ? OFFSET ?`,
        [start_date, end_date, Number(limit), Number(offset)]
      );
      rows?.forEach((row) => {
        if (row?.email_sent)
          email_count += 1
      })
      let final = [{ 'Total Conversations': total, 'Emails Sent': email_count }, ...rows]
      res.locals.data = final;
      res.locals.fileName = 'call_to_action';
      console.log("here1")
      return next()
    }
    else {
      const [rows] = await pool.query(
        `SELECT * FROM call_to_action  order by id desc LIMIT ? OFFSET ?`, [Number(limit), Number(offset)]
      );
      rows?.forEach((row) => {
        if (row?.email_sent)
          email_count += 1
      })
      let final = [{ 'Total Conversations': total, 'Emails Sent': email_count }, ...rows]
      res.locals.data = final;
      res.locals.fileName = 'call_to_action';
      return next()
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch talk time data' });
  }
};