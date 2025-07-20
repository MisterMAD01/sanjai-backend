const pool = require("../../config/db");

exports.getOpenActivities = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        id, name, date, location, detail, image_path_schedule, image_path_qr 
       FROM activities 
       WHERE register_open=1 
       ORDER BY date DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "ดึงกิจกรรมไม่สำเร็จ" });
  }
};

exports.getActivityById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT 
         id, name, date, location, detail, image_path_schedule, image_path_qr 
       FROM activities 
       WHERE id=? AND register_open=1`,
      [id]
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "ไม่พบกิจกรรม หรือปิดรับสมัครแล้ว" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "ดึงกิจกรรมไม่สำเร็จ" });
  }
};

exports.registerForActivity = async (req, res) => {
  const activityId = req.params.id;
  const memberId = req.user.memberId; // ได้จาก token
  const phone = req.body.phone;

  if (!phone) {
    return res.status(400).json({ message: "กรุณากรอกเบอร์โทรศัพท์" });
  }

  try {
    // เช็คว่ามีการสมัครแล้วหรือยัง
    const [existing] = await pool.query(
      "SELECT * FROM applicants WHERE activity_id = ? AND member_id = ?",
      [activityId, memberId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "คุณได้สมัครกิจกรรมนี้แล้ว" });
    }

    // ดึงชื่อสมาชิกจากฐานข้อมูล
    const [rows] = await pool.query(
      "SELECT full_name FROM members WHERE member_id = ?",
      [memberId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "ไม่พบข้อมูลสมาชิก" });
    }

    const name = rows[0].full_name;

    if (!name) {
      return res.status(400).json({ message: "สมาชิกไม่มีชื่อในระบบ" });
    }

    // บันทึกข้อมูลลง applicants
    await pool.query(
      "INSERT INTO applicants (activity_id, name, member_id, phone) VALUES (?, ?, ?, ?)",
      [activityId, name, memberId, phone]
    );

    res.json({ message: "ลงทะเบียนสำเร็จ" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "ลงทะเบียนไม่สำเร็จ" });
  }
};

exports.getUserRegisteredActivities = async (req, res) => {
  const memberId = req.user.memberId;

  try {
    const [rows] = await pool.query(
      `SELECT a.activity_id, ac.name, ac.date, ac.location, ac.detail, ac.image_path_schedule, ac.image_path_qr
   FROM applicants a
   JOIN activities ac ON a.activity_id = ac.id
   WHERE a.member_id = ?`,
      [memberId]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "ดึงกิจกรรมที่สมัครไม่สำเร็จ" });
  }
};
