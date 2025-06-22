require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const memberRoutes = require("./routes/admin/memberRoutes");
const documentRoutes = require("./routes/admin/documentRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/user/myuserRoutes");
const adminRoutes = require("./routes/admin/userRoutes");
const myDocRoutes = require("./routes/user/mydocumentRoutes");
const dashboardRoutes = require("./routes/user/DashboardRoutes");
const myMemberRoutes = require("./routes/user/mymemberRoutes");
const settingsRoutes = require("./routes/user/settingsRoutes");
const adminDataRoutes = require("./routes/admin/AdminDataRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "https://ssya-nwt.com",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/my-member", myMemberRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin/users", adminRoutes);
app.use("/api/my-documents", myDocRoutes);
app.use("/api/user/settings", settingsRoutes);
app.use("/api/data", adminDataRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API Server is running");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
module.exports = app; // Export the app for testing purposes
