// src/controllers/user/myDocumentController.js
const path = require("path");
const pool = require("../../config/db");
// src/controllers/user/myDocumentController.js

// GET /api/my-documents — คืนเฉพาะเอกสารที่ส่งถึงฉัน
exports.getMyDocuments = async (req, res) => {
  const memberId = req.user.memberId; // จาก middleware
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT
         d.id,
         d.title,
         d.description,
         d.file_path   AS filePath,
         d.upload_date AS uploadDate,
         m_s.full_name AS sender   -- ดึงชื่อผู้ส่ง
       FROM documents d
       JOIN members m_s ON d.member_id = m_s.member_id
       WHERE d.recipient_id = ?    -- เฉพาะที่ส่งถึงฉัน
       ORDER BY d.upload_date DESC`,
      [memberId]
    );
    res.json(rows);
  } finally {
    conn.release();
  }
};

// GET /api/my-documents/:docId (download)
// src/controllers/user/myDocumentController.js
exports.downloadMyDocument = async (req, res) => {
  const memberId = req.user.memberId;
  const docId = req.params.docId;
  const conn = await pool.getConnection();
  try {
    // ตรวจทั้ง sender หรือ recipient
    const [rows] = await conn.query(
      `SELECT file_path
       FROM documents
       WHERE id = ?
         AND (member_id = ? OR recipient_id = ?)`,
      [docId, memberId, memberId]
    );
    if (rows.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

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
exports.getOrDownloadDocument = async (req, res) => {
  const { memberId } = req.user;
  const docId = req.params.docId;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT file_path
       FROM documents
       WHERE id = ?
         AND (member_id = ? OR recipient_id = ?)`,
      [docId, memberId, memberId]
    );
    if (!rows.length) {
      return res.status(403).json({ message: "Access denied" });
    }
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      rows[0].file_path
    );
    // ถ้ามี query param ?download=1 ใช้ res.download(), มิฉะนั้นส่ง blob
    if (req.query.download === "1") {
      return res.download(filePath);
    }
    // หรืออ่านเป็น blob แล้วส่ง base64 หรือ stream กลับมา
    res.sendFile(filePath);
  } finally {
    conn.release();
  }
};
