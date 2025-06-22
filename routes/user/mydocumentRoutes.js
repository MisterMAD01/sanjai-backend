// routes/user/myDocumentRoutes.js
const express = require("express");
const router = express.Router();
const {
  getMyDocuments,
  downloadMyDocument,
} = require("../../controllers/user/mydocumentController");
const {
  verifyToken,
  authenticateUser,
} = require("../../middleware/authMiddleware");

// GET /api/my-documents
router.get(
  "/",
  verifyToken, // ตรวจว่า JWT ถูกต้อง
  authenticateUser, // ตรวจว่า role === 'user'
  getMyDocuments
);

// GET /api/my-documents/:docId
router.get("/:docId", verifyToken, authenticateUser, downloadMyDocument);

module.exports = router;
