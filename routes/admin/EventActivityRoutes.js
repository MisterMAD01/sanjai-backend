const express = require("express");
const router = express.Router();

const {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  deleteParticipants,
  deleteParticipantById,
  registerForActivity,
  getParticipants,
  downloadParticipants,
} = require("../../controllers/admin/EventActivityController");

const { verifyToken, isAdmin } = require("../../middleware/authMiddleware");

// ================== กิจกรรม ==================

// ดึงกิจกรรมทั้งหมด
router.get("/", verifyToken, isAdmin, getAllActivities);

// ดึงกิจกรรมตาม ID
router.get("/:activityId", verifyToken, isAdmin, getActivityById);

// สร้างกิจกรรมใหม่
router.post("/", verifyToken, isAdmin, createActivity);

// อัปเดตกิจกรรม
router.put("/:activityId", verifyToken, isAdmin, updateActivity);

// ลบกิจกรรม
router.delete("/:activityId", verifyToken, isAdmin, deleteActivity);

// ================== ผู้เข้าร่วม ==================

// ดึงผู้เข้าร่วมกิจกรรม
router.get("/:activityId/participants", verifyToken, isAdmin, getParticipants);

// ดาวน์โหลดรายชื่อผู้เข้าร่วม (Excel)
router.get(
  "/:activityId/participants/download",
  verifyToken,
  isAdmin,
  downloadParticipants
);

// เพิ่มผู้เข้าร่วมกิจกรรม
router.post("/:activityId/register", verifyToken, isAdmin, registerForActivity);

// ลบผู้เข้าร่วม + คะแนนที่เกี่ยวข้อง
router.delete(
  "/:activityId/participants",
  verifyToken,
  isAdmin,
  deleteParticipants
);
// ลบผู้เข้าร่วมคนเดียว
router.delete(
  "/:activityId/participants/:memberId",
  verifyToken,
  isAdmin,
  deleteParticipantById
);

module.exports = router;
