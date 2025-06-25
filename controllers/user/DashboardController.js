const pool = require("../../config/db");

// รวมจำนวนสมาชิกทั้งหมด และตามประเภท
const getStats = async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const [totalRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM members`
    );
    const [honoraryRows] = await conn.query(
      `SELECT COUNT(*) AS count FROM members WHERE type = 'กิติมศักดิ์'`
    );
    const [regularRows] = await conn.query(
      `SELECT COUNT(*) AS count FROM members WHERE type = 'สามัญ'`
    );
    const [generalRows] = await conn.query(
      `SELECT COUNT(*) AS count FROM members WHERE type = 'ทั่วไป'`
    );

    conn.release();

    res.json({
      total: totalRows[0].total,
      honorary: honoraryRows[0].count,
      regular: regularRows[0].count,
      general: generalRows[0].count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
};

// กลุ่มตามเขต (district)
const getByDistrict = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT district, COUNT(*) AS count 
      FROM members 
      GROUP BY district
    `);
    conn.release();

    const result = {};
    rows.forEach((r) => {
      result[r.district || "ไม่ระบุ"] = r.count;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
};

// กลุ่มตามรุ่น (generation)
const getByGeneration = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT graduation_year, COUNT(*) AS count 
      FROM members 
      GROUP BY graduation_year
    `);
    conn.release();

    const result = {};
    rows.forEach((r) => {
      result[r.graduation_year || "ไม่ระบุ"] = r.count;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
};

// กลุ่มตามเพศ (gender)
const getByGender = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT gender, COUNT(*) AS count 
      FROM members 
      GROUP BY gender
    `);
    conn.release();

    const result = {};
    rows.forEach((r) => {
      result[r.gender || "ไม่ระบุ"] = r.count;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
};

module.exports = {
  getStats,
  getByDistrict,
  getByGeneration,
  getByGender,
};
