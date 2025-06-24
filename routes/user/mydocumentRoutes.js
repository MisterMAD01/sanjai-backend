// routes/user/myDocumentRoutes.js
const express = require("express");
const router = express.Router();
const {
  getMyDocuments,
  downloadMyDocument,
} = require("../../controllers/user/mydocumentController");
const {
  authenticateRoles, // เปลี่ยนมาใช้ตัวนี้
} = require("../../middleware/authMiddleware");

// GET /api/my-documents
router.get(
  "/",
  authenticateRoles("user", "admin"), // อนุญาตทั้ง user กับ admin
  getMyDocuments
);

// GET /api/my-documents/:docId
router.get("/:docId", authenticateRoles("user", "admin"), downloadMyDocument);

module.exports = router;
