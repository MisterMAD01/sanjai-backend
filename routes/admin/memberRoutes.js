const express = require("express");
const router = express.Router();

const {
  getAllMembers,
  uploadSingle,
  importMembersFromExcel,
  addMember,
  updateMember,
  deleteMember,
} = require("../../controllers/admin/memberController");
const { verifyToken, isAdmin } = require("../../middleware/authMiddleware");

// ดึงสมาชิกทั้งหมด
router.get("/", verifyToken, getAllMembers);

// นำเข้าจาก Excel
router.post("/import-excel", uploadSingle, importMembersFromExcel);

// เพิ่มสมาชิกใหม่
router.post("/", verifyToken, isAdmin, addMember);

// แก้ไขสมาชิก
router.put("/:memberId", verifyToken, isAdmin, updateMember);

// ลบสมาชิก
router.delete("/:memberId", verifyToken, isAdmin, deleteMember);

module.exports = router;
