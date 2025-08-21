const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const mysql = require("mysql2/promise");
require("dotenv").config();

const SALT_ROUNDS = 10;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "..", "uploads");
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

// แสดงผู้ใช้ทั้งหมด
const getAllUsers = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT 
         u.user_id, 
         u.username, 
         u.role, 
         u.member_id, 
         m.full_name AS full_name,
         u.email, 
         u.approved, 
         u.created_at, 
         u.updated_at
       FROM users u
       LEFT JOIN members m ON u.member_id = m.member_id
       ORDER BY u.created_at DESC`
    );
    conn.release();
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// เพิ่มผู้ใช้
const addUser = async (req, res) => {
  const { username, password, role, member_id, email } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const conn = await pool.getConnection();

    // ตรวจสอบ member_id ต้องไม่เป็น null และต้องมีในตาราง members
    if (!member_id) {
      conn.release();
      return res.status(400).json({ error: "member_id is required." });
    }
    const [memberRows] = await conn.query(
      "SELECT member_id FROM members WHERE member_id = ?",
      [member_id]
    );
    if (memberRows.length === 0) {
      conn.release();
      return res
        .status(400)
        .json({ error: "Member ID does not exist. Please add member first." });
    }

    // ตรวจสอบ username ซ้ำ
    const [existing] = await conn.query(
      "SELECT user_id FROM users WHERE username = ?",
      [username]
    );
    if (existing.length > 0) {
      conn.release();
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await conn.query(
      "INSERT INTO users (username, password_hash, role, member_id, email, approved) VALUES (?, ?, ?, ?, ?, 0)",
      [username, hashedPassword, role, member_id, email || null]
    );

    conn.release();
    res.json({ message: "User added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// แก้ไขผู้ใช้
const updateUser = async (req, res) => {
  const userId = req.params.userId;
  const { username, password, role, member_id, email, approved } = req.body;

  try {
    const conn = await pool.getConnection();

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    }

    if (username) {
      const [existing] = await conn.query(
        "SELECT user_id FROM users WHERE username = ? AND user_id != ?",
        [username, userId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    const fields = [];
    const params = [];

    if (username) {
      fields.push("username = ?");
      params.push(username);
    }
    if (hashedPassword) {
      fields.push("password_hash = ?");
      params.push(hashedPassword);
    }
    if (role) {
      fields.push("role = ?");
      params.push(role);
    }
    if (member_id !== undefined) {
      fields.push("member_id = ?");
      params.push(member_id);
    }
    if (email !== undefined) {
      fields.push("email = ?");
      params.push(email);
    }
    if (approved !== undefined) {
      fields.push("approved = ?");
      params.push(approved);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(userId);

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE user_id = ?`;
    const [result] = await conn.query(sql, params);

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// ลบผู้ใช้
const deleteUser = async (req, res) => {
  const userId = req.params.userId;

  try {
    const conn = await pool.getConnection();

    const [result] = await conn.query("DELETE FROM users WHERE user_id = ?", [
      userId,
    ]);

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// อนุมัติผู้ใช้
const approveUser = async (req, res) => {
  const userId = req.params.userId;
  try {
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "UPDATE users SET approved = 1 WHERE user_id = ?",
      [userId]
    );
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User approved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// ไม่อนุมัติ / ปฏิเสธผู้ใช้
const rejectUser = async (req, res) => {
  const userId = req.params.userId;
  try {
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "UPDATE users SET approved = 0 WHERE user_id = ?",
      [userId]
    );
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User rejected successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// นำเข้าผู้ใช้จาก Excel
const importUsersFromExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No Excel file uploaded." });
  }

  try {
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      req.file.filename
    );

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const usersData = xlsx.utils.sheet_to_json(worksheet);

    const conn = await pool.getConnection();

    await conn.beginTransaction();

    try {
      for (const user of usersData) {
        if (!user.username || !user.password) continue;

        const hashedPassword = await bcrypt.hash(
          user.password.toString(),
          SALT_ROUNDS
        );

        await conn.query(
          `INSERT INTO users (username, password_hash, role, member_id, email, approved) VALUES (?, ?, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE
             password_hash=VALUES(password_hash),
             role=VALUES(role),
             member_id=VALUES(member_id),
             email=VALUES(email)`,
          [
            user.username,
            hashedPassword,
            user.role || "user",
            user.member_id || null,
            user.email || null,
          ]
        );
      }

      await conn.commit();

      res.json({
        message: "Import users successfully",
        count: usersData.length,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to import users" });
  }
};

//ดึงสมาชิกที่ยังไม่ผูกกับผู้ใช้
const getAvailableMembers = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT member_id,
       full_name,
       graduation_year
FROM members
WHERE member_id NOT IN (
  SELECT member_id
  FROM users
  WHERE member_id IS NOT NULL
)
`
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load available members" });
  }
};
module.exports = {
  uploadSingle,
  getAllUsers,
  addUser,
  updateUser,
  deleteUser,
  approveUser,
  rejectUser,
  importUsersFromExcel,
  getAvailableMembers,
};
