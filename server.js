require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const pool = require("./config/db");

// Auth routes
const authRoutes = require("./routes/authRoutes");

// Admin routes
const memberRoutes = require("./routes/admin/memberRoutes");
const documentRoutes = require("./routes/admin/documentRoutes");
const adminRoutes = require("./routes/admin/userRoutes");
const adminDataRoutes = require("./routes/admin/AdminDataRoutes");
const adminActivityRoutes = require("./routes/admin/activityRoutes");
const EventActivityRoutes = require("./routes/admin/EventActivityRoutes");
const pointsRoutes = require("./routes/admin/pointsRoutes");

// User routes
const userRoutes = require("./routes/user/myuserRoutes");
const myDocRoutes = require("./routes/user/mydocumentRoutes");
const dashboardRoutes = require("./routes/user/DashboardRoutes");
const myMemberRoutes = require("./routes/user/mymemberRoutes");
const settingsRoutes = require("./routes/user/settingsRoutes");
const userActivityRoutes = require("./routes/user/MyactivityRoutes");
const MyPoinRoutes = require("./routes/user/MypointsRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: [
      "https://ssya-nwt.com",
      "https://www.ssya-nwt.com", // production
      "http://localhost:3000", // local React dev
      "http://localhost:3001", // optional local dev
    ],
    credentials: true,
  })
);

// ✅ ให้ browser เห็น Content-Disposition header
app.use((req, res, next) => {
  res.header("Access-Control-Expose-Headers", "Content-Disposition");
  next();
});
app.use(express.json());
app.use(cookieParser());

// Authentication routes
app.use("/api/auth", authRoutes);

// User routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/user", userRoutes);
app.use("/api/user/settings", settingsRoutes);
app.use("/api/user/activities", userActivityRoutes);
app.use("/api/my-member", myMemberRoutes);
app.use("/api/my-documents", myDocRoutes);
app.use("/api/my-points", MyPoinRoutes);

// Admin routes
app.use("/api/admin/users", adminRoutes);
app.use("/api/admin/activities", adminActivityRoutes);
app.use("/api/admin/points", pointsRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/data", adminDataRoutes);
app.use("/api/event/activities", EventActivityRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ปรับปรุงเส้นทางนี้เพื่อแสดงสถานะการเชื่อมต่อฐานข้อมูล
app.get("/", async (req, res) => {
  let dbStatus = "Disconnected";
  let dbError = null;

  try {
    // ลองรัน query ง่ายๆ เพื่อทดสอบการเชื่อมต่อ
    await pool.query("SELECT 1");
    dbStatus = "Connected";
  } catch (error) {
    dbStatus = "Failed to connect";
    dbError = error.message;
    console.error("Database connection check failed:", error);
  }

  res.json({
    message: "API Server is running",
    databaseStatus: dbStatus,
    databaseError: dbError, // จะมีค่าถ้าการเชื่อมต่อล้มเหลว
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
module.exports = app; // Export the app for testing purposes
