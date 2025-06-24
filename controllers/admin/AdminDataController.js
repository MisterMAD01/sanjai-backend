const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
require("dotenv").config();

const SALT_ROUNDS = 10;

// สร้าง pool สำหรับเชื่อมต่อฐานข้อมูล
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ตั้งค่า multer สำหรับอัปโหลดไฟล์ Excel
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const uploadExcel = multer({ storage }).single("excelFile");

/**
 * นำเข้าข้อมูลตาม type:
 *  - members: insert/update เฉพาะ members
 *  - users: insert/update เฉพาะ users (สร้าง placeholder members ถ้า missing)
 *  - both: นำเข้า members แล้วสร้าง/อัปเดต users อัตโนมัติ
 */
const importData = async (req, res) => {
  const { type } = req.query;
  if (!req.file) return res.status(400).json({ error: "ไม่มีไฟล์อัปโหลด" });

  const filePath = req.file.path;
  let conn;
  let memberCount = 0;
  let userCount = 0;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const workbook = xlsx.readFile(filePath);
    // ... (import logic unchanged) ...

    await conn.commit();

    // หาชื่อผู้ทำรายการ
    const [[adminRow]] = await conn.query(
      `SELECT m.full_name
         FROM users u
         JOIN members m ON u.member_id = m.member_id
        WHERE u.user_id = ?`,
      [req.userId]
    );
    const performedBy = adminRow?.full_name || "ระบบ";

    // บันทึก import_logs
    const total =
      type === "both"
        ? memberCount + userCount
        : type === "members"
        ? memberCount
        : userCount;
    await pool.query(
      `INSERT INTO import_logs
         (type, filename, count, performed_by, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [type, path.basename(filePath), total, performedBy]
    );

    res.json({ message: `นำเข้า ${type} สำเร็จ`, count: total });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("importData error:", err);
    res.status(500).json({ error: "นำเข้าไม่สำเร็จ" });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (conn) conn.release();
  }
};

/**
 * ส่งออก Members หรือ Users ตามฟอร์แมตนำเข้า
 */
const exportData = async (req, res) => {
  const { type, district, generation, memberType } = req.query;
  if (!["members", "users"].includes(type)) {
    return res.status(400).json({ error: "Invalid export type" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const writeSheet = (wb, name, headers, rows) => {
      const data = rows.map((r) => headers.map((h) => r[h] ?? ""));
      const ws = xlsx.utils.aoa_to_sheet([headers, ...data]);
      xlsx.utils.book_append_sheet(wb, ws, name);
    };

    const wb = xlsx.utils.book_new();
    let rows = [];
    let headers = [];
    let filename = "";

    // สร้างเงื่อนไข filters
    const clauses = [];
    const params = [];
    if (district) {
      clauses.push("m.district = ?");
      params.push(district);
    }
    if (generation) {
      clauses.push("m.graduation_year = ?");
      params.push(generation);
    }
    if (memberType) {
      clauses.push("m.type = ?");
      params.push(memberType);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    if (type === "members") {
      [rows] = await conn.query(
        `SELECT
           member_id, prefix, full_name, nickname, id_card,
           DATE_FORMAT(birthday, '%Y-%m-%d') AS birthday,
           age, gender, religion, medical_conditions,
           allergy_history, address, phone, facebook,
           instagram, line_id, school, graduation_year,
           gpa, type, district
         FROM members m ${where}
         ORDER BY full_name`,
        params
      );
      headers = [
        "member_id",
        "prefix",
        "full_name",
        "nickname",
        "id_card",
        "birthday",
        "age",
        "gender",
        "religion",
        "medical_conditions",
        "allergy_history",
        "address",
        "phone",
        "facebook",
        "instagram",
        "line_id",
        "school",
        "graduation_year",
        "gpa",
        "type",
        "district",
      ];
      writeSheet(wb, "Members", headers, rows);
      filename = `members_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else {
      [rows] = await conn.query(
        `SELECT
           username, password_hash, role, u.member_id, email,
           DATE_FORMAT(u.created_at, '%Y-%m-%d') AS created_at,
           DATE_FORMAT(u.updated_at, '%Y-%m-%d') AS updated_at,
           approved, notifications_enabled
         FROM users u
         LEFT JOIN members m ON u.member_id = m.member_id
         ${where}
         ORDER BY username`,
        params
      );
      headers = [
        "username",
        "password_hash",
        "role",
        "member_id",
        "email",
        "created_at",
        "updated_at",
        "approved",
        "notifications_enabled",
      ];
      writeSheet(wb, "Users", headers, rows);
      filename = `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }

    // บันทึก export_logs
    const [[adminRow]] = await conn.query(
      `SELECT m.full_name
         FROM users u
         JOIN members m ON u.member_id = m.member_id
        WHERE u.user_id = ?`,
      [req.userId]
    );
    const performedBy = adminRow?.full_name || "ระบบ";
    const count = Array.isArray(rows) ? rows.length : 0;
    await pool.query(
      `INSERT INTO export_logs
         (type, filename, count, performed_by, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [type, filename, count, performedBy]
    );

    // ส่งไฟล์กลับ
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    console.error("exportData error:", err);
    res.status(500).json({ error: "ส่งออกไม่สำเร็จ" });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * ดึงตัวกรอง: อำเภอ, รุ่น, ประเภทสมาชิก
 */
const getFilters = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [districts] = await conn.query(
      "SELECT DISTINCT district FROM members WHERE district <> '' ORDER BY district"
    );
    const [generations] = await conn.query(
      "SELECT DISTINCT graduation_year FROM members WHERE graduation_year <> '' ORDER BY graduation_year"
    );
    const [memberTypes] = await conn.query(
      "SELECT DISTINCT type FROM members WHERE type <> '' ORDER BY type"
    );
    res.json({
      districts: districts.map((r) => r.district),
      generations: generations.map((r) => r.graduation_year),
      memberTypes: memberTypes.map((r) => r.type),
    });
  } catch (err) {
    console.error("getFilters error:", err);
    res.status(500).json({ error: "ไม่สามารถดึงตัวกรองได้" });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * ดึงประวัติการนำเข้า
 */
const getImportLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM import_logs ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("getImportLogs error:", err);
    res.status(500).json({ error: "ไม่สามารถดึงประวัติการนำเข้าได้" });
  }
};

/**
 * ดึงประวัติการส่งออก
 */
const getExportLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM export_logs ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("getExportLogs error:", err);
    res.status(500).json({ error: "ไม่สามารถดึงประวัติการส่งออกได้" });
  }
};

/**
 * สรุปจำนวนสมาชิกและผู้ใช้ตาม filters
 */
const getSummary = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { district, generation, memberType } = req.query;
    const clauses = [];
    const params = [];
    if (district) {
      clauses.push("m.district = ?");
      params.push(district);
    }
    if (generation) {
      clauses.push("m.graduation_year = ?");
      params.push(generation);
    }
    if (memberType) {
      clauses.push("m.type = ?");
      params.push(memberType);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [[memCount]] = await conn.query(
      `SELECT COUNT(*) AS count FROM members m ${where}`,
      params
    );
    const [[userCount]] = await conn.query(
      `SELECT COUNT(*) AS count
         FROM users u
    LEFT JOIN members m ON u.member_id = m.member_id
        ${where}`,
      params
    );
    res.json({ members: memCount.count, users: userCount.count });
  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ error: "ไม่สามารถดึงสรุปได้" });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  uploadExcel,
  importData,
  exportData,
  getFilters,
  getImportLogs,
  getExportLogs,
  getSummary,
};
