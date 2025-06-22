// routes/user/myuserRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const userController = require("../../controllers/user/myuserController");
const { verifyToken } = require("../../middleware/authMiddleware");

// ตั้งค่า storage ของ Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `avatar_${req.user.id}_${Date.now()}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// GET /api/user/me — ต้องล็อกอิน
router.get("/me", verifyToken, userController.getCurrentUser);

// PUT /api/user/me — ต้องล็อกอิน, อนุญาต multipart/form-data สำหรับ avatar
router.put(
  "/me",
  verifyToken,
  upload.single("avatar"),
  userController.updateCurrentUser
);

module.exports = router;
