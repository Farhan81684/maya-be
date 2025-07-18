const pool = require('../config/db.config');

/**
 * POST - Create conversation analytics entry
 */
exports.createConversationAnalytics = async (req, res) => {
  try {
    const { project_name, period_date, user_id } = req.body;
    const periodDate = period_date || new Date().toISOString()?.slice(0, 10);
    const periodTime = new Date().toLocaleString('sv-SE');


    const [rows] = await pool.query(`SELECT * FROM conversation_analytics WHERE user_id = ? AND period_date = ?`, [user_id, periodDate]);
    if (rows.length > 0) {
      await pool.query(
        `UPDATE conversation_analytics SET conversation_count = conversation_count + 1 WHERE id = ?`,
        [rows[0].id]
      );
      return res.json({ message: 'Conversation data updated successfully' });
    }

    const [result] = await pool.query(
      `INSERT INTO conversation_analytics (project_name, period_date, conversation_count, user_id, period_time)
       VALUES (?, ?, ?, ?, ?)`,
      [project_name, periodDate, 1, user_id, periodTime]
    );
    res.status(201).json({
      id: result.insertId,
      data: result,
      message: 'Conversation data added successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add conversation data' });
  }
};

// exports.getConversationsByRange = async (req, res) => {
//   try {
//     const { project_names, start_date, end_date, yearlyChart } = req.body;
//     const startDate = new Date(start_date).toISOString().slice(0, 10);
//     const endDate = new Date(end_date).toISOString().slice(0, 10);

//     const [rows] = await pool.query(`SELECT conversation_count, period_date, project_name FROM conversation_analytics WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
//     // if (rows.length === 0) {
//     //   return res.status(404).json({ error: 'No conversation data found' });
//     // }
//     // Process the rows
//     let total = {};

//     if(!yearlyChart) {
//       rows.forEach((row) => {
//         const { project_name, conversation_count } = row;
//         if (!total[project_name]) {
//           total[project_name] = 0;
//         }
//         total[project_name] += conversation_count;
//       });
//       project_names.forEach((project_name) => {
//         if (!total[project_name]) {
//           total[project_name] = 0;
//         }
//       });
//       return res.json(total);
//     }

//     // Otherwise, return data in the "yearly" format
//     const months = [ { name: 'Jan' }, { name: 'Feb' }, { name: 'Mar' }, { name: 'Apr' }, { name: 'May' }, { name: 'Jun' }, { name: 'Jul' }, { name: 'Aug' }, { name: 'Sep' }, { name: 'Oct' }, { name: 'Nov' }, { name: 'Dec' } ];
//     months.forEach((monthObj) => {
//       project_names.forEach((projectName) => {
//         monthObj[projectName] = 0;
//       });
//     });
//     rows.forEach((row) => {
//       const date = new Date(row.period_date);
//       // getMonth() returns 0 (January) through 11 (December)
//       const monthIndex = date.getMonth();
//       months[monthIndex][row.project_name] += row.conversation_count;
//     });

//     // Return the final yearly-style data
//     return res.json(months);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch conversation data' });
//   }
// };

