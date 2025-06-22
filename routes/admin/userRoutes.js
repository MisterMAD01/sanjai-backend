const express = require("express");
const router = express.Router();

const {
  uploadSingle,
  getAllUsers,
  addUser,
  updateUser,
  deleteUser,
  approveUser,
  rejectUser,
  importUsersFromExcel,
  getAvailableMembers,
} = require("../../controllers/admin/userController");
const { verifyToken, isAdmin } = require("../../middleware/authMiddleware");

// แสดงผู้ใช้ทั้งหมด
router.get("/", verifyToken, isAdmin, getAllUsers);

// เพิ่มผู้ใช้
router.post("/", verifyToken, isAdmin, addUser);

// แก้ไขผู้ใช้
router.put("/:userId", verifyToken, isAdmin, updateUser);

// ลบผู้ใช้
router.delete("/:userId", verifyToken, isAdmin, deleteUser);

// อนุมัติผู้ใช้
router.put("/:userId/approve", verifyToken, isAdmin, approveUser);

// ไม่อนุมัติผู้ใช้
router.put("/:userId/reject", verifyToken, isAdmin, rejectUser);

// นำเข้าผู้ใช้จาก Excel
router.post(
  "/import-excel",
  verifyToken,
  isAdmin,
  uploadSingle,
  importUsersFromExcel
);
router.get("/available-members", verifyToken, isAdmin, getAvailableMembers);

module.exports = router;
