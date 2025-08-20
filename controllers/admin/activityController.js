const pool = require("../../config/db");
const fs = require("fs");
const path = require("path");
const allowedTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "application/pdf", // เพิ่ม PDF ด้วย
];

exports.createActivity = async (req, res) => {
  const { name, date, detail, location, register_open } = req.body;
  const scheduleFile = req.files?.schedule?.[0];
  const qrFile = req.files?.qr?.[0];

  const invalidFiles = [scheduleFile, qrFile].filter(
    (file) => file && !allowedTypes.includes(file.mimetype)
  );

  if (invalidFiles.length > 0) {
    invalidFiles.forEach((file) =>
      fs.unlink(path.join(__dirname, "../../uploads", file.filename), (err) => {
        if (err) console.error("ลบไฟล์ไม่สำเร็จ:", err);
      })
    );
    return res.status(400).json({
      message: "รองรับเฉพาะไฟล์รูปภาพ (jpeg, jpg, png, gif) และ PDF เท่านั้น",
    });
  }

  const image_path_schedule = scheduleFile ? scheduleFile.filename : null;
  const image_path_qr = qrFile ? qrFile.filename : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO activities 
        (name, date, detail, location, image_path_schedule, image_path_qr, register_open) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        date,
        detail,
        location,
        image_path_schedule,
        image_path_qr,
        register_open ? 1 : 0,
      ]
    );
    res
      .status(201)
      .json({ message: "สร้างกิจกรรมสำเร็จ", id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "สร้างกิจกรรมไม่สำเร็จ" });
  }
};

exports.updateActivity = async (req, res) => {
  const { id } = req.params;
  const { name, date, detail, location, register_open } = req.body;
  const scheduleFile = req.files?.schedule?.[0];
  const qrFile = req.files?.qr?.[0];

  const invalidFiles = [scheduleFile, qrFile].filter(
    (file) => file && !allowedTypes.includes(file.mimetype)
  );

  if (invalidFiles.length > 0) {
    invalidFiles.forEach((file) =>
      fs.unlink(path.join(__dirname, "../../uploads", file.filename), (err) => {
        if (err) console.error("ลบไฟล์ไม่สำเร็จ:", err);
      })
    );
    return res.status(400).json({
      message: "รองรับเฉพาะไฟล์รูปภาพเท่านั้น (jpeg, jpg, png, gif)",
    });
  }

  const [old] = await pool.query(
    "SELECT image_path_schedule, image_path_qr FROM activities WHERE id = ?",
    [id]
  );

  if (scheduleFile && old[0]?.image_path_schedule) {
    fs.unlink(
      path.join(__dirname, "../../uploads", old[0].image_path_schedule),
      () => {}
    );
  }

  if (qrFile && old[0]?.image_path_qr) {
    fs.unlink(
      path.join(__dirname, "../../uploads", old[0].image_path_qr),
      () => {}
    );
  }

  const updates = [];
  const values = [];

  updates.push("name=?");
  values.push(name);
  updates.push("date=?");
  values.push(date);
  updates.push("detail=?");
  values.push(detail);
  updates.push("location=?");
  values.push(location);
  updates.push("register_open=?");
  values.push(register_open ? 1 : 0);

  if (scheduleFile) {
    updates.push("image_path_schedule=?");
    values.push(scheduleFile.filename);
  }

  if (qrFile) {
    updates.push("image_path_qr=?");
    values.push(qrFile.filename);
  }

  values.push(id);

  try {
    await pool.query(
      `UPDATE activities SET ${updates.join(", ")} WHERE id=?`,
      values
    );
    res.json({ message: "แก้ไขกิจกรรมสำเร็จ" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "แก้ไขกิจกรรมไม่สำเร็จ" });
  }
};

