const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db.config');

const getRouteFolder = (route_id, user_id = null) => {
    const RouteMap = {
        1: `Admin/${user_id}`,
        2: `User/${user_id}`
    };
    let file_route = user_id ? (RouteMap[route_id] || `Other/${user_id}`) : 'Misc/Pictures/'
    return file_route;
};

const getMulterUpload = (route_id, user_id = null) => {

    const folderPath = path.join(__dirname, '../uploads', getRouteFolder(route_id, user_id));

    fs.mkdirSync(folderPath, { recursive: true });

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, folderPath);
        },
        filename: function (req, file, cb) {
            // Use original extension, but fixed name (e.g. profile.jpg / profile.png)
            const ext = path.extname(file.originalname);
            const staticName = `profile${ext}`;
            cb(null, staticName);
        }
    });

    return multer({ storage }).single('image');
};

exports.Upload = (req, res) => {

    const { route_id = 1, id = null, } = req.query;
    const { id: user_id } = req?.headers?.User || {};

    const resolvedUserId = id || user_id;

    let upload = null
    if (route_id == 100)
        upload = getMulterUpload(route_id, null);
    else
        upload = getMulterUpload(route_id, resolvedUserId);

    upload(req, res, async function (err) {
        if (err)
            return res.status(500).json({ error: 'File upload failed', details: err.message });

        if (!req.file)
            return res.status(400).json({ error: 'No file uploaded' });

        const relativePath = `/uploads/${getRouteFolder(route_id, resolvedUserId)}/${req.file.filename}`;

        if (resolvedUserId) {
            const conn = await pool.getConnection();
            await conn.query(
                `UPDATE user SET profile_pic_url = ? WHERE id = ?`,
                [relativePath, resolvedUserId]
            );
            conn.release();
        }

        return res.status(200).json({
            message: 'Image uploaded successfully',
            filename: req.file.filename,
            path: relativePath
        });

    });
};