exports.getConversationsByRange = async (req, res) => {
  try {
    const { project_names, start_date, end_date, timeframe, yearlyChart } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT conversation_count, period_date, project_name, period_time
       FROM conversation_analytics 
       WHERE project_name IN (${project_names.map(() => '?').join(',')}) 
       AND period_date >= ? AND period_date <= ?`,
      [...project_names, startDate, endDate]
    );

    if (timeframe == 'Today') {
      let hourly = {}
      rows?.forEach((row) => {
        console.log({ row })
        let date = new Date(row?.period_time).toISOString()?.slice(11, 13)
        console.log({ date, row })
        if (hourly[`${date}`])
          hourly[`${date}`] += row?.conversation_count || 0
        else
          hourly[`${date}`] = row?.conversation_count || 0
      })
      let data = []
      for (let i = 1; i <= 24; i++) {
        let key = i < 10 ? `0${i}` : `${i}`
        if (!hourly[key])
          hourly[key] = 0
      }
      Object.keys(hourly || {}).forEach(key => data.push({ smoothai: hourly[key], name: key }))
      if (data?.length)
        data?.sort((a, b) => +a?.name - +b?.name)
      return res.json(data);
    }

    if (!yearlyChart && !timeframe) {
      let total = {};
      rows.forEach(({ project_name, conversation_count }) => {
        total[project_name] = (total[project_name] || 0) + conversation_count;
      });
      project_names.forEach((p) => total[p] = total[p] || 0);
      return res.json(total);
    }

    const { names, getLabel } = getDateRange(timeframe, start_date, end_date);
    const finalData = names.map(name => {
      const row = { name };
      project_names.forEach(name => (row[name] = 0));
      return row;
    });

    rows.forEach(({ period_date, conversation_count, project_name }) => {
      const label = getLabel(new Date(period_date));
      const labelRow = finalData.find(row => row.name === label);
      if (labelRow) {
        labelRow[project_name] += conversation_count;
      }
    });

    return res.json(finalData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversation data' });
  }
};

exports.getConversationsByRangeCSV = async (req, res, next) => {

  try {
    const { project_names, start_date, end_date, timeframe, yearlyChart } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT conversation_count, period_date, project_name, period_time
       FROM conversation_analytics 
       WHERE project_name IN (${project_names.map(() => '?').join(',')}) 
       AND period_date >= ? AND period_date <= ?`,
      [...project_names, startDate, endDate]
    );

    if (timeframe == 'Today') {
      let hourly = {}
      rows?.forEach((row) => {
        console.log({ row })
        let date = new Date(row?.period_time).toISOString()?.slice(11, 13)
        console.log({ date, row })
        if (hourly[`${date}`])
          hourly[`${date}`] += row?.conversation_count || 0
        else
          hourly[`${date}`] = row?.conversation_count || 0
      })
      let data = []
      for (let i = 1; i <= 24; i++) {
        let key = i < 10 ? `0${i}` : `${i}`
        if (!hourly[key])
          hourly[key] = 0
      }
      Object.keys(hourly || {}).forEach(key => data.push({ smoothai: hourly[key], name: key }))
      if (data?.length)
        data?.sort((a, b) => +a?.name - +b?.name)
      res.locals.data = data;
      res.locals.fileName = 'conversation_analytics';
      return next();
    }

    if (!yearlyChart && !timeframe) {
      let total = {};
      rows.forEach(({ project_name, conversation_count }) => {
        total[project_name] = (total[project_name] || 0) + conversation_count;
      });
      project_names.forEach((p) => total[p] = total[p] || 0);
      res.locals.data = total;
      res.locals.fileName = 'conversation_analytics';
      return next();
    }

    const { names, getLabel } = getDateRange(timeframe, start_date, end_date);
    const finalData = names.map(name => {
      const row = { name };
      project_names.forEach(name => (row[name] = 0));
      return row;
    });

    rows.forEach(({ period_date, conversation_count, project_name }) => {
      const label = getLabel(new Date(period_date));
      const labelRow = finalData.find(row => row.name === label);
      if (labelRow) {
        labelRow[project_name] += conversation_count;
      }
    });
    res.locals.data = total;
    res.locals.fileName = 'conversation_analytics';
    return next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversation data' });
  }
};


/**
 * GET - Retrieve all conversation analytics
 */
exports.getAllConversations = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM conversation_analytics`);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversation data' });
  }
};

/**
 * PUT - Update a conversation entry (by ID in path)
 */
exports.updateConversation = async (req, res) => {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update conversation data' });
  }
};



const getDateRange = (timeframe, start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const getDateLabel = (date) => date.getDate().toString();
  const getWeekDayLabel = (date) => (date.getDay() === 0 ? 7 : date.getDay()).toString();
  const getMonthLabel = (date) => date.toLocaleString('default', { month: 'short' });

  if (timeframe === "This Week" || timeframe === "Last Week") {
    return {
      names: ["1", "2", "3", "4", "5", "6", "7"],
      getLabel: getWeekDayLabel
    };
  }

  if (timeframe === "This Month" || timeframe === "Last Month") {
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    return {
      names: Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString()),
      getLabel: getDateLabel
    };
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (timeframe === "This Year" || timeframe === "Last Year") {
    return {
      names: months,
      getLabel: getMonthLabel
    };
  }

  if (timeframe === "This Quarter" || timeframe === "Last Quarter") {
    const month = startDate.getMonth(); // 0-11
    const quarterStartMonth = Math.floor(month / 3) * 3; // 0, 3, 6, 9
    const quarterLabels = months.slice(quarterStartMonth, quarterStartMonth + 3);
    return {
      names: quarterLabels,
      getLabel: (date) => {
        const m = date.getMonth();
        return months[m];
      }
    };
  }

  // Default fallback
  return {
    names: [],
    getLabel: () => ""
  };
};