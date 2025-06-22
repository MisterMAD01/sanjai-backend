// mymemberController.js
// Controller สำหรับดึงและแก้ไขข้อมูลสมาชิก โดยใช้ MySQL pool และเชื่อมโยงกับตาราง users หรือ JWT payload

const jwt = require("jsonwebtoken");
const pool = require("../../config/db");

/**
 * Middleware: ตรวจสอบ JWT และดึง userId และ memberId ไปใช้ใน req
 */
exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // user_id ในตาราง users
    req.userId = payload.sub ? parseInt(payload.sub, 10) : null;
    // ถ้า JWT payload มี member_id (หรือ memberId) ก็เซ็ตไว้
    req.memberId = payload.member_id || payload.memberId || null;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * ฟังก์ชันช่วยดึง member_id: ถ้ามีใน JWT, return; ถ้าไม่, ดึงจากตาราง users
 */
async function resolveMemberId(conn, req) {
  if (req.memberId) {
    return req.memberId;
  }
  const [userRows] = await conn.query(
    "SELECT member_id FROM users WHERE user_id = ?",
    [req.userId]
  );
  if (userRows.length === 0) {
    throw { status: 404, message: "User not found" };
  }
  return userRows[0].member_id;
}

/**
 * GET /api/my-member
 * ดึงข้อมูลสมาชิก (display)
 */
exports.getMyMemberInfo = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const memberId = await resolveMemberId(conn, req);

    let [memberRows] = await conn.query(
      "SELECT * FROM members WHERE member_id = ?",
      [memberId]
    );
    let member = memberRows[0];
    if (!member) {
      // สร้าง record เปล่าถ้ายังไม่มี
      await conn.query("INSERT INTO members (member_id) VALUES (?)", [
        memberId,
      ]);
      [memberRows] = await conn.query(
        "SELECT * FROM members WHERE member_id = ?",
        [memberId]
      );
      member = memberRows[0];
    }
    return res.status(200).json(member);
  } catch (err) {
    console.error("Error in getMyMemberInfo:", err);
    const status = err.status || 500;
    const message = err.message || "Server error fetching member info";
    return res.status(status).json({ message });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * PUT /api/my-member
 * แก้ไขข้อมูลสมาชิก (edit)
 */
exports.updateMyMemberInfo = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const memberId = await resolveMemberId(conn, req);

    const updates = { ...req.body };
    if (updates.birthday) {
      updates.birthday = new Date(updates.birthday);
    }
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = Object.values(updates);
    if (!fields) {
      return res.status(400).json({ message: "No fields to update" });
    }

    await conn.query(`UPDATE members SET ${fields} WHERE member_id = ?`, [
      ...values,
      memberId,
    ]);
    const [memberRows] = await conn.query(
      "SELECT * FROM members WHERE member_id = ?",
      [memberId]
    );
    const member = memberRows[0];
    return res.status(200).json(member);
  } catch (err) {
    console.error("Error in updateMyMemberInfo:", err);
    const status = err.status || 500;
    const message = err.message || "Server error updating member info";
    return res.status(status).json({ message });
  } finally {
    if (conn) conn.release();
  }
};
