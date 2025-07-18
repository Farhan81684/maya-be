const pool = require('../config/db.config');
const bcrypt = require('bcrypt');
const { Static } = require('../Helpers/static');
const jwt = require('jsonwebtoken');


const Error = (res, json = {}, status = 200) => res.status(409).json(json);

const Login = async (req, res) => {

    const { email_address, password } = req.body;

    try {
        const conn = await pool.getConnection();

        const [rows] = await conn.query(
            'SELECT id, password, name, role_id, profile_pic_url FROM user WHERE email_address = ?',
            [email_address]
        );
        conn.release();
        if (!rows?.length)
            return res.status(404).json({ message: "User doesn't exist!" });

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch)
            return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, email_address: user.email_address, role_id: user.role_id },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        await pool.query('DELETE FROM session WHERE user_id = ?', [user.id]);

        await pool.query(
            `INSERT INTO session (user_id, jwt_token, createdAt, updatedAt)
            VALUES (?, ?, NOW(), NOW())`,
            [user.id, token]
        );

        return res.status(200).json({
            message: 'Login successful',
            user,
            access_token: token
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const UpdateProfile = async (req, res) => {

    const { id: user_id } = req?.headers?.User
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0)
        return res.status(400).json({ message: 'No data provided for update' });


    const allowedFields = ['name', 'profile_pic_url', 'first_login'];
    const fieldsToUpdate = [];
    const values = [];

    for (const field of allowedFields) {
        if (updates.hasOwnProperty(field)) {
            fieldsToUpdate.push(`${field} = ?`);
            values.push(updates[field]);
        }
    }

    if (!fieldsToUpdate?.length)
        return res.status(400).json({ message: 'No valid fields to update' });

    values.push(user_id);

    const query = `UPDATE user SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;

    try {

        const [result] = await pool.execute(query, values);

        if (!result?.affectedRows)
            return res.status(404).json({ message: 'User not found or no change made' });

        return res.status(200).json({ message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ message: 'Internal server error', error: error?.message });
    }

}

const GetProfile = async (req, res) => {

    try {

        const { id: user_id } = req?.headers?.User
        const [rows] = await pool.execute(
            'SELECT id, name, email_address, profile_pic_url, provider, status, role_id, first_login FROM user WHERE id = ?',
            [user_id]
        );

        if (!rows?.length)
            return res.status(404).json({ message: 'User not found' });

        return res.status(200).json({ user: rows[0] });

    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }

}

const ChangePassword = async (req, res) => {

    const { id: user_id } = req?.headers?.User;
    const { old_password, password, confirm_password } = req.body;

    if (!old_password || !password || !confirm_password)
        return res.status(400).json({ message: 'All fields are required' });

    if (password !== confirm_password)
        return res.status(400).json({ message: 'Passwords do not match' });

    try {

        const [rows] = await pool.execute('SELECT password FROM user WHERE id = ?', [user_id]);
        const currentHashedPassword = rows[0].password;

        const isMatch = await bcrypt.compare(old_password, currentHashedPassword);
        if (!isMatch)
            return res.status(403).json({ message: 'Old password is incorrect' });

        const newHashedPassword = await bcrypt.hash(password, 10);

        await pool.execute('UPDATE user SET password = ? WHERE id = ?', [newHashedPassword, user_id]);

        res.status(200).json({ message: 'Password updated successfully' });
    }
    catch (exc) {
        res.status(500).json({ message: 'An Error Occured!', error: exc?.message });
    }
}

const Signup = async (req, res) => {

    const { email_address, password, name } = req.body;

    try {

        const conn = await pool.getConnection();
        const [users] = await conn.query('SELECT id FROM user WHERE email_address = ?', [email_address]);

        if (users?.length) {
            conn.release();
            return Error(res, { message: "Email Already Registered!" }, 409)
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await conn.query(`
            INSERT INTO user (email_address, password, name, role_id, status, first_login)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [email_address, hashedPassword, name, Static.roles.SUPER_ADMIN, Static.users.status.CONFIRMED, true]
        );

        conn.release();

        return res.status(201).json({ message: 'Signup successful', user_id: result.insertId });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }

}

const CreateAdmin = async (req, res) => {

    const { email_address, password, name, profile_pic_url = null } = req.body;

    try {

        const conn = await pool.getConnection();
        const [users] = await conn.query('SELECT id FROM user WHERE email_address = ?', [email_address]);

        if (users?.length) {
            conn.release();
            return Error(res, { message: "Email Already Registered!" }, 409)
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await conn.query(`
            INSERT INTO user (email_address, password, name, role_id, status, first_login, profile_pic_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
           [email_address, hashedPassword, name, Static.roles.ADMIN, Static.users.status.CONFIRMED, true, profile_pic_url] 
        );

        conn.release();

        return res.status(201).json({ message: 'Admin Creation successful', user_id: result.insertId });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }

}

const GetAdmins = async (req, res) => {

    try {

        const conn = await pool.getConnection();
        const [admins] = await conn.query('SELECT * FROM user WHERE role_id = ?', [Static.roles.ADMIN]);
        conn.release();

        return res.status(200).json({ admins });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }

}

const DeleteAdmin = async (req, res) => {

    try {

        const { id: admin_id } = req?.params;
        const conn = await pool.getConnection();
        const [admins] = await conn.query('DELETE FROM user WHERE id = ?', [admin_id]);
        conn.release();

        return res.status(200).json({ message: 'Admin deleted!' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }

}

const UpdateAdminProfile = async (req, res) => {

    const updates = req.body;
    const { id: user_id } = req?.params;

    if (!updates || Object.keys(updates).length === 0)
        return res.status(400).json({ message: 'No data provided for update' });

    const allowedFields = ['name', 'profile_pic_url', 'first_login'];
    const fieldsToUpdate = [];
    const values = [];

    for (const field of allowedFields) {
        if (updates.hasOwnProperty(field)) {
            fieldsToUpdate.push(`${field} = ?`);
            values.push(updates[field]);
        }
    }

    if (!fieldsToUpdate?.length)
        return res.status(400).json({ message: 'No valid fields to update' });

    values.push(user_id);

    const query = `UPDATE user SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;

    try {

        const [result] = await pool.execute(query, values);

        if (!result?.affectedRows)
            return res.status(404).json({ message: 'User not found or no change made' });

        return res.status(200).json({ message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ message: 'Internal server error', error: error?.message });
    }

}
module.exports = {
    Login,
    Signup,
    ChangePassword,
    UpdateProfile,
    GetProfile,
    CreateAdmin,
    UpdateAdminProfile,
    GetAdmins,
    DeleteAdmin,
}