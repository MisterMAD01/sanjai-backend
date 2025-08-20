const pool = require("../../config/db");
const ExcelJS = require("exceljs");

const EventActivityController = {
  // ดึงรายการกิจกรรมทั้งหมด
  getAllActivities: async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM event_activities ORDER BY event_date DESC"
      );
      res.json(rows);
    } catch (err) {
      console.error("Error getAllActivities:", err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ดึงรายละเอียดกิจกรรมตาม ID
  getActivityById: async (req, res) => {
    try {
      const { activityId } = req.params;
      const [rows] = await pool.query(
        "SELECT * FROM event_activities WHERE event_id = ?",
        [activityId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error("Error getActivityById:", err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // เพิ่มกิจกรรมใหม่
  createActivity: async (req, res) => {
    try {
      const { event_name, event_date, location, points, description } =
        req.body;
      const [result] = await pool.query(
        `INSERT INTO event_activities (event_name, event_date, location, points, description) 
         VALUES (?, ?, ?, ?, ?)`,
        [event_name, event_date, location, points, description]
      );
      res
        .status(201)
        .json({ message: "Activity created", event_id: result.insertId });
    } catch (err) {
      console.error("Error createActivity:", err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // แก้ไขกิจกรรม
  updateActivity: async (req, res) => {
    try {
      const { activityId } = req.params;
      const { event_name, event_date, location, points, description } =
        req.body;
      const [result] = await pool.query(
        `UPDATE event_activities 
         SET event_name=?, event_date=?, location=?, points=?, description=? 
         WHERE event_id=?`,
        [event_name, event_date, location, points, description, activityId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }
      res.json({ message: "Activity updated" });
    } catch (err) {
      console.error("Error updateActivity:", err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ลบกิจกรรม
  deleteActivity: async (req, res) => {
    try {
      const { activityId } = req.params;
      const [result] = await pool.query(
        "DELETE FROM event_activities WHERE event_id=?",
        [activityId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }
      res.json({ message: "Activity deleted" });
    } catch (err) {
      console.error("Error deleteActivity:", err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ลบผู้เข้าร่วมกิจกรรมและคะแนนที่เกี่ยวข้อง
  deleteParticipants: async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { activityId } = req.params;

      await conn.beginTransaction();

      // ลบคะแนนของสมาชิกที่เกี่ยวข้องกับกิจกรรมนี้
      await conn.query(`DELETE FROM member_points WHERE event_id = ?`, [
        activityId,
      ]);

      // ลบผู้เข้าร่วมกิจกรรม
      const [result] = await conn.query(
        `DELETE FROM event_applicants WHERE event_id = ?`,
        [activityId]
      );

      await conn.commit();

      res.json({
        message:
          "All participants and their points have been deleted for this activity",
        deletedCount: result.affectedRows,
        activityId,
      });
    } catch (err) {
      await conn.rollback();
      console.error("Error deleteParticipants:", err);
      res.status(500).json({ message: "Server error" });
    } finally {
      conn.release();
    }
  },

  // ลงทะเบียนสมาชิกเข้าร่วมกิจกรรม
  registerForActivity: async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { activityId } = req.params;
      const { member_id } = req.body;

      await conn.beginTransaction();

      // ตรวจสอบว่ามีสมาชิกอยู่จริง
      const [memberRows] = await conn.query(
        `SELECT member_id, full_name FROM members WHERE member_id = ?`,
        [member_id]
      );
      if (memberRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: "Member not found" });
      }
      const member = memberRows[0];

      // ตรวจสอบว่าผู้เข้าร่วมยังไม่ลงทะเบียนซ้ำ
      const [existing] = await conn.query(
        `SELECT * FROM event_applicants WHERE event_id = ? AND member_id = ?`,
        [activityId, member_id]
      );
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(400).json({ message: "Member already registered" });
      }

      // เพิ่มผู้เข้าร่วม
      await conn.query(
        `INSERT INTO event_applicants (event_id, member_id) VALUES (?, ?)`,
        [activityId, member_id]
      );

      // ดึงคะแนนกิจกรรม
      const [activityRows] = await conn.query(
        `SELECT points FROM event_activities WHERE event_id = ?`,
        [activityId]
      );
      const points = activityRows[0]?.points || 0;

      // เพิ่มแต้มให้สมาชิก
      await conn.query(
        `INSERT INTO member_points (member_id, event_id, points_awarded) VALUES (?, ?, ?)`,
        [member_id, activityId, points]
      );

      await conn.commit();

      // ส่งกลับข้อมูลสมาชิกพร้อมคะแนนให้ frontend แสดง
      res.json({
        message: "Member registered and points awarded",
        member: {
          member_id: member.member_id,
          full_name: member.full_name,
        },
        points,
      });
    } catch (err) {
      await conn.rollback();
      console.error("Error registerForActivity:", err);
      res.status(500).json({ message: "Server error" });
    } finally {
      conn.release();
    }
  },

  // ดึงรายชื่อผู้เข้าร่วมกิจกรรม
  getParticipants: async (req, res) => {
    try {
      const { activityId } = req.params;
      const [rows] = await pool.query(
        `SELECT 
         ea.id,
         m.member_id,
         m.full_name,
         m.graduation_year,  -- รุ่น
         m.district,         -- อำเภอ
         m.phone,            -- เบอร์โทร
         ea.registered_at
       FROM event_applicants ea
       JOIN members m ON ea.member_id = m.member_id
       WHERE ea.event_id = ?`,
        [activityId]
      );
      res.json(rows);
    } catch (err) {
      console.error("Error getParticipants:", err);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ดาวน์โหลดรายชื่อผู้เข้าร่วมกิจกรรมเป็น Excel
  downloadParticipants: async (req, res) => {
    try {
      const { activityId } = req.params;

      // ดึงข้อมูลกิจกรรม
      const [activityRows] = await pool.query(
        `SELECT event_name, event_date, location, description FROM event_activities WHERE event_id = ?`,
        [activityId]
      );

      if (activityRows.length === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const activity = activityRows[0];

      // ดึงข้อมูลผู้เข้าร่วม
      const [participantsRows] = await pool.query(
        `SELECT 
        ea.id,
        m.member_id,
        m.full_name,
        m.graduation_year,
        m.district,
        m.phone,
        ea.registered_at
       FROM event_applicants ea
       JOIN members m ON ea.member_id = m.member_id
       WHERE ea.event_id = ?
       ORDER BY ea.registered_at`,
        [activityId]
      );

      if (participantsRows.length === 0) {
        return res.status(404).json({ message: "No participants found" });
      }

      // สร้าง workbook และ worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("รายชื่อผู้เข้าร่วม");

      workbook.creator = "Activity Management System";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.title = `รายชื่อผู้เข้าร่วมกิจกรรม - ${activity.event_name}`;

      // Header ข้อมูลกิจกรรม
      worksheet.mergeCells("A1:F1");
      worksheet.getCell("A1").value = "รายชื่อผู้เข้าร่วมกิจกรรม";
      worksheet.getCell("A1").font = {
        name: "TH Sarabun",
        size: 16,
        bold: true,
      };
      worksheet.getCell("A1").alignment = { horizontal: "center" };

      worksheet.mergeCells("A2:F2");
      worksheet.getCell("A2").value = `ชื่อกิจกรรม: ${activity.event_name}`;
      worksheet.getCell("A2").font = { name: "TH Sarabun", bold: true };

      worksheet.mergeCells("A3:F3");
      worksheet.getCell("A3").value = `วันที่จัดกิจกรรม: ${new Date(
        activity.event_date
      ).toLocaleDateString("th-TH")}`;
      worksheet.getCell("A3").font = { name: "TH Sarabun", bold: true };

      worksheet.mergeCells("A4:F4");
      worksheet.getCell("A4").value = `สถานที่: ${activity.location || "-"}`;
      worksheet.getCell("A4").font = { name: "TH Sarabun", bold: true };

      worksheet.mergeCells("A5:F5");
      worksheet.getCell(
        "A5"
      ).value = `จำนวนผู้เข้าร่วม: ${participantsRows.length} คน`;
      worksheet.getCell("A5").font = { name: "TH Sarabun", bold: true };

      const headerRow = 7;
      const headers = [
        "ลำดับ",
        "เลขที่",
        "ชื่อ-สกุล",
        "รุ่น",
        "อำเภอ",
        "เบอร์โทร",
      ];

      // เพิ่ม headers
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(headerRow, index + 1);
        cell.value = header;
        cell.font = { name: "TH Sarabun", bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // เพิ่มข้อมูลผู้เข้าร่วม
      participantsRows.forEach((participant, index) => {
        const row = headerRow + 1 + index;
        const rowData = [
          index + 1,
          participant.member_id,
          participant.full_name || "-",
          participant.graduation_year || "-",
          participant.district || "-",
          participant.phone || "-",
        ];

        rowData.forEach((data, colIndex) => {
          const cell = worksheet.getCell(row, colIndex + 1);
          cell.value = data;
          cell.font = { name: "TH Sarabun", size: 12 };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          cell.alignment =
            colIndex === 0
              ? { horizontal: "center", vertical: "middle" }
              : { horizontal: "left", vertical: "middle" };
        });
      });

      // ปรับความกว้าง columns
      const columnWidths = [8, 15, 25, 12, 20, 15];
      columnWidths.forEach(
        (width, index) => (worksheet.getColumn(index + 1).width = width)
      );

      // สร้างชื่อไฟล์
      const activityName = activity.event_name
        .replace(/[^a-zA-Z0-9ก-๙\s]/g, "")
        .substring(0, 30);
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      const filename = `participants_${activityName}_${timestamp}.xlsx`;

      // Log การ export (ไม่สำคัญกับไฟล์ Excel)
      try {
        await pool.query(
          `INSERT INTO export_logs (type, filename, performed_by, count, created_at) VALUES (?, ?, ?, ?, NOW())`,
          [
            "members",
            filename,
            req.user?.username || "system",
            participantsRows.length,
          ]
        );
      } catch (logError) {
        console.warn("Failed to log export activity:", logError);
      }

      // ✅ โค้ดที่แก้ไขแล้ว: ส่งไฟล์ Excel โดยตรง
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(filename)}"`
      );
      res.setHeader("Cache-Control", "no-cache");

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error("Error downloadParticipants:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
};
module.exports = EventActivityController;
