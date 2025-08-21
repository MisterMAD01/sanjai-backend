const pool = require("../../config/db"); // สมมติ pool คือ MySQL connection pool
const ExcelJS = require("exceljs"); // เพิ่มบรรทัดนี้

const PointsController = {
  // ดูสรุปแต้มสมาชิกทั้งหมด (เฉพาะคนที่เข้าร่วมกิจกรรม)
  getAllMemberPoints: async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT m.member_id, m.full_name, m.nickname, 
                SUM(mp.points_awarded) AS total_points,
                COUNT(mp.event_id) AS activities_participated
         FROM members m
         INNER JOIN member_points mp ON m.member_id = mp.member_id
         GROUP BY m.member_id, m.full_name, m.nickname
         ORDER BY total_points DESC`
      );

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },

  /// ดูรายละเอียดแต้มของสมาชิกคนเดียว (เฉพาะกิจกรรมที่เข้าร่วม)
  getMemberPointsById: async (req, res) => {
    try {
      const { member_id } = req.params;

      // ดึงข้อมูลสมาชิก
      const [memberRows] = await pool.query(
        `SELECT member_id, full_name, nickname
       FROM members
       WHERE member_id = ?`,
        [member_id]
      );

      if (memberRows.length === 0) {
        return res.status(404).json({ message: "Member not found" });
      }

      const member = memberRows[0];

      // ดึงกิจกรรมและคะแนนเฉพาะที่เข้าร่วม
      const [activityRows] = await pool.query(
        `SELECT ea.event_id, ea.event_name, ea.event_date,
              mp.points_awarded
       FROM event_activities ea
       INNER JOIN member_points mp
       ON ea.event_id = mp.event_id
       WHERE mp.member_id = ?
       ORDER BY ea.event_date DESC`,
        [member_id]
      );

      const totalPoints = activityRows.reduce(
        (sum, r) => sum + r.points_awarded,
        0
      );

      res.json({
        member_id: member.member_id,
        full_name: member.full_name,
        nickname: member.nickname,
        total_points: totalPoints,
        activities_participated: activityRows.length,
        activities: activityRows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },
  // controllers/admin/pointsController.js
  exportAllMemberPoints: async (req, res) => {
    try {
      // ดึงข้อมูลเฉพาะสมาชิกที่มีคะแนน (เข้าร่วมกิจกรรม)
      const [rows] = await pool.query(
        `SELECT m.member_id, m.full_name, 
              SUM(mp.points_awarded) AS total_points,
              COUNT(mp.event_id) AS activities_participated
       FROM members m
       INNER JOIN member_points mp ON m.member_id = mp.member_id
       GROUP BY m.member_id, m.full_name
       ORDER BY total_points DESC`
      );

      if (!rows.length) {
        return res.status(404).json({ message: "ไม่พบสมาชิกที่มีคะแนน" });
      }

      // สร้าง Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Member Points Report");

      // ตั้งค่า header style
      worksheet.columns = [
        { header: "ลำดับ", key: "index", width: 10 },
        { header: "รหัสสมาชิก", key: "member_id", width: 15 },
        { header: "ชื่อ-นามสกุล", key: "full_name", width: 30 },
        { header: "จำนวนกิจกรรม", key: "activities_participated", width: 20 },
        { header: "คะแนนรวม", key: "total_points", width: 15 },
      ];

      // จัดรูปแบบ header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      // เพิ่มข้อมูล
      rows.forEach((row, index) => {
        worksheet.addRow({
          index: index + 1,
          member_id: row.member_id,
          full_name: row.full_name,
          activities_participated: row.activities_participated,
          total_points: row.total_points,
        });
      });

      // ตั้งค่า response headers
      const currentDate = new Date().toISOString().split("T")[0];
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=member_points_${currentDate}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
};

module.exports = PointsController;
