// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

// ตรวจสอบ JWT, เซ็ต req.user จาก payload
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "ไม่พบ Token หรือ Token ไม่ถูกต้อง" });
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("Missing JWT_SECRET – กรุณาตรวจสอบ .env");
    return res.status(500).json({ message: "Server configuration error." });
  }

  jwt.verify(token, secret, (err, payload) => {
    if (err) {
      console.error("JWT verification error:", err);
      return res.status(403).json({ message: "Token ไม่ถูกต้อง" });
    }
    req.user = payload; // payload ควรมี { id, role, username }
    next();
  });
};

// ตรวจสอบว่าเป็น Admin
exports.isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    console.error(`User ${req.user?.username} ไม่ใช่ admin`);
    return res.status(403).json({ message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" });
  }
  next();
};

// ตรวจสอบว่าเป็น User
exports.authenticateUser = [
  exports.verifyToken,
  (req, res, next) => {
    if (req.user?.role !== "user") {
      console.error(`User ${req.user?.username} ไม่มีบทบาท user`);
      return res
        .status(403)
        .json({ message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" });
    }
    next();
  },
];
