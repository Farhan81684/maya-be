const pool = require('../config/db.config');
const bcrypt = require('bcrypt');
const { Static } = require('../Helpers/static');
const jwt = require('jsonwebtoken');



const SeedDB = async (req, res) => {

    try {
        const conn = await pool.getConnection();
        const seedRole = `INSERT INTO role (name, role_id) VALUES ('Admin', 1);`
        await conn.query(seedRole);
        conn.release();
        return res.status(200).json({
            message: 'Seed successful',
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const KPIs = async (req, res) => {

    try {

        const conn = await pool.getConnection();
        const payload = req.body;
        const { user_id, ...rest } = payload;

        const [rows] = await conn.query(`SELECT id FROM kpi WHERE single_kpi = true LIMIT 1`);
        if (!rows?.length)
            await conn.query(`INSERT INTO kpi (single_kpi, purchase_clicks) VALUES (true, 0)`);

        const updates = Object.entries(rest)
            .map(([key, value]) => `${key} = ${key} + ${value}`)
            .join(', ');

        if (user_id) {
            const [rows] = await conn.query(
                `SELECT * FROM call_to_action_kpi WHERE user_id = ? AND type = ? LIMIT 1`,
                [user_id, 'pricing']
            );
            if (!rows?.length)
                await conn.query(`INSERT INTO call_to_action_kpi (flag, user_id, type) VALUES (?, ?, ?)`, [true, user_id, 'pricing']);
        }

        if (!updates) {
            conn.release();
            return res.status(400).json({ message: 'No valid KPI fields to update' });
        }

        const updateQuery = `UPDATE kpi SET ${updates} WHERE single_kpi = true;`;
        await conn.query(updateQuery);
        conn.release();

        return res.status(200).json({ message: 'KPI updated successfully' });

    } catch (err) {
        console.error('Error updating KPI:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const InsertKPI = async (req, res) => {

    try {
        const conn = await pool.getConnection();
        const payload = req.body;
        const { user_id, ...rest } = payload;

        // Ensure user-specific KPI is tracked
        if (user_id) {
            const [rows] = await conn.query(
                `SELECT * FROM call_to_action_kpi WHERE user_id = ? AND type = ? LIMIT 1`,
                [user_id, 'pricing']
            );
            if (!rows?.length) {
                await conn.query(
                    `INSERT INTO call_to_action_kpi (flag, user_id, type) VALUES (?, ?, ?)`,
                    [true, user_id, 'pricing']
                );
            }
        }

        if (!Object.keys(rest).length) {
            conn.release();
            return res.status(400).json({ message: 'No KPI data provided' });
        }

        // Build the insert query dynamically
        const columns = Object.keys(rest).join(', ');
        const placeholders = Object.keys(rest).map(() => '?').join(', ');
        const values = Object.values(rest);

        const insertQuery = `INSERT INTO kpi (${columns}) VALUES (${placeholders})`;
        await conn.query(insertQuery, values);

        conn.release();
        return res.status(200).json({ message: 'KPI inserted successfully' });

    } catch (err) {
        console.error('Error inserting KPI:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


const CallToAction = async (req, res) => {

    try {

        const conn = await pool.getConnection();
        const { name, email_id, email_sent, conversation_summary, talk_time } = req?.body;
        pool.query(
            `INSERT INTO call_to_action (name, email_id, email_sent, conversation_summary, talk_time)
           VALUES (?, ?, ?, ?, ?)`,
            [name, email_id, email_sent, conversation_summary, talk_time]
        )
        conn.release();
        return res.status(200).json({ message: 'KPIs updated successfully', payload: req?.body });

    } catch (err) {
        console.error('Error updating KPI:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


const GetKPIs = async (req, res) => {

    try {

        const conn = await pool.getConnection();
        const [rows] = await conn.query(`SELECT * FROM kpi WHERE single_kpi = false`);
        conn.release();

        return res.status(200).json({ kpis: rows });

    } catch (err) {
        console.error('Error updating KPI:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }

};

const GetKPIsV2 = async (req, res) => {

    try {

        let { start_date = new Date(), end_date = new Date() } = req?.query
        if (start_date)
            start_date = new Date(start_date).toISOString().slice(0, 10);
        if (end_date)
            end_date = new Date(end_date).toISOString().slice(0, 10);
        const conn = await pool.getConnection();
        const [rows] = await pool.query(
            `SELECT * FROM kpi WHERE single_kpi = false and createdAt >= ? AND createdAt <= ?`,
            [start_date, end_date]
        );
        let final = []
        if (rows?.length) {
            let count = 0;
            final = [rows[0]]
            rows?.forEach((row) => {
                count += +row?.purchase_clicks
            })
            final[0].purchase_clicks = count
        }
        if (!rows?.length)
            final = [{ purchase_clicks: 0 }]
        conn.release();
        return res.status(200).json({ kpis: final });

    } catch (err) {
        console.error('Error updating KPI:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }

};

module.exports = {
    SeedDB,
    KPIs,
    GetKPIs,
    CallToAction,
    InsertKPI,
    GetKPIsV2,
}