// B:\Coding\sanjaithai_web\sanjai-backend\routes\user\mymemberRoutes.js
const express = require("express");
const router = express.Router();
// Import verifyToken จาก authMiddleware
const { verifyToken } = require("../../middleware/authMiddleware"); // ตรวจสอบ path นี้ให้ถูกต้อง
const {
  getMyMemberInfo,
  updateMyMemberInfo,
} = require("../../controllers/user/mymemberController"); // ตรวจสอบ path นี้

// ใช้ middleware ตรวจสอบ JWT (verifyToken)
router.use(verifyToken);

// GET ข้อมูลสมาชิกของผู้ใช้
router.get("/", getMyMemberInfo);

// PUT อัปเดตข้อมูลสมาชิกของผู้ใช้
router.put("/", updateMyMemberInfo);

module.exports = router;
