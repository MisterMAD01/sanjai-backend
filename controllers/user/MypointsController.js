const pool = require("../../config/db"); // สมมติ pool คือ MySQL connection pool

const MyPointsController = {
  getMyPoints: async (req, res) => {
    try {
      const member_id = req.memberId; // ตรวจสอบว่ามีค่า member_id จาก token
      if (!member_id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [rows] = await pool.query(
        `SELECT ea.event_id, ea.event_name, ea.event_date,
                mp.points_awarded
         FROM member_points mp
         LEFT JOIN event_activities ea ON mp.event_id = ea.event_id
         WHERE mp.member_id = ?
         ORDER BY ea.event_date DESC`,
        [member_id]
      );

      const totalPoints = rows.reduce(
        (sum, r) => sum + (r.points_awarded || 0),
        0
      );

      res.json({
        totalPoints,
        activities: rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  },
};

module.exports = MyPointsController;
