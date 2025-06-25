// src/routes/AdminDataRoutes.js

const express = require("express");
const router = express.Router();

const {
  uploadExcel,
  importData,
  exportData,
  getFilters,
  getImportLogs,
  getExportLogs,
  getSummary,
  logExport,
} = require("../../controllers/admin/AdminDataController");
const { verifyToken, isAdmin } = require("../../middleware/authMiddleware");

router.get("/summary", verifyToken, isAdmin, getSummary);

// ดึงตัวเลือกตัวกรอง (อำเภอ, รุ่น, ประเภทสมาชิก)
router.get("/filters", verifyToken, isAdmin, getFilters);

// ดึงประวัติการนำเข้า
router.get("/import-logs", verifyToken, isAdmin, getImportLogs);

// ดึงประวัติการส่งออก
router.get("/export-logs", verifyToken, isAdmin, getExportLogs);

// นำเข้าข้อมูล (members หรือ users) จาก Excel
// Query param: type=members | users
router.post("/import", verifyToken, isAdmin, uploadExcel, importData);

// ส่งออกข้อมูล (members หรือ users) เป็น Excel
// Query params: type=members | users, plus filters (district, generation, memberType)
router.get("/export", verifyToken, isAdmin, exportData);
router.post("/log-export", verifyToken, isAdmin, logExport);
module.exports = router;
