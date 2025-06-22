// src/routes/user/settingsRoutes.js
const express = require("express");
const router = express.Router();
const {
  changePassword,
  changeEmail,
  toggleNotifications,
} = require("../../controllers/user/settingsController");
const { verifyToken } = require("../../middleware/authMiddleware");

// ทุก route ต้องล็อกอินก่อน (verifyToken)
router.put("/password", verifyToken, changePassword);
router.put("/email", verifyToken, changeEmail);
router.put("/notify", verifyToken, toggleNotifications);

module.exports = router;
