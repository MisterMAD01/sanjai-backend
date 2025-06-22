// src/controllers/user/settingsController.js
const pool = require("../../config/db");
const bcrypt = require("bcrypt");

exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
    // อ่าน hash เก่าจาก DB
    const [[user]] = await pool.execute(
      "SELECT password_hash FROM users WHERE user_id = ?",
      [userId]
    );
    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    // ตรวจสอบรหัสผ่านเดิม
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match)
      return res.status(400).json({ message: "รหัสผ่านเดิมไม่ถูกต้อง" });

    // hash รหัสผ่านใหม่ แล้วอัปเดต
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.execute("UPDATE users SET password_hash = ? WHERE user_id = ?", [
      newHash,
      userId,
    ]);

    res.json({ message: "เปลี่ยนรหัสผ่านเรียบร้อย" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
};

exports.changeEmail = async (req, res) => {
  const userId = req.user.id;
  const { newEmail } = req.body;
  try {
    await pool.execute("UPDATE users SET email = ? WHERE user_id = ?", [
      newEmail,
      userId,
    ]);
    res.json({ message: "เปลี่ยนอีเมลเรียบร้อย", email: newEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
};

exports.toggleNotifications = async (req, res) => {
  const userId = req.user.id;
  const { enabled } = req.body; // true/false
  try {
    await pool.execute(
      "UPDATE users SET notifications_enabled = ? WHERE user_id = ?",
      [enabled ? 1 : 0, userId]
    );
    res.json({ message: "อัปเดตสถานะการแจ้งเตือนเรียบร้อย", enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
};
