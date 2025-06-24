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
        avatarUrl: avatarUrl, // ส่ง avatarUrl กลับไป
      },
    });
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้" });
  }
};

// อัปเดตข้อมูลผู้ใช้ (username, email, password, avatar)
exports.updateCurrentUser = async (req, res) => {
  let connection; // ประกาศตัวแปร connection ที่นี่
  try {
    const userId = req.user.id;
    const { username, email, password } = req.body; // รับ password จาก req.body
    let passwordHash;
    let newAvatarPath = req.file ? req.file.path : null; // Path ของ avatar ใหม่ที่ Multer สร้างให้

    // console.log("Received data for update:", { userId, username, email, newAvatarPath, hasPassword: !!password });
    // console.log("req.file:", req.file); // ตรวจสอบว่า req.file มีข้อมูลหรือไม่

    // ถ้ามีรหัสผ่านใหม่ ให้ hash
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // เริ่ม Transaction เพื่อให้มั่นใจว่าการอัปเดตเป็น Atomic
    connection = await pool.getConnection(); // ดึง connection จาก pool
    await connection.beginTransaction(); // เริ่มต้น Transaction

    // ถ้ามีไฟล์ avatar ใหม่
    if (newAvatarPath) {
      // ดึง path ของ avatar เก่าจากฐานข้อมูล
      const [[oldUser]] = await connection.execute(
        // ใช้ connection ที่อยู่ใน transaction
        "SELECT avatar_path FROM users WHERE user_id = ?",
        [userId]
      );

      // ถ้ามี avatar เก่า ให้ลบไฟล์นั้น
      if (oldUser?.avatar_path) {
        const oldAvatarFullPath = path.resolve(oldUser.avatar_path); // แก้ปัญหาเรื่อง path ไม่ตรง
        fs.unlink(oldAvatarFullPath, (err) => {
          if (err) {
            console.warn(
              "ลบไฟล์ avatar เก่าไม่สำเร็จ:",
              oldAvatarFullPath,
              err
            );
          } else {
            // console.log("ลบไฟล์ avatar เก่าสำเร็จ:", oldAvatarFullPath);
          }
        });
      }
    }

    // สร้างคำสั่ง SQL และ parameters ตามที่มีจริง
    const fields = [];
    const params = [];
    if (username !== undefined) {
      // ตรวจสอบว่ามี username ส่งมา (แม้จะเป็นค่าว่าง)
      fields.push("username = ?");
      params.push(username);
    }
    if (email !== undefined) {
      // ตรวจสอบว่ามี email ส่งมา
      fields.push("email = ?");
      params.push(email);
    }
    if (passwordHash) {
      fields.push("password = ?");
      params.push(passwordHash);
    }
    if (newAvatarPath) {
      fields.push("avatar_path = ?");
      params.push(newAvatarPath);
    }

    if (fields.length === 0) {
      await connection.rollback(); // Rollback ถ้าไม่มีข้อมูลให้แก้ไข
      return res.status(400).json({ message: "ไม่มีข้อมูลให้แก้ไข" });
    }

    params.push(userId); // Parameter สุดท้ายคือ user_id สำหรับ WHERE clause

    // อัปเดตข้อมูลในฐานข้อมูล
    await connection.execute(
      // ใช้ connection ที่อยู่ใน transaction
      `UPDATE users SET ${fields.join(
        ", "
      )}, updated_at = NOW() WHERE user_id = ?`,
      params
    );

    await connection.commit(); // Commit Transaction ถ้าทุกอย่างสำเร็จ

    // ดึงข้อมูลผู้ใช้ที่อัปเดตล่าสุดกลับมา เพื่อให้ Frontend ได้ข้อมูลครบถ้วน
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.username, u.role, u.email, u.member_id, m.full_name, u.created_at, u.updated_at, u.approved, u.avatar_path
       FROM users u
       LEFT JOIN members m ON u.member_id = m.member_id
       WHERE u.user_id = ?`,
      [userId]
    );

    const updatedProfile = rows[0];
    if (!updatedProfile) {
      return res
        .status(404)
        .json({ message: "ไม่พบข้อมูลผู้ใช้หลังการอัปเดต" });
    }

    // สร้าง URL สำหรับ avatar ของโปรไฟล์ที่อัปเดตแล้ว
    const updatedAvatarUrl = updatedProfile.avatar_path
      ? `${process.env.BASE_URL || ""}/uploads/${path.basename(
          updatedProfile.avatar_path
        )}`
      : null;

    res.json({
      profile: {
        user_id: updatedProfile.user_id,
        username: updatedProfile.username,
        role: updatedProfile.role,
        email: updatedProfile.email,
        member_id: updatedProfile.member_id,
        full_name: updatedProfile.full_name, // ดึง full_name กลับมาด้วย
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
        approved: updatedProfile.approved === 1,
        avatarUrl: updatedAvatarUrl,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback(); // Rollback Transaction หากเกิด Error
    }
    console.error("Error in updateCurrentUser:", error);
    res
      .status(500)
      .json({
        message: error.message || "เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้",
      });
  } finally {
    if (connection) {
      connection.release(); // คืน connection กลับเข้า pool
    }
  }
};
