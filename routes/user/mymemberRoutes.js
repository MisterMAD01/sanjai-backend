// routes/mymemberRoutes.js
// Route definitions for member info APIs

const express = require("express");
const router = express.Router();
const {
  authenticate,
  getMyMemberInfo,
  updateMyMemberInfo,
} = require("../../controllers/user/mymemberController"); // ปรับ path ตามโครงสร้างโปรเจกต์

// ใช้ middleware ตรวจสอบ JWT
router.use(authenticate);

// GET ข้อมูลสมาชิกของผู้ใช้
router.get("/", getMyMemberInfo);

// PUT อัปเดตข้อมูลสมาชิกของผู้ใช้
router.put("/", updateMyMemberInfo);

module.exports = router;
