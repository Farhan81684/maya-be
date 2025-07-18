const pool = require('../config/db.config');
const moment = require('moment');

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

exports.createScheduledMeeting = async (req, res) => {
  try {
    const { project_name, period_date, meeting_count, user_id } = req.body;
    const periodDate = period_date || new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT * FROM scheduled_meetings WHERE user_id = ? AND period_date = ?`, [user_id, periodDate]);
    if (rows.length > 0) {
      await pool.query(
        `UPDATE scheduled_meetings SET meeting_count = meeting_count + 1 WHERE id = ?`,
        [rows[0].id]
      );
      return res.json({ message: 'Scheduled meeting data updated successfully' });
    }

    const [result] = await pool.query(
      `INSERT INTO scheduled_meetings (project_name, period_date, meeting_count, user_id)
       VALUES (?, ?, ?, ?)`,
      [project_name, period_date, meeting_count || 1, user_id]
    );
    res.status(201).json({
      id: result.insertId,
      message: 'Scheduled meeting data added successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add scheduled meeting data' });
  }
};

exports.getMeetingsByRange = async (req, res) => {
  try {
    const { project_names, start_date, end_date } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT meeting_count, period_date, project_name FROM scheduled_meetings WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);
    // if (rows.length === 0) {
    //   return res.status(404).json({ error: 'No scheduled meetings data found' });
    // }
    // Process the rows
    let total = {};
    rows.forEach((row) => {
      const { project_name, meeting_count } = row;
      if (!total[project_name]) {
        total[project_name] = 0;
      }
      total[project_name] += meeting_count;
    });
    project_names.forEach((project_name) => {
      if (!total[project_name]) {
        total[project_name] = 0;
      }
    });

    return res.json(total);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch scheduled meetings data' });
  }
};

exports.getMeetingsByRangeCSV = async (req, res) => {
  try {
    const { project_names, start_date, end_date } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT meeting_count, period_date, project_name FROM scheduled_meetings WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);

    // Process the rows
    let total = {};
    rows.forEach((row) => {
      const { project_name, meeting_count } = row;
      if (!total[project_name]) {
        total[project_name] = 0;
      }
      total[project_name] += meeting_count;
    });
    project_names.forEach((project_name) => {
      if (!total[project_name]) {
        total[project_name] = 0;
      }
    });
    res.locals.data = rows;
    res.locals.fileName = 'scheduled_meetings';
    return next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch scheduled meetings data' });
  }
};

exports.GetByTimeframe = async (req, res) => {
  try {

    const { project_names, start_date, end_date, timeframe, yearlyChart } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT meeting_count, period_date, project_name, start_time
       FROM scheduled_meetings 
       WHERE project_name IN (${project_names.map(() => '?').join(',')}) 
       AND period_date >= ? AND period_date <= ?`,
      [...project_names, startDate, endDate]
    );

    if (timeframe == 'Today') {
      let hourly = {}
      rows?.forEach((row) => {
        console.log({ row })
        let date = new Date(row?.start_time).toISOString()?.slice(11, 13)
        console.log({ date, row })
        if (hourly[`${date}`])
          hourly[`${date}`] += row?.meeting_count || 0
        else
          hourly[`${date}`] = row?.meeting_count || 0
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
      rows.forEach(({ project_name, meeting_count }) => {
        total[project_name] = (total[project_name] || 0) + meeting_count;
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

    rows.forEach(({ period_date, meeting_count, project_name }) => {
      const label = getLabel(new Date(period_date));
      const labelRow = finalData.find(row => row.name === label);
      if (labelRow) {
        labelRow[project_name] += meeting_count;
      }
    });

    return res.json(finalData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversation data' });
  }
};


exports.GetGraph = async (req, res) => {
  try {

    const { project_names, start_date, end_date } = req.body;
    const startDate = new Date(start_date).toISOString().slice(0, 10);
    const endDate = new Date(end_date).toISOString().slice(0, 10);

    const [rows] = await pool.query(`SELECT meeting_count, period_date, project_name FROM scheduled_meetings WHERE project_name IN (${project_names.map(() => '?').join(',')}) AND period_date >= ? AND period_date <= ?`, [...project_names, startDate, endDate]);

    let total = {};
    rows.forEach((row) => {
      const { project_name, meeting_count } = row;
      if (!total[project_name]) {
        total[project_name] = 0;
      }
      total[project_name] += meeting_count;
    });
    project_names.forEach((project_name) => {
      if (!total[project_name]) {
        total[project_name] = 0;
      }
    });


    let datewise = {}
    rows?.forEach(row => {
      let date = moment.utc(row?.period_date).format('YYYY-MM-DD')
      let check = datewise[date]
      if (check) {
        datewise[date] += 1
      }
      else
        datewise[date] = 1
    })
    let data = []
    if (Object.keys(datewise)?.length) {
      Object.keys(datewise)?.forEach(key => {
        data.push({ date: key, meetings: datewise[key] })
      })
    }

    // return res.json(total);
    return res.json({ data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch scheduled meetings data' });
  }
};

exports.getAllScheduledMeetings = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM scheduled_meetings`);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch scheduled meetings data' });
  }
};

exports.updateScheduledMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, period_date, meeting_count } = req.body;
    const [result] = await pool.query(
      `UPDATE scheduled_meetings
       SET project_name = ?, period_date = ?, meeting_count = ?
       WHERE id = ?`,
      [project_name, period_date, meeting_count, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Scheduled meeting not found' });
    }
    res.json({ message: 'Scheduled meeting updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update scheduled meeting data' });
  }
};
