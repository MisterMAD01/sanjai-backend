const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
require("dotenv").config();

const SALT_ROUNDS = 10;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

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

const columnMap = {
  รหัสสมาชิก: "member_id",
  คำนำหน้า: "prefix",
  "ชื่อ-นามสกุล": "full_name",
  ชื่อเล่น: "nickname",
  เลขบัตรประชาชน: "id_card",
  วันเกิด: "birthday",
  อายุ: "age",
  เพศ: "gender",
  ศาสนา: "religion",
  โรคประจำตัว: "medical_conditions",
  ประวัติแพ้ยา: "allergy_history",
  ที่อยู่: "address",
  เบอร์โทร: "phone",
  Facebook: "facebook",
  Instagram: "instagram",
  "LINE ID": "line_id",
  โรงเรียน: "school",
  ปีจบ: "graduation_year",
  เกรดเฉลี่ย: "gpa",
  ประเภทสมาชิก: "type",
  อำเภอ: "district",
  ชื่อผู้ใช้: "username",
  "รหัสผ่าน (เข้ารหัสแล้ว)": "password_hash",
  บทบาท: "role",
  อีเมล: "email",
  วันที่สร้าง: "created_at",
  วันที่อัปเดต: "updated_at",
};

const importData = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ไม่มีไฟล์อัปโหลด" });
  const filePath = req.file.path;
  let conn;
  let memberCount = 0;
  let userCount = 0;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    const data = rawData.map((row) => {
      const mapped = {};
      for (const [th, en] of Object.entries(columnMap)) {
        mapped[en] = row[th];
      }
      return mapped;
    });

    for (const row of data) {
      if (!row.member_id || !row.full_name || !row.username) continue;

      if (!row.password_hash && row.id_card) {
        row.password_hash = await bcrypt.hash(row.id_card, SALT_ROUNDS);
      }

      const [exist] = await conn.query(
        "SELECT * FROM members WHERE member_id = ?",
        [row.member_id]
      );

      const memberData = { ...row };
      delete memberData.username;
      delete memberData.password_hash;
      delete memberData.role;
      delete memberData.email;
      delete memberData.created_at;
      delete memberData.updated_at;

      if (exist.length) {
        const existing = exist[0];
        const updateData = {};
        for (const key in memberData) {
          if (
            (existing[key] === null || existing[key] === "") &&
            memberData[key]
          ) {
            updateData[key] = memberData[key];
          }
        }
        if (Object.keys(updateData).length > 0) {
          await conn.query("UPDATE members SET ? WHERE member_id = ?", [
            updateData,
            row.member_id,
          ]);
        }
      } else {
        await conn.query("INSERT INTO members SET ?", memberData);
      }
      memberCount++;

      // User section
      if (!row.username && row.member_id) {
        row.username = `${row.member_id}`;
      }

      if (row.username && row.password_hash) {
        row.role = row.role === "admin" ? "admin" : "user";

        const userData = {
          username: row.username,
          password_hash: row.password_hash,
          role: row.role,
          email: row.email,
          created_at: row.created_at ? new Date(row.created_at) : new Date(),
          updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
          approved: 1,
          notifications_enabled: 0,
          member_id: row.member_id,
        };

        const [userExist] = await conn.query(
          "SELECT user_id FROM users WHERE username = ?",
          [row.username]
        );
        if (userExist.length) {
          await conn.query("UPDATE users SET ? WHERE username = ?", [
            userData,
            row.username,
          ]);
        } else {
          await conn.query("INSERT INTO users SET ?", userData);
        }
        userCount++;
      }
    }

    // ✅ บันทึกประวัติการนำเข้า
    await conn.query(
      "INSERT INTO import_logs (filename, count, performed_by) VALUES (?, ?, ?)",
      [
        req.file.originalname,
        memberCount + userCount,
        req.user?.username || "admin",
      ]
    );

    await conn.commit();
    res.json({
      message: `นำเข้าสำเร็จ`,
      members: memberCount,
      users: userCount,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("importData error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดระหว่างนำเข้า" });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (conn) conn.release();
  }
};

const exportData = async (req, res) => {
  const conn = await pool.getConnection();
  try {
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

    const [rows] = await conn.query(
      `
      SELECT
        m.member_id, m.prefix, m.full_name, m.nickname, m.id_card,
        DATE_FORMAT(m.birthday, '%Y-%m-%d') AS birthday,
        m.age, m.gender, m.religion, m.medical_conditions,
        m.allergy_history, m.address, m.phone, m.facebook,
        m.instagram, m.line_id, m.school, m.graduation_year,
        m.gpa, m.type, m.district,
        u.username, u.password_hash, u.role, u.email,
        DATE_FORMAT(u.created_at, '%Y-%m-%d') AS created_at,
        DATE_FORMAT(u.updated_at, '%Y-%m-%d') AS updated_at
      FROM members m
      LEFT JOIN users u ON u.member_id = m.member_id
      ${where}
      ORDER BY m.full_name
      `,
      params
    );

    const headers = Object.values(columnMap);
    const headersTH = Object.keys(columnMap);
    const data = rows.map((row) => headers.map((h) => row[h] ?? ""));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headersTH, ...data]);
    xlsx.utils.book_append_sheet(wb, ws, "รายชื่อสมาชิก");

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `members_and_users_export_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

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
    conn.release();
  }
};

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
      `SELECT COUNT(*) AS count FROM users u LEFT JOIN members m ON u.member_id = m.member_id ${where}`,
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
const logExport = async (req, res) => {
  try {
    const { filename, count, performed_by } = req.body;
    await pool.query(
      "INSERT INTO export_logs (filename, count, performed_by) VALUES (?, ?, ?)",
      [filename, count, performed_by]
    );
    res.json({ message: "บันทึกประวัติการส่งออกสำเร็จ" });
  } catch (err) {
    console.error("logExport error:", err);
    res.status(500).json({ error: "ไม่สามารถบันทึกประวัติการส่งออกได้" });
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
  logExport,
};
