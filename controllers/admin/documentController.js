// src/controllers/admin/documentController.js

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../../config/db");

// ตั้งค่า multer สำหรับจัดเก็บไฟล์ พร้อมจำกัดนามสกุลและขนาดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "..", "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|docx|xlsx|png|jpe?g)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error("ไฟล์นามสกุลไม่ถูกต้อง"), false);
    }
    cb(null, true);
  },
}).single("file");

// GET /api/documents
// คืนหนึ่งแถวต่อหนึ่งคู่ (document ↔ recipient)
const getAllDocuments = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT
        d.id,
        d.title,
        d.description,
        d.file_path   AS filePath,
        d.upload_date AS uploadDate,
        m_s.full_name AS sender,
        COALESCE(m_r.full_name, '-') AS recipient
      FROM documents d
      LEFT JOIN members m_s 
        ON d.member_id    = m_s.member_id
      LEFT JOIN members m_r 
        ON d.recipient_id = m_r.member_id
      ORDER BY d.upload_date DESC, d.id
    `);
    res.json(rows);
  } catch (err) {
    console.error("getAllDocuments error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงเอกสาร" });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/documents
// รับ title, description, recipientId + file
// ผู้ส่งดึงจาก req.memberId (ตั้งโดย authMiddleware)
const uploadDocument = async (req, res) => {
  const { title, description, recipientId } = req.body;
  const file = req.file;
  const senderId = req.memberId; // ได้ค่าจาก authMiddleware

  // ตรวจสอบ input
  if (!file) {
    return res.status(400).json({ error: "ต้องแนบไฟล์ในการอัปโหลด" });
  }
  if (!title || !recipientId) {
    return res
      .status(400)
      .json({ error: "กรุณาระบุชื่อเอกสาร และเลือกผู้รับ" });
  }
  if (!senderId) {
    return res
      .status(401)
      .json({ error: "ไม่พบข้อมูลผู้ส่ง กรุณาล็อกอินใหม่" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // บันทึกเอกสารพร้อมผู้ส่งและผู้รับ
    const [insertResult] = await conn.query(
      `INSERT INTO documents
         (title, file_path, member_id, recipient_id, upload_date, description)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [title, file.filename, senderId, recipientId, description || null]
    );
    const documentId = insertResult.insertId;

    await conn.commit();

    res.status(201).json({
      id: documentId,
      title,
      filePath: file.filename,
      uploadDate: new Date(),
      senderId,
      recipientId,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("uploadDocument error:", err);
    res.status(500).json({ error: "บันทึกเอกสารล้มเหลว" });
  } finally {
    if (conn) conn.release();
  }
};

// DELETE /api/documents/:id
const deleteDocument = async (req, res) => {
  const id = req.params.id;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // หาไฟล์เก่า
    const [rows] = await conn.query(
      `SELECT file_path FROM documents WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "ไม่พบเอกสาร" });
    }

    // ลบไฟล์จริง
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      rows[0].file_path
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // ลบ record
    await conn.query(`DELETE FROM documents WHERE id = ?`, [id]);

    await conn.commit();
    res.json({ message: "ลบเอกสารแล้ว" });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("deleteDocument error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบเอกสาร" });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  getAllDocuments,
  uploadDocument,
  deleteDocument,
  upload,
};
