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

    // สร้าง URL สำหรับ avatar
    const avatarUrl = row.avatar_path
      ? `${process.env.BASE_URL || ""}/uploads/${path.basename(
          row.avatar_path
        )}`
      : null;

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
        avatarUrl: avatarUrl,
      },
    });
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้" });
  }
};

// อัปเดตข้อมูลผู้ใช้ (username, email, password_hash, avatar)
exports.updateCurrentUser = async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;
    const { username, email, password } = req.body;
    let passwordHash;
    const newAvatarPath = req.file ? req.file.path : null;

    // ถ้ามีรหัสผ่านใหม่ ให้ hash
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // เริ่ม Transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ถ้ามีไฟล์ avatar ใหม่ ให้ลบไฟล์เก่าออก
    if (newAvatarPath) {
      const [[oldUser]] = await connection.execute(
        "SELECT avatar_path FROM users WHERE user_id = ?",
        [userId]
      );
      if (oldUser?.avatar_path) {
        const oldAvatarFullPath = path.resolve(oldUser.avatar_path);
        fs.unlink(oldAvatarFullPath, (err) => {
          if (err) {
            console.warn(
              "ลบไฟล์ avatar เก่าไม่สำเร็จ:",
              oldAvatarFullPath,
              err
            );
          }
        });
      }
    }

    // เตรียม field และ params สำหรับ UPDATE
    const fields = [];
    const params = [];

    if (username !== undefined) {
      fields.push("username = ?");
      params.push(username);
    }
    if (email !== undefined) {
      fields.push("email = ?");
      params.push(email);
    }
    if (passwordHash) {
      fields.push("password_hash = ?");
      params.push(passwordHash);
    }
    if (newAvatarPath) {
      fields.push("avatar_path = ?");
      params.push(newAvatarPath);
    }

    if (fields.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "ไม่มีข้อมูลให้แก้ไข" });
    }

    params.push(userId);

    // Execute UPDATE
    await connection.execute(
      `UPDATE users
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE user_id = ?`,
      params
    );

    await connection.commit();

    // ดึงข้อมูลใหม่มาให้ frontend
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.username, u.role, u.email, u.member_id, m.full_name, u.created_at, u.updated_at, u.approved, u.avatar_path
       FROM users u
       LEFT JOIN members m ON u.member_id = m.member_id
       WHERE u.user_id = ?`,
      [userId]
    );
    const updated = rows[0];
    const updatedAvatarUrl = updated.avatar_path
      ? `${process.env.BASE_URL || ""}/uploads/${path.basename(
          updated.avatar_path
        )}`
      : null;

    res.json({
      profile: {
        user_id: updated.user_id,
        username: updated.username,
        role: updated.role,
        email: updated.email,
        member_id: updated.member_id,
        full_name: updated.full_name,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        approved: updated.approved === 1,
        avatarUrl: updatedAvatarUrl,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error in updateCurrentUser:", error);
    res.status(500).json({
      message: error.message || "เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้",
    });
  } finally {
    if (connection) connection.release();
  }
};
