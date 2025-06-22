// server.js
require("dotenv").config(); // โหลด .env ตั้งแต่ต้น
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const dashboardRoutes = require("./routes/user/DashboardRoutes");
// ... import routes อื่นๆ
const memberRoutes = require("./routes/admin/memberRoutes");
const documentRoutes = require("./routes/admin/documentRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/user/myuserRoutes");
const adminRoutes = require("./routes/admin/userRoutes");
const myDocRoutes = require("./routes/user/mydocumentRoutes");
const myMemberRoutes = require("./routes/user/mymemberRoutes");
const settingsRoutes = require("./routes/user/settingsRoutes");
const adminDataRoutes = require("./routes/admin/AdminDataRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// จัดเรียง route ให้ชัดเจน
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/my-member", myMemberRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/my-documents", myDocRoutes);
app.use("/api/user/settings", settingsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin/users", adminRoutes);
app.use("/api/data", adminDataRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API Server is running");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
