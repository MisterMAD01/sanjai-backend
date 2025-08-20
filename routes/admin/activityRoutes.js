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
router.patch(
  "/:id/register_open",
  verifyToken,
  isAdmin,
  activityController.toggleRegisterOpen
);

// ดึงผู้สมัครของกิจกรรม
router.get(
  "/:id/applicants",
  verifyToken,
  isAdmin,
  activityController.getApplicants
);

// ดาวน์โหลดรายชื่อผู้สมัครเป็นไฟล์ Excel
router.get(
  "/:id/applicants/download",
  verifyToken,
  isAdmin,
  activityController.downloadApplicantsExcel
);

// ดึงกิจกรรมทั้งหมด
router.get("/", verifyToken, isAdmin, activityController.getAllActivities);

// ลบกิจกรรม
router.delete("/:id", verifyToken, isAdmin, activityController.deleteActivity);

module.exports = router;
