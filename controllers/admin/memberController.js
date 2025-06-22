// src/controllers/admin/memberController.js

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx"); // ใช้ตัวแปร xlsx
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

// ฟังก์ชันนำเข้าข้อมูลสมาชิกจาก Excel
const importMembersFromExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const filePath = req.file.path;
  let conn;
  let successCount = 0;

  try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    for (const row of rows) {
      const {
        member_id,
        prefix,
        full_name,
        nickname,
        id_card,
        birthday,
        age,
        gender,
        religion,
        medical_conditions,
        allergy_history,
        address,
        phone,
        facebook,
        instagram,
        line_id,
        school,
        graduation_year,
        gpa,
        type,
        district,
      } = row;

      const [result] = await conn.query(
        `INSERT IGNORE INTO members (
          member_id, prefix, full_name, nickname, id_card, birthday, age, gender,
          religion, medical_conditions, allergy_history, address, phone, facebook,
          instagram, line_id, school, graduation_year, gpa, type, district
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          member_id,
          prefix,
          full_name,
          nickname,
          id_card,
          birthday ? new Date(birthday) : null,
          age,
          gender,
          religion,
          medical_conditions,
          allergy_history,
          address,
          phone,
          facebook,
          instagram,
          line_id,
          school,
          graduation_year,
          gpa,
          type,
          district,
        ]
      );

      if (result.affectedRows > 0) successCount++;
    }

    await conn.commit();
    res.json({ message: "Import users successfully", count: successCount });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to import Excel." });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (conn) conn.release();
  }
};

// เพิ่มสมาชิกทีละคน
const addMember = async (req, res) => {
  const member = req.body;
  try {
    const conn = await pool.getConnection();

    await conn.query(
      `INSERT INTO members 
        (member_id, prefix, full_name, nickname, id_card, birthday, age, gender, religion, medical_conditions, allergy_history, address, phone, facebook, instagram, line_id, school, graduation_year, gpa, type, district)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

// ลบสมาชิก
const deleteMember = async (req, res) => {
  const memberId = req.params.memberId;
  try {
    const conn = await pool.getConnection();
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
  importMembersFromExcel, // <- ชื่อฟังก์ชันตรงกับ export
  addMember,
  updateMember,
  deleteMember,
};
