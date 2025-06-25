// controllers/admin/documentController.js
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
  limits: { fileSize: 10 * 1024 * 1024 }, // สูงสุด 10MB
  fileFilter: (req, file, cb) => {
    // ยอมรับเฉพาะ PDF, DOCX, XLSX, PNG, JPG
    const allowed = /\.(pdf|docx|xlsx|png|jpe?g)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error("ไฟล์นามสกุลไม่ถูกต้อง"), false);
    }
    cb(null, true);
  },
}).single("file");

// GET /api/documents
const getAllDocuments = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. ดึงข้อมูลเอกสาร พร้อมชื่อผู้ส่ง
    const [documents] = await conn.query(`
      SELECT 
        d.id,
        d.title,
        d.description,
        d.file_path AS filePath,
        d.upload_date AS uploadDate,
        d.member_id,
        m.full_name AS sender
      FROM documents d
      LEFT JOIN members m ON d.member_id = m.member_id
      ORDER BY d.upload_date DESC
    `);

    // 2. ดึงชื่อผู้รับจาก user_documents → users → members
    const [recipients] = await conn.query(`
      SELECT 
        ud.document_id,
        mem.full_name AS recipientName
      FROM user_documents ud
      JOIN users u ON ud.user_id = u.user_id
      JOIN members mem ON u.member_id = mem.member_id
    `);

    // 3. รวมชื่อผู้รับตามเอกสาร
    const recipientMap = {};
    for (const r of recipients) {
      if (!recipientMap[r.document_id]) recipientMap[r.document_id] = [];
      recipientMap[r.document_id].push(r.recipientName);
    }

    // 4. รวมผู้รับเข้าไปในผลลัพธ์
    const result = documents.map((doc) => ({
      ...doc,
      recipient: recipientMap[doc.id]?.join(", ") || "-",
    }));

    res.json(result);
  } catch (err) {
    console.error("getAllDocuments error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงเอกสาร" });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/documents
// รับ body: { title, memberId, description, userIds? } + file field
// controllers/admin/documentController.js
const uploadDocument = async (req, res) => {
  const { title, memberId, description, userIds } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "ต้องแนบไฟล์ในการอัปโหลด" });
  if (!title || !memberId)
    return res.status(400).json({ error: "กรุณาระบุ title และ memberId" });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Insert เอกสารใหม่
    const [insertResult] = await conn.query(
      `INSERT INTO documents
         (title, file_path, member_id, upload_date, description)
       VALUES (?, ?, ?, NOW(), ?)`,
      [title, file.filename, memberId, description || null]
    );
    const documentId = insertResult.insertId;

    // 2) เตรียม list userIds: ถ้าไม่มีเฉพาะ userIds ใน body ให้ดึง user ทั้งหมดที่ role='user'
    let targetUserIds =
      Array.isArray(userIds) && userIds.length ? userIds : null;

    if (!targetUserIds) {
      const [users] = await conn.query(
        `SELECT user_id FROM users WHERE role = 'user'`
      );
      targetUserIds = users.map((u) => u.user_id);
    }

    // 3) Insert ลง user_documents
    if (targetUserIds.length) {
      const pairs = targetUserIds.map((uid) => [uid, documentId]);
      await conn.query(
        `INSERT INTO user_documents (user_id, document_id) VALUES ?`,
        [pairs]
      );
    }

    // 4) ดึงชื่อสมาชิกเพื่อคืน response
    const [[memberRow]] = await conn.query(
      `SELECT full_name FROM members WHERE member_id = ?`,
      [memberId]
    );

    await conn.commit();

    res.status(201).json({
      id: documentId,
      title,
      memberName: memberRow?.full_name || "ไม่ทราบชื่อ",
      uploadDate: new Date(),
      filePath: file.filename,
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

    // 1) ดึงชื่อไฟล์
    const [rows] = await conn.query(
      `SELECT file_path FROM documents WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "ไม่พบเอกสาร" });
    }

    // 2) ลบไฟล์จริง
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      rows[0].file_path
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // 3) ลบเรคอร์ดจาก user_documents และ documents
    await conn.query(`DELETE FROM user_documents WHERE document_id = ?`, [id]);
    await conn.query(`DELETE FROM documents WHERE id = ?`, [id]);

    await conn.commit();
    res.json({ message: "ลบเอกสารแล้ว" });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("deleteDocument error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบ" });
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
