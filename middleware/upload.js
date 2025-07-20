const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// กำหนดว่าไฟล์ที่อนุญาตให้อัปโหลดมี mimetype อะไรบ้าง
const allowedTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// สร้าง storage สำหรับ multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads")); // เก็บไว้ในโฟลเดอร์ uploads
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ดึงนามสกุลไฟล์ เช่น .jpg
    const filename = uuidv4() + ext;
    cb(null, filename);
  },
});

// ฟังก์ชันกรองไฟล์
const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // ยอมรับไฟล์
  } else {
    cb(new Error("รองรับเฉพาะไฟล์รูปภาพและไฟล์เอกสารกำหนดการเท่านั้น"), false);
  }
};

// export middleware สำหรับอัปโหลด
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

module.exports = upload;
