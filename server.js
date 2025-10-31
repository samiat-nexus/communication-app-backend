// backend/server.js
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ====== CONFIG ======
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || "https://communication-app-frontend.onrender.com",
  "http://localhost:3000",
];
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/communicationApp";

// ====== Middlewares ======
app.use(express.json());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow curl / server-to-server
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error("CORS not allowed"), false);
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"]
}));

// ====== MongoDB connect ======
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection failed:", err.message));

// ====== Routes (API) ======
// IMPORTANT: keep API routes before static/front-end fallback
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));

// Simple test endpoint to verify server alive
app.get("/api/profile/test", (req, res) => {
  res.json({ message: "✅ Profile route alive!" });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ====== Message model (fallback/simple) ======
let Message;
try {
  Message = require("./models/Message");
} catch (err) {
  const mongooseSchema = new mongoose.Schema({
    sender: { type: String, default: "Anonymous" },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  });
  Message = mongoose.models.Message || mongoose.model("Message", mongooseSchema);
}

// ====== Socket.io setup ======
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET","POST"],
    credentials: true,
  }
});

io.on("connection", async (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // send chat history (safe)
  try {
    const msgs = await Message.find().sort({ timestamp: 1 }).limit(200).lean();
    // ensure we emit array of formatted strings (sender: text)
    socket.emit("chat_history", msgs.map(m => `${m.sender}: ${m.text}`));
  } catch (err) {
    console.error("⚠️ Failed to load chat history:", err.message);
  }

  socket.on("chat message", async (data) => {
    try {
      const text = typeof data === "string" ? data : (data.text || "");
      const sender = (data && data.sender) || "Anonymous";
      if (!text || !text.trim()) return;
      const saved = await Message.create({ sender, text });
      const payload = `${saved.sender}: ${saved.text}`;
      io.emit("chat message", payload);
      console.log("💬", payload);
    } catch (err) {
      console.error("❌ Error saving message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ====== Serve frontend build (if exists) ======
const frontendBuildPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  // fallback to index.html for client-side routing - only AFTER API routes
  app.get("*", (req, res) => {
    // make sure we don't accidentally override API calls
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API route not found" });
    }
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
} else {
  // Helpful message so Render logs show what's wrong
  console.warn("⚠️ frontend/build not found. Make sure you run `npm run build` in frontend and include build in deploy.");
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found" });
    res.send("Frontend build not found on server. Build frontend and redeploy.");
  });
}

// ====== Start server ======
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
