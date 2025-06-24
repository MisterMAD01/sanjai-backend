const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const userController = require("../../controllers/user/myuserController");
const { verifyToken } = require("../../middleware/authMiddleware");

// ตั้งค่า storage ของ Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ตรวจสอบให้แน่ใจว่าโฟลเดอร์ 'uploads' มีอยู่และ Node.js มีสิทธิ์เขียน
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // ใช้ req.user.id ซึ่งมาจาก verifyToken middleware
    const name = `avatar_${req.user.id}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

// ตั้งค่า Multer พร้อมการจำกัดขนาดและประเภทไฟล์
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // จำกัดขนาดไฟล์สูงสุด 5 MB
  fileFilter: (req, file, cb) => {
    // อนุญาตเฉพาะไฟล์รูปภาพ JPEG, PNG, GIF
    const allowedMimes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true); // อนุญาต
    } else {
      // ปฏิเสธและส่ง Error message
      cb(
        new Error("ประเภทไฟล์ไม่ถูกต้อง อนุญาตเฉพาะ JPG, PNG, GIF เท่านั้น"),
        false
      );
    }
  },
});

// GET /api/user/me — ต้องล็อกอิน
router.get("/me", verifyToken, userController.getCurrentUser);

// PUT /api/user/me — ต้องล็อกอิน, อนุญาต multipart/form-data สำหรับ avatar
router.put(
  "/me",
  verifyToken,
  // ใช้ Multer error handler เพื่อดักจับข้อผิดพลาดจากการอัปโหลดไฟล์
  (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer error (เช่น file size limit, invalid file type)
        console.error("Multer Error:", err.message);
        return res.status(400).json({ message: err.message });
      } else if (err) {
        // Unknown error
        console.error("File upload error:", err);
        return res
          .status(500)
          .json({ message: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์" });
      }
      next(); // ไปยัง controller ถ้าไม่มี error
    });
  },
  userController.updateCurrentUser
);

module.exports = router;