exports.toggleRegisterOpen = async (req, res) => {
  const { id } = req.params;
  const { register_open } = req.body;

  try {
    await pool.query("UPDATE activities SET register_open=? WHERE id=?", [
      register_open ? 1 : 0,
      id,
    ]);
    res.json({ message: `เปิด-ปิดรับสมัครสำเร็จ: ${register_open}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "เปิด-ปิดรับสมัครไม่สำเร็จ" });
  }
};

exports.getApplicants = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM applicants WHERE activity_id=? ORDER BY registered_at DESC",
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "ดึงข้อมูลผู้สมัครไม่สำเร็จ" });
  }
};

exports.getAllActivities = async (req, res) => {
  try {
    const [activities] = await pool.query("SELECT * FROM activities");
    res.json({ activities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "โหลดกิจกรรมไม่สำเร็จ" });
  }
};

exports.downloadApplicantsExcel = async (req, res) => {
  const { id } = req.params;

  try {
    const [activityRows] = await pool.query(
      "SELECT name FROM activities WHERE id = ?",
      [id]
    );

    if (activityRows.length === 0) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    const activityName = activityRows[0].name;

    const [applicants] = await pool.query(
      `SELECT 
         a.member_id,
         m.prefix,
         m.full_name,
         a.phone,
         a.registered_at,
         u.email
       FROM applicants a
       LEFT JOIN users u ON a.member_id = u.member_id
       LEFT JOIN members m ON a.member_id = m.member_id
       WHERE a.activity_id = ?
       ORDER BY a.registered_at DESC`,
      [id]
    );

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Applicants");

    worksheet.columns = [
      { header: "เลขที่สมาชิก", key: "member_id", width: 15 },
      { header: "ชื่อ", key: "name", width: 30 },
      { header: "อีเมล", key: "email", width: 30 },
      { header: "เบอร์โทรศัพท์", key: "phone", width: 20 },
      { header: "วันที่สมัคร", key: "registered_at", width: 20 },
    ];

    applicants.forEach((applicant) => {
      // สร้างตัวแปร date ก่อน
      const date = new Date(applicant.registered_at);

      const thaiMonths = [
        "มกราคม",
        "กุมภาพันธ์",
        "มีนาคม",
        "เมษายน",
        "พฤษภาคม",
        "มิถุนายน",
        "กรกฎาคม",
        "สิงหาคม",
        "กันยายน",
        "ตุลาคม",
        "พฤศจิกายน",
        "ธันวาคม",
      ];

      const day = date.getDate();
      const monthName = thaiMonths[date.getMonth()];
      const year = date.getFullYear() + 543;

      const formattedDate = `${day} ${monthName} ${year}`;

      worksheet.addRow({
        member_id: applicant.member_id,
        name: `${applicant.prefix || ""}${applicant.full_name || "-"}`,
        email: applicant.email || "-",
        phone: applicant.phone,
        registered_at: formattedDate,
      });
    });

    const safeActivityName = activityName.replace(/[\\/:*?"<>|]/g, "_");
    const filename = `รายชื่อผู้เข้าร่วมกิจกรรม_${safeActivityName}.xlsx`;
    const encodedFileName = encodeURIComponent(filename);

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodedFileName}`
    );

    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "ดาวน์โหลดรายชื่อผู้สมัครไม่สำเร็จ" });
  }
};

exports.deleteActivity = async (req, res) => {
  const { id } = req.params;

  try {
    // ดึงข้อมูลไฟล์เก่าก่อนลบ
    const [rows] = await pool.query(
      "SELECT image_path_schedule, image_path_qr FROM activities WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบกิจกรรมที่ต้องการลบ" });
    }

    // ลบไฟล์ schedule ถ้ามี
    if (rows[0].image_path_schedule) {
      const schedulePath = path.join(
        __dirname,
        "../../uploads",
        rows[0].image_path_schedule
      );
      fs.unlink(schedulePath, (err) => {
        if (err) console.error("ลบไฟล์ schedule ไม่สำเร็จ:", err);
      });
    }

    // ลบไฟล์ qr ถ้ามี
    if (rows[0].image_path_qr) {
      const qrPath = path.join(
        __dirname,
        "../../uploads",
        rows[0].image_path_qr
      );
      fs.unlink(qrPath, (err) => {
        if (err) console.error("ลบไฟล์ QR ไม่สำเร็จ:", err);
      });
    }

    // ลบกิจกรรมจากฐานข้อมูล
    await pool.query("DELETE FROM activities WHERE id = ?", [id]);

    res.json({ message: "ลบกิจกรรมสำเร็จ" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "ลบกิจกรรมไม่สำเร็จ" });
  }
};
