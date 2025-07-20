const express = require("express");
const router = express.Router();
const {
  verifyToken,
  authenticateUser,
  authenticateRoles,
} = require("../../middleware/authMiddleware");
const activityController = require("../../controllers/user/MyactivityController");

// ดึงกิจกรรมที่เปิดรับสมัคร
router.get("/", activityController.getOpenActivities);

// ดึงกิจกรรมที่ user สมัครแล้ว (ต้อง login + role user หรือ admin)
router.get(
  "/applications",
  verifyToken,
  authenticateRoles("user", "admin"),
  activityController.getUserRegisteredActivities
);

// ดึงกิจกรรมตาม id
router.get("/:id", activityController.getActivityById);

// ลงทะเบียนกิจกรรม (ต้อง login + role user หรือ admin)
router.post(
  "/:id/applicants",
  verifyToken,
  authenticateRoles("user", "admin"),
  activityController.registerForActivity
);

module.exports = router;
