// src/controllers/admin/AdminDataController.js

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const mysql = require("mysql2/promise");
require("dotenv").config();

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

// src/controllers/admin/AdminDataController.js

const importData = async (req, res) => {
  const { type } = req.query; // “members” | “users” | “both”
  if (!req.file) return res.status(400).json({ error: "ไม่มีไฟล์อัปโหลด" });

  const filePath = req.file.path;
  let conn;
  let memberCount = 0;
  let userCount = 0;

  try {
    // อ่าน workbook
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // ─── นำเข้า Members (หรือ both) ───────────────────────────
    if (type === "members" || type === "both") {
      const memberSheet =
        workbook.Sheets["Members"] || workbook.Sheets[sheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(memberSheet, { defval: "" });

      for (const row of rows) {
        const {
          member_id,
          prefix,
          full_name,
          nickname,
          id_card,
          birthday,
          age,
          gender,
          religion,
          medical_conditions,
          allergy_history,
          address,
          phone,
          facebook,
          instagram,
          line_id,
          school,
          graduation_year,
          gpa,
          type: mtype,
          district,
        } = row;

        // INSERT or UPDATE members
        const [memRes] = await conn.query(
          `INSERT INTO members (
             member_id, prefix, full_name, nickname, id_card, birthday, age, gender,
             religion, medical_conditions, allergy_history, address, phone,
             facebook, instagram, line_id, school, graduation_year, gpa, type, district
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             prefix             = VALUES(prefix),
             full_name          = VALUES(full_name),
             nickname           = VALUES(nickname),
             id_card            = VALUES(id_card),
             birthday           = VALUES(birthday),
             age                = VALUES(age),
             gender             = VALUES(gender),
             religion           = VALUES(religion),
             medical_conditions = VALUES(medical_conditions),
             allergy_history    = VALUES(allergy_history),
             address            = VALUES(address),
             phone              = VALUES(phone),
             facebook           = VALUES(facebook),
             instagram          = VALUES(instagram),
             line_id            = VALUES(line_id),
             school             = VALUES(school),
             graduation_year    = VALUES(graduation_year),
             gpa                = VALUES(gpa),
             type               = VALUES(type),
             district           = VALUES(district)`,
          [
            member_id,
            prefix,
            full_name,
            nickname,
            id_card,
            birthday ? new Date(birthday) : null,
            age,
            gender,
            religion,
            medical_conditions,
            allergy_history,
            address,
            phone,
            facebook,
            instagram,
            line_id,
            school,
            graduation_year,
            gpa,
            mtype,
            district,
          ]
        );

        if (memRes.affectedRows) {
          memberCount++;

          // สร้าง user อัตโนมัติ (approved=0) เมื่อเพิ่มสมาชิก
          await conn.query(
            `INSERT IGNORE INTO users (
               member_id, created_at, updated_at, approved, notifications_enabled
             ) VALUES (?, NOW(), NOW(), 0, 1)`,
            [member_id]
          );
          userCount++;
        }
      }
    }

    // ─── นำเข้า Users ────────────────────────────────
    if (type === "users" || type === "both") {
      const userSheet =
        workbook.Sheets["Users"] ||
        workbook.Sheets[sheetNames[type === "both" ? 1 : 0]];
      const rows = xlsx.utils.sheet_to_json(userSheet, { defval: "" });

      for (const row of rows) {
        const {
          username,
          password_hash,
          role,
          member_id,
          email,
          created_at,
          updated_at,
          approved,
          notifications_enabled,
        } = row;

        // แทรกสมาชิกก่อนถ้ายังไม่มี (เพื่อให้ FK ไม่ผิด)
        if (member_id) {
          await conn.query(
            `INSERT IGNORE INTO members (member_id) VALUES (?)`,
            [member_id]
          );
        }

        // ตรวจสอบก่อนว่ามี user record สำหรับ member_id แล้วหรือยัง
        const [[existing]] = await conn.query(
          `SELECT user_id, password_hash
         FROM users
        WHERE member_id = ?`,
          [member_id]
        );

        if (!existing) {
          // ── กรณี 1: ยังไม่มี user record เลย => INSERT ใหม่ ──
          const [usrRes] = await conn.query(
            `INSERT INTO users (
           username, password_hash, role, member_id, email,
           created_at, updated_at, approved, notifications_enabled
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              username,
              password_hash,
              role,
              member_id || null,
              email || null,
              created_at ? new Date(created_at) : new Date(),
              updated_at ? new Date(updated_at) : new Date(),
              approved ? 1 : 0,
              notifications_enabled ? 1 : 0,
            ]
          );
          if (usrRes.affectedRows) userCount++;
        } else if (!existing.password_hash) {
          // ── กรณี 2: มี record แต่ยังไม่มี password_hash => UPDATE ให้มี password ──
          const [updRes] = await conn.query(
            `UPDATE users SET
           username               = ?,
           password_hash          = ?,
           role                   = ?,
           email                  = ?,
           updated_at             = ?,
           approved               = ?,
           notifications_enabled  = ?
         WHERE user_id = ?`,
            [
              username,
              password_hash,
              role,
              email || null,
              updated_at ? new Date(updated_at) : new Date(),
              approved ? 1 : 0,
              notifications_enabled ? 1 : 0,
              existing.user_id,
            ]
          );
          if (updRes.affectedRows) userCount++;
        }
        // else: มี user + password แล้ว -> ข้าม
      }
    }

    await conn.commit();

    // บันทึก import_logs
    const filename = path.basename(filePath);
    const total =
      type === "both"
        ? memberCount + userCount
        : type === "members"
        ? memberCount
        : userCount;

    await pool.query(
      `INSERT INTO import_logs (type, filename, count, created_at)
       VALUES (?, ?, ?, NOW())`,
      [type, filename, total]
    );

    res.json({ message: `นำเข้า ${type} สำเร็จ`, count: total });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "นำเข้าไม่สำเร็จ" });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (conn) conn.release();
  }
};

// ส่งออกข้อมูล (members หรือ users) พร้อมตัวกรอง
const exportData = async (req, res) => {
  const { type, district, generation, memberType } = req.query;
  let conn;

  try {
    conn = await pool.getConnection();
    let rows;

    if (type === "members") {
      const clauses = [],
        params = [];
      if (district) {
        clauses.push("district = ?");
        params.push(district);
      }
      if (generation) {
        clauses.push("graduation_year = ?");
        params.push(generation);
      }
      if (memberType) {
        clauses.push("type = ?");
        params.push(memberType);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const sql = `SELECT * FROM members ${where} ORDER BY full_name`;
      const [result] = await conn.query(sql, params);
      rows = result;
    } else if (type === "users") {
      const clauses = [],
        params = [];
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
      const sql = `
        SELECT
          u.user_id                AS user_id,
          u.username               AS username,
          u.password_hash          AS password_hash,
          u.role                   AS role,
          u.member_id              AS member_id,
          u.email                  AS email,
          DATE_FORMAT(u.created_at, '%d/%m/%Y') AS created_at,
          DATE_FORMAT(u.updated_at, '%d/%m/%Y') AS updated_at,
          u.approved               AS approved,
          u.notifications_enabled  AS notifications_enabled,
          m.full_name          AS full_name,
          /* แปลงวันเกิดเป็น DDMMYYYY (พุทธศักราช) */
          CONCAT(LPAD(DAY(m.birthday),2,'0'), LPAD(MONTH(m.birthday),2,'0'), YEAR(m.birthday) + 543) AS birthday,
          m.district               AS district,
          m.id_card                AS id_card,
          m.type                   AS member_type,
          m.graduation_year        AS generation
        FROM users u
        LEFT JOIN members m ON u.member_id = m.member_id
        ${where}
        ORDER BY u.username
      `;
      const [result] = await conn.query(sql, params);
      rows = result;
    } else {
      return res.status(400).json({ error: "type ไม่ถูกต้อง" });
    }

    // สร้างไฟล์ Excel
    const headers = Object.keys(rows[0] || {});
    const data = rows.map((r) => headers.map((h) => r[h] ?? ""));
    const ws = xlsx.utils.aoa_to_sheet([headers, ...data]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(
      wb,
      ws,
      type === "members" ? "Members" : "Users"
    );

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${type}_export_${date}.xlsx`;

    // บันทึกประวัติการส่งออก
    await pool.query(
      `INSERT INTO export_logs (type, filename, count, created_at)
       VALUES (?, ?, ?, NOW())`,
      [type, filename, rows.length]
    );

    // ส่งไฟล์กลับ
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ส่งออกไม่สำเร็จ" });
  } finally {
    if (conn) conn.release();
  }
};

// ดึงตัวเลือกตัวกรองจากฐานข้อมูล
const getFilters = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [districts] = await conn.query(
      "SELECT DISTINCT district FROM members WHERE district <> ''"
    );
    const [generations] = await conn.query(
      "SELECT DISTINCT graduation_year FROM members WHERE graduation_year <> ''"
    );
    const [memberTypes] = await conn.query(
      "SELECT DISTINCT type FROM members WHERE type <> ''"
    );
    conn.release();
    res.json({
      districts: districts.map((r) => r.district),
      generations: generations.map((r) => r.graduation_year),
      memberTypes: memberTypes.map((r) => r.type),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ไม่สามารถดึงตัวกรองได้" });
  }
};

// ดึงประวัติการนำเข้า
const getImportLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM import_logs ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ไม่สามารถดึงประวัติการนำเข้าได้" });
  }
};

// ดึงประวัติการส่งออก
const getExportLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM export_logs ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ไม่สามารถดึงประวัติการส่งออกได้" });
  }
};

// สรุปจำนวนสมาชิกและผู้ใช้ตาม filters
const getSummary = async (req, res) => {
  try {
    const { district, generation, memberType } = req.query;
    const clauses = [],
      params = [];
    if (district) {
      clauses.push("district = ?");
      params.push(district);
    }
    if (generation) {
      clauses.push("graduation_year = ?");
      params.push(generation);
    }
    if (memberType) {
      clauses.push("type = ?");
      params.push(memberType);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const [[memCount]] = await pool.query(
      `SELECT COUNT(*) AS count FROM members ${where}`,
      params
    );
    const [[userCount]] = await pool.query(
      `SELECT COUNT(*) AS count FROM users`
    );

    res.json({ members: memCount.count, users: userCount.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ไม่สามารถดึงสรุปได้" });
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
