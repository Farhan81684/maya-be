const jwt = require('jsonwebtoken');
const pool = require('./config/db.config');
const { Parser } = require("json2csv");

const VerifyFunction = async (options = {}, req, res, next) => {
  try {
    console.log("🔐 VerifyToken");
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("🔑 token:", token);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("✅ decoded:", decoded);
    } catch (err) {
      return res.status(403).json({ message: "Forbidden: Invalid token" });
    }

    const [rows] = await pool.execute("SELECT * FROM user WHERE id = ? LIMIT 1", [decoded.id]);

    if (!rows.length) return res.status(404).json({ message: "User not found" });

    req.headers.User = rows[0];
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


const ExportCSV = async (req, res) => {

    const result = res?.locals.data;
    const filename = res?.locals.fileName;

    /* Handle empty result */
    if (!result?.length)
        return res.status(200).json({ success: true, message: "No data available to export." })

    const jsonData = JSON.parse(JSON.stringify(result));
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(jsonData)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    res.status(200).end(csv)

}

const VerifyToken = (options = {}) => VerifyFunction.bind(null, options);

module.exports = {
    VerifyToken,
    ExportCSV
};
