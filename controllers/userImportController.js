const multer = require("multer");
const XLSX = require("xlsx");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const SALT_ROUNDS = 10;

// ตั้งค่า multer อัปโหลดไฟล์ไปเก็บใน /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ฟังก์ชันอ่านไฟล์ Excel แล้วเพิ่ม User ลง DB
async function importUsersFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  for (const row of rows) {
    const username = row["username"] || row["ชื่อผู้ใช้"];
    const rawPassword = row["password"] || "defaultPassword123"; // ตั้งรหัสผ่านเริ่มต้นถ้าไม่มีในไฟล์
    const role = row["role"] || "user";
    const member_id = row["member_id"] || null;
    const email = row["email"] || null;

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!username || !rawPassword) continue;

    // ตรวจสอบซ้ำ
    const [existing] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (existing.length > 0) continue; // ข้าม username ซ้ำ

    const password_hash = await bcrypt.hash(rawPassword, SALT_ROUNDS);

    await pool.query(
      "INSERT INTO users (username, password_hash, role, member_id, email) VALUES (?, ?, ?, ?, ?)",
      [username, password_hash, role, member_id, email]
    );
  }
}

// Controller middleware สำหรับรับไฟล์และเรียก import
exports.uploadExcel = [
  upload.single("file"), // ชื่อฟิลด์ในฟอร์มคือ 'file'
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: "ยังไม่ได้เลือกไฟล์" });

    try {
      await importUsersFromExcel(req.file.path);
      res.json({ message: "นำเข้าผู้ใช้เรียบร้อยแล้ว" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการนำเข้าไฟล์" });
    }
  },
];
