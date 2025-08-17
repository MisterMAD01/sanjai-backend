const express = require("express");
const router = express.Router();
const PointsController = require("../../controllers/admin/pointsController");

// middleware ตรวจสอบ admin
const { isAdmin, verifyToken } = require("../../middleware/authMiddleware");

// ดูสรุปแต้มสมาชิกทั้งหมด
router.get("/all", verifyToken, isAdmin, PointsController.getAllMemberPoints);

// ดูสรุปแต้มสมาชิกคนเดียว
router.get(
  "/:member_id",
  verifyToken,
  isAdmin,
  PointsController.getMemberPointsById
);

module.exports = router;
