const express = require("express");
const router = express.Router();
const {
  getAllDocuments,
  uploadDocument,
  deleteDocument,
} = require("../../controllers/admin/documentController");

const { upload } = require("../../controllers/admin/documentController"); // << เพิ่ม
const { verifyToken, isAdmin } = require("../../middleware/authMiddleware");

router.get("/", verifyToken, isAdmin, getAllDocuments);
router.post("/upload", verifyToken, isAdmin, upload, uploadDocument);
router.delete("/:id", verifyToken, isAdmin, deleteDocument);

module.exports = router;
