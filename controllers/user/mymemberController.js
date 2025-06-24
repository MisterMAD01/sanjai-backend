// B:\Coding\sanjaithai_web\sanjai-backend\controllers\user\mymemberController.js
const pool = require("../../config/db"); // ตรวจสอบ path นี้

// **REMOVED: The 'authenticate' middleware block has been removed from here.**
// **REMOVED: const jwt = require("jsonwebtoken");** // ไม่จำเป็นต้องใช้ jwt ที่นี่แล้ว

/**
 * ฟังก์ชันช่วยดึง member_id: ถ้ามีใน JWT, return; ถ้าไม่, ดึงจากตาราง users
 */
async function resolveMemberId(conn, req) {
  // DEBUGGING: Log req.userId and req.memberId as seen by the controller
  console.log("DEBUG: resolveMemberId - req.userId:", req.userId);
  console.log("DEBUG: resolveMemberId - req.memberId:", req.memberId);

  // Option 1: ใช้ memberId ที่ถูกเซ็ตมาจาก JWT payload โดย authMiddleware.js
  if (req.memberId) {
    return req.memberId;
  }

  // Option 2: ถ้าไม่มี memberId ใน JWT (ซึ่งไม่ควรเกิดขึ้นหาก sign ถูกต้อง)
  // ให้ลองดึงจากตาราง 'users' โดยใช้ req.userId ที่ได้จาก JWT payload
  const userIdFromToken = req.userId; // ใช้ req.userId ที่ถูกกำหนดโดย authMiddleware.js

  // ตรวจสอบความถูกต้องของ userIdFromToken ก่อนทำการ query DB
  if (!userIdFromToken || isNaN(userIdFromToken)) {
    console.error(
      "resolveMemberId: Invalid userIdFromToken. Value:",
      userIdFromToken
    );
    throw {
      status: 400,
      message: "Invalid user ID from token or not logged in",
    };
  }

  const [userRows] = await conn.query(
    "SELECT member_id FROM users WHERE user_id = ?",
    [userIdFromToken]
  );

  if (userRows.length === 0) {
    // นี่คือข้อผิดพลาด "User not found" ที่คุณได้รับ
    console.error(
      `resolveMemberId: No user found in 'users' table for user_id: ${userIdFromToken}`
    );
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
    const memberId = await resolveMemberId(conn, req); // memberId ควรเป็นตัวเลขที่ถูกต้อง

    let [memberRows] = await conn.query(
      "SELECT * FROM members WHERE member_id = ?",
      [memberId]
    );
    let member = memberRows[0];
    if (!member) {
      // สร้าง record เปล่าในตาราง members ถ้ายังไม่มีสำหรับ memberId นี้
      console.log(`Creating new member record for member_id: ${memberId}`);
      await conn.query("INSERT INTO members (member_id) VALUES (?)", [
        memberId,
      ]);
      // ดึงข้อมูลกลับมาอีกครั้งหลังจากสร้าง
      [memberRows] = await conn.query(
        "SELECT * FROM members WHERE member_id = ?",
        [memberId]
      );
      member = memberRows[0];
    }
    // API returns { member: {...} } as per frontend expectation
    return res.status(200).json({ member });
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
      // ตรวจสอบการแปลงค่าวันที่สำหรับ MySQL
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
    return res.status(200).json({ member, message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    console.error("Error in updateMyMemberInfo:", err);
    const status = err.status || 500;
    const message = err.message || "Server error updating member info";
    return res.status(status).json({ message });
  } finally {
    if (conn) conn.release();
  }
};
