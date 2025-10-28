// backend/server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ====== CORS CONFIG ======
const allowedOrigins = [
  process.env.CLIENT_URL || "https://communication-app-frontend.onrender.com",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());

// ====== MongoDB Connection ======
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/communicationApp";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// ====== ROUTES ======
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));

// ✅ TEST ROUTE (check directly in browser)
app.get("/api/profile/test", (req, res) => {
  res.json({ message: "✅ Profile route alive!" });
});

// ====== Simple REST Endpoints ======
app.get("/", (req, res) => {
  res.send("✅ Server Running Successfully!");
});

// ====== Socket.IO ======
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);
  socket.on("disconnect", () => console.log("🔴 Socket disconnected:", socket.id));
});

// ====== START SERVER ======
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
});
