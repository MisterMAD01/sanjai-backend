// src/controllers/admin/memberController.js

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const mysql = require("mysql2/promise");
require("dotenv").config();

// สร้าง pool connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ตั้งค่า multer สำหรับอัปโหลดไฟล์ Excel
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const uploadSingle = multer({ storage }).single("excelFile");

// เพิ่มสมาชิกทีละคน
const addMember = async (req, res) => {
  const member = req.body;
  try {
    const conn = await pool.getConnection();

    await conn.query(
      `INSERT INTO members 
        (member_id, prefix, full_name, nickname, id_card, birthday, age, gender, religion, medical_conditions, allergy_history, address, phone, facebook, instagram, line_id, school, graduation_year, gpa, type, district,status, department)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member.member_id,
        member.prefix,
        member.full_name,
        member.nickname,
        member.id_card,
        member.birthday ? new Date(member.birthday) : null,
        member.age,
        member.gender,
        member.religion,
        member.medical_conditions,
        member.allergy_history,
        member.address,
        member.phone,
        member.facebook,
        member.instagram,
        member.line_id,
        member.school,
        member.graduation_year,
        member.gpa,
        member.type,
        member.district,
        member.status,
        member.department,
      ]
    );

    conn.release();
    res.json({ message: "Member added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add member" });
  }
};

// แก้ไขสมาชิก
const updateMember = async (req, res) => {
  const memberId = req.params.memberId;
  const member = req.body;

  try {
    const conn = await pool.getConnection();

    const [result] = await conn.query(
      `UPDATE members SET
        prefix = ?,
        full_name = ?,
        nickname = ?,
        id_card = ?,
        birthday = ?,
        age = ?,
        gender = ?,
        religion = ?,
        medical_conditions = ?,
        allergy_history = ?,
        address = ?,
        phone = ?,
        facebook = ?,
        instagram = ?,
        line_id = ?,
        school = ?,
        graduation_year = ?,
        gpa = ?,
        type = ?,
        district = ?
        status = ?,
        department = ?
      WHERE member_id = ?`,
      [
        member.prefix,
        member.full_name,
        member.nickname,
        member.id_card,
        member.birthday ? new Date(member.birthday) : null,
        member.age,
        member.gender,
        member.religion,
        member.medical_conditions,
        member.allergy_history,
        member.address,
        member.phone,
        member.facebook,
        member.instagram,
        member.line_id,
        member.school,
        member.graduation_year,
        member.gpa,
        member.type,
        member.district,
        memberId,
        member.status,
        member.department,
      ]
    );

    conn.release();
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    res.json({ message: "Member updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update member" });
  }
};

// ลบสมาชิก — หากมี user ที่อ้างถึง member_id ให้แจ้งก่อน
const deleteMember = async (req, res) => {
  const memberId = req.params.memberId;
  let conn;

  try {
    conn = await pool.getConnection();

    // ตรวจสอบว่ามี user ที่อ้างถึง member_id นี้หรือไม่
    const [[{ cnt }]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM users WHERE member_id = ?",
      [memberId]
    );
    if (cnt > 0) {
      return res
        .status(400)
        .json({ error: "กรุณาลบบัญชีผู้ใช้งานก่อน จึงจะลบสมาชิกได้" });
    }

    // ลบ member เมื่อไม่มี user อ้างอิง
    const [result] = await conn.query(
      "DELETE FROM members WHERE member_id = ?",
      [memberId]
    );
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    res.json({ message: "Member deleted successfully" });
  } catch (error) {
    if (conn) conn.release();
    console.error(error);
    res.status(500).json({ error: "Failed to delete member" });
  }
};

// ดึงสมาชิกทั้งหมด
const getAllMembers = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT * FROM members ORDER BY full_name ASC"
    );
    conn.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch members" });
  }
};

module.exports = {
  getAllMembers,
  uploadSingle,
  addMember,
  updateMember,
  deleteMember,
};
