const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../../middleware/authMiddleware");
const upload = require("../../middleware/upload");
const activityController = require("../../controllers/admin/activityController");

router.use(verifyToken, isAdmin);

// สร้างกิจกรรม (อัปโหลดรูป schedule และ qr)
router.post(
  "/",
  upload.fields([
    { name: "schedule", maxCount: 1 },
    { name: "qr", maxCount: 1 },
  ]),
  activityController.createActivity
);

// แก้ไขกิจกรรม (อัปโหลดรูปใหม่ถ้ามี)
router.put(
  "/:id",
  upload.fields([
    { name: "schedule", maxCount: 1 },
    { name: "qr", maxCount: 1 },
  ]),
  activityController.updateActivity
);

// เปิด/ปิดรับสมัคร
router.patch("/:id/register_open", activityController.toggleRegisterOpen);

// ดึงผู้สมัครของกิจกรรม
router.get("/:id/applicants", activityController.getApplicants);

// ดาวน์โหลดรายชื่อผู้สมัครเป็นไฟล์ Excel
router.get(
  "/:id/applicants/download",
  activityController.downloadApplicantsExcel
);

// ดึงกิจกรรมทั้งหมด
router.get("/", activityController.getAllActivities);

// ลบกิจกรรม
router.delete("/:id", activityController.deleteActivity);

module.exports = router;
