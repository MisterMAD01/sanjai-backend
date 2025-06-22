// controllers/user/myDocumentController.js
const path = require("path");
const pool = require("../../config/db");

// GET /api/my-documents
exports.getMyDocuments = async (req, res) => {
  const memberId = req.user.memberId; // ใช้ memberId จาก token
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT 
         d.id, d.title, d.file_path AS filePath, d.upload_date AS uploadDate,
         u.username AS sender
       FROM documents d
       JOIN users u ON d.member_id = u.member_id
       WHERE d.member_id = ?
       ORDER BY d.upload_date DESC`,
      [memberId]
    );
    res.json(rows);
  } finally {
    conn.release();
  }
};

exports.downloadMyDocument = async (req, res) => {
  const memberId = req.user.memberId;
  const docId = req.params.docId;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT file_path FROM documents
       WHERE id = ? AND member_id = ?`,
      [docId, memberId]
    );
    if (rows.length === 0)
      return res.status(403).json({ message: "Access denied" });

    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      rows[0].file_path
    );
    res.download(filePath);
  } finally {
    conn.release();
  }
};
