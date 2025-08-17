const pool = require("../../config/db"); // สมมติ pool คือ MySQL connection pool

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
};

module.exports = PointsController;
