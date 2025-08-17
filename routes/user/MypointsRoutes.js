const express = require("express");
const router = express.Router();
const MyPointsController = require("../../controllers/user/MypointsController");

// ต้อง import แบบ destructuring เพราะไม่ได้ export ฟังก์ชันเดี่ยว
const { verifyToken } = require("../../middleware/authMiddleware");

// ดึงแต้มสะสมทั้งหมดของผู้ใช้
router.get("/", verifyToken, MyPointsController.getMyPoints);

module.exports = router;
