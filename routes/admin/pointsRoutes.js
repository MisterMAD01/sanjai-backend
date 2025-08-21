const express = require("express");
const router = express.Router();
const PointsController = require("../../controllers/admin/pointsController");

// middleware ตรวจสอบ admin
const { isAdmin, verifyToken } = require("../../middleware/authMiddleware");

// ดูสรุปแต้มสมาชิกทั้งหมด
router.get("/all", verifyToken, isAdmin, PointsController.getAllMemberPoints);

// ส่งออก Excel - ต้องอยู่ก่อน /:member_id
router.get(
  "/export",
  verifyToken,
  isAdmin,
  PointsController.exportAllMemberPoints
);

// ดูสรุปแต้มสมาชิกคนเดียว - ต้องอยู่หลัง routes ที่เฉพาะเจาะจง
router.get(
  "/:member_id",
  verifyToken,
  isAdmin,
  PointsController.getMemberPointsById
);

module.exports = router;
