require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

// ✅ ห้ามกำหนด PORT เอง Passenger จะจัดการให้
const corsOptions = {
  origin: "https://ssya-nwt.com",
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ routes
const dashboardRoutes = require("./routes/user/DashboardRoutes");
const memberRoutes = require("./routes/admin/memberRoutes");
const documentRoutes = require("./routes/admin/documentRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/user/myuserRoutes");
const adminRoutes = require("./routes/admin/userRoutes");
const myDocRoutes = require("./routes/user/mydocumentRoutes");
const myMemberRoutes = require("./routes/user/mymemberRoutes");
const settingsRoutes = require("./routes/user/settingsRoutes");
const adminDataRoutes = require("./routes/admin/AdminDataRoutes");

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

// ✅ test route
app.get("/", (req, res) => {
  res.send("API Server is running");
});

// ✅ ไม่ต้อง app.listen(...) ปล่อยให้ Passenger รันเอง
module.exports = app;
