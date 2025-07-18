const pool = require('../config/db.config');

exports.createConversions = async (req, res) => {
  try {
    const { project_name, period_date, purchase_count, user_id } = req.body;
    const periodDate = period_date || new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT * FROM conversions WHERE user_id = ? AND period_date = ?`, [user_id, periodDate]);
    if (rows.length > 0) {
      await pool.query(
        `UPDATE conversions SET purchase_count = purchase_count + 1 WHERE id = ?`,
        [rows[0].id]
      );
      return res.json({ message: 'Conversion updated successfully' });
    }

    const [result] = await pool.query(
      `INSERT INTO conversions (project_name, period_date, purchase_count, user_id)
       VALUES (?, ?, ?, ?)`,
      [project_name, periodDate, purchase_count || 1, user_id]
    );
    res.status(201).json({
      id: result.insertId,
      message: 'Conversion data added successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add conversion data' });
  }
};

exports.getConversationsByRange = async (req, res) => {
  try {
    const { project_names, start_date, end_date } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT purchase_count, period_date, project_name FROM conversions WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
    // if (rows.length === 0) {
    //   return res.status(404).json({ error: 'No conversion data found' });
    // }
    // Process the rows
    let total = {};
    rows.forEach((row) => {
      const { project_name, purchase_count } = row;
      if (!total[project_name]) {
        total[project_name] = 0;
      }
      total[project_name] += purchase_count;
    });
    project_names.forEach((project_name) => {
      if (!total[project_name]) {
        total[project_name] = 0;
      }
    });

    return res.json(total);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversion data' });
  }
};

exports.getConversationsByRangeCSV = async (req, res, next) => {

  try {

    const { project_names, start_date, end_date } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT purchase_count, period_date, project_name FROM conversions WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);

    // Process the rows
    let total = {};
    rows.forEach((row) => {
      const { project_name, purchase_count } = row;
      if (!total[project_name]) {
        total[project_name] = 0;
      }
      total[project_name] += purchase_count;
    });
    project_names.forEach((project_name) => {
      if (!total[project_name]) {
        total[project_name] = 0;
      }
    });
    res.locals.data = total;
    res.locals.fileName = 'conversion_analytics';
    return next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversion data' });
  }
};

exports.getAllConversions = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM conversions`);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversion data' });
  }
};

exports.updateConversions = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, period_date, purchase_count } = req.body;
    const [result] = await pool.query(
      `UPDATE conversions
       SET project_name = ?, period_date = ?, purchase_count = ?
       WHERE id = ?`,
      [project_name, period_date, purchase_count, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Conversion not found' });
    }
    res.json({ message: 'Conversion updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update conversion data' });
  }
};
