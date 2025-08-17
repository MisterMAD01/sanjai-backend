const express = require("express");
const router = express.Router();

const {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  registerForActivity,
  getParticipants,
  downloadParticipants,
} = require("../../controllers/admin/EventActivityController");

const { verifyToken, isAdmin } = require("../../middleware/authMiddleware");

// ดึงกิจกรรมทั้งหมด
router.get("/", verifyToken, isAdmin, getAllActivities);

// สร้างกิจกรรมใหม่
router.post("/", verifyToken, isAdmin, createActivity);

// อัปเดตกิจกรรม
router.put("/:activityId", verifyToken, isAdmin, updateActivity);

// ลบกิจกรรม
router.delete("/:activityId", verifyToken, isAdmin, deleteActivity);

// ดึงผู้เข้าร่วมกิจกรรม
router.get("/:activityId/participants", verifyToken, isAdmin, getParticipants);

// ดาวน์โหลดผู้เข้าร่วม
router.get(
  "/:activityId/participants/download",
  verifyToken,
  isAdmin,
  downloadParticipants
);

// เพิ่มผู้เข้าร่วมกิจกรรม
router.post("/:activityId/register", verifyToken, isAdmin, registerForActivity);

// ดึงกิจกรรมตาม ID
router.get("/:activityId", verifyToken, isAdmin, getActivityById);

module.exports = router;
