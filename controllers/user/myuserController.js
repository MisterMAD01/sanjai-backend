// controllers/user/myuserController.js
const pool = require("../../config/db");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

// อ่านข้อมูลผู้ใช้
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT u.user_id,
              u.username,
              u.role,
              u.email,
              u.member_id,
              m.full_name,
              u.created_at,
              u.updated_at,
              u.approved,
              u.avatar_path
       FROM users u
       LEFT JOIN members m ON u.member_id = m.member_id
       WHERE u.user_id = ?`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้" });
    }
    const row = rows[0];
    res.json({
      profile: {
        user_id: row.user_id,
        username: row.username,
        role: row.role,
        email: row.email,
        member_id: row.member_id,
        full_name: row.full_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        approved: row.approved === 1,
        avatarUrl: row.avatar_path
          ? `${process.env.BASE_URL}/uploads/${path.basename(row.avatar_path)}`
          : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้" });
  }
};

// อัปเดตข้อมูลผู้ใช้ (username, email, password, avatar)
exports.updateCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;
    let passwordHash, avatarPath;

    // ถ้ามีรหัสผ่านใหม่ ให้ hash
    if (req.body.password) {
      passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    // ถ้ามีไฟล์ avatar มาจาก multer middleware
    if (req.file) {
      avatarPath = req.file.path;
      // (ถ้าต้องการลบไฟล์เก่าก่อน) โหลด path เก่ามา แล้ว fs.unlinkSync
      const [[old]] = await pool.execute(
        "SELECT avatar_path FROM users WHERE user_id = ?",
        [userId]
      );
      if (old?.avatar_path) {
        fs.unlink(old.avatar_path, (err) => {
          if (err) console.warn("ลบไฟล์ avatar เก่าไม่สำเร็จ:", err);
        });
      }
    }

    // สร้างคำสั่ง SQL และ parameters ตามที่มีจริง
    const fields = [];
    const params = [];
    if (username) {
      fields.push("username = ?");
      params.push(username);
    }
    if (email) {
      fields.push("email = ?");
      params.push(email);
    }
    if (passwordHash) {
      fields.push("password = ?");
      params.push(passwordHash);
    }
    if (avatarPath) {
      fields.push("avatar_path = ?");
      params.push(avatarPath);
    }
    if (fields.length === 0) {
      return res.status(400).json({ message: "ไม่มีข้อมูลให้แก้ไข" });
    }
    params.push(userId);

    await pool.execute(
      `UPDATE users SET ${fields.join(
        ", "
      )}, updated_at = NOW() WHERE user_id = ?`,
      params
    );

    // ดึงข้อมูลใหม่กลับมา
    const [rows] = await pool.execute(
      `SELECT user_id, username, role, email, member_id, created_at, updated_at, approved, avatar_path
       FROM users WHERE user_id = ?`,
      [userId]
    );
    const row = rows[0];
    res.json({
      profile: {
        user_id: row.user_id,
        username: row.username,
        role: row.role,
        email: row.email,
        member_id: row.member_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        approved: row.approved === 1,
        avatarUrl: row.avatar_path
          ? `${process.env.BASE_URL}/uploads/${path.basename(row.avatar_path)}`
          : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้" });
  }
};
