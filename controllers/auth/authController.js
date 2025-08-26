const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/db");

// POST /api/auth/login
exports.login = async (req, res) => {
  const { username, password, rememberMe } = req.body; // รับค่า rememberMe จาก client

  if (!username || !password) {
    return res.status(400).json({ message: "กรุณาระบุ username และ password" });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "ชื่อผู้ใช้ไม่ถูกต้อง" });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
    }

    if (user.approved !== 1) {
      return res
        .status(403)
        .json({ message: "บัญชีของคุณยังไม่ได้รับการอนุมัติ" });
    }

    // สร้าง Access Token (15 วินาที สำหรับทดสอบ)
    const accessToken = jwt.sign(
      { id: user.user_id, role: user.role, memberId: user.member_id },
      process.env.JWT_SECRET,
      { expiresIn: "15s" } // จาก 15 นาที → 15 วินาที
    );

    // สร้าง Refresh Token (3 วันถ้า rememberMe, 1 วันถ้าไม่ติ๊ก)
    const refreshExpiry = rememberMe ? "3d" : "1d";
    const refreshToken = jwt.sign(
      { id: user.user_id, role: user.role, memberId: user.member_id },
      process.env.JWT_SECRET,
      { expiresIn: refreshExpiry }
    );

    // ตั้งค่า cookie สำหรับ refresh token
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // เปลี่ยนเป็น true ถ้าใช้ HTTPS
      sameSite: "lax",
      maxAge: rememberMe ? 3 * 24 * 60 * 60 * 1000 : 1 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        email: user.email,
        memberId: user.member_id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
};

// POST /api/auth/refresh-token
exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "ไม่มี refresh token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute("SELECT * FROM users WHERE user_id = ?", [
      payload.id,
    ]);

    if (rows.length === 0)
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    const user = rows[0];

    // สร้าง Access Token ใหม่ (15 วินาที สำหรับทดสอบ)
    const accessToken = jwt.sign(
      { id: user.user_id, role: user.role, memberId: user.member_id },
      process.env.JWT_SECRET,
      { expiresIn: "15s" } // จาก 15 นาที → 15 วินาที
    );

    res.json({ token: accessToken });
  } catch (error) {
    res.status(403).json({ message: "Refresh token ไม่ถูกต้องหรือล้าสมัย" });
  }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  // ล้าง refresh token cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  res.json({ message: "ออกจากระบบสำเร็จ" });
};
