// routes/user/dashboard.js
const express = require("express");
const router = express.Router();
const dashboard = require("../../controllers/user/DashboardController");
const { verifyToken } = require("../../middleware/authMiddleware");

// ทุก endpoint จะต้องล็อกอินก่อน (มี JWT ที่ถูกต้องใน header)
router.get("/stats", verifyToken, dashboard.getStats);
router.get("/by-district", verifyToken, dashboard.getByDistrict);
router.get("/by-generation", verifyToken, dashboard.getByGeneration);
router.get("/by-gender", verifyToken, dashboard.getByGender);

module.exports = router;
