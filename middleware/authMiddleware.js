// B:\Coding\sanjaithai_web\sanjai-backend\middleware\authMiddleware.js
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
      // If token is expired or invalid, return 401 to trigger refresh on frontend
      return res.status(401).json({ message: "Token หมดอายุหรือไม่ถูกต้อง" });
    }
    req.user = payload; // Attach the full payload to req.user
    req.userId = payload.id || payload.sub; // Assuming user_id is named 'id' or 'sub' in JWT
    req.memberId = payload.member_id || payload.memberId; // Assuming member_id is named 'member_id' or 'memberId' in JWT

    next();
  });
};

// Check if user is Admin
exports.isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    console.error(`User ${req.user?.username || req.userId} is not admin`);
    return res.status(403).json({ message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" });
  }
  next();
};

// Check if user is a standard User role
exports.authenticateUser = [
  exports.verifyToken, // First verify the token
  (req, res, next) => {
    if (req.user?.role !== "user") {
      console.error(
        `User ${req.user?.username || req.userId} does not have 'user' role`
      );
      return res
        .status(403)
        .json({ message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" });
    }
    next();
  },
];
exports.authenticateRoles = (...allowedRoles) => [
  exports.verifyToken, // ตรวจ JWT ก่อน
  (req, res, next) => {
    const role = req.user?.role;
    if (!allowedRoles.includes(role)) {
      console.error(
        `User ${
          req.user?.username || req.userId
        } does not have one of roles: ${allowedRoles.join(", ")}`
      );
      return res
        .status(403)
        .json({ message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" });
    }
    next();
  },
];
