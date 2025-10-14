// backend/server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

// === App setup ===
const app = express();
const server = http.createServer(app);

// === Middleware ===
app.use(express.json());

// === ✅ Advanced CORS Configuration ===
const allowedOrigins = [
  "https://communication-app-frontend.onrender.com", // your frontend (Render)
  "http://localhost:3000", // for local development
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (!allowedOrigins.includes(origin)) {
        const msg = `CORS policy: Access from origin ${origin} not allowed`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// === MongoDB connection ===
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/communicationApp";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.error("❌ MongoDB Connection Failed:", err.message));

// === Auth Routes ===
app.use("/api/auth", require("./authRoutes"));

// === Message model (safe fallback) ===
let Message;
try {
  Message = require("./models/Message");
} catch {
  const messageSchema = new mongoose.Schema({
    sender: { type: String, default: "Anonymous" },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  });
  Message = mongoose.model("Message", messageSchema);
}

// === Socket.io setup ===
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", async (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  try {
    const messages = await Message.find().sort({ timestamp: 1 }).limit(200).lean();
    socket.emit("chat_history", messages.map((m) => m.text));
  } catch (err) {
    console.error("⚠️ Failed to load chat history:", err.message);
  }

  socket.on("chat message", async (data) => {
    try {
      const text = typeof data === "string" ? data : data.text || "";
      const sender = (data && data.sender) || "Anonymous";
      const msg = await Message.create({ sender, text });
      io.emit("chat message", msg.text);
      console.log(`💬 ${sender}: ${msg.text}`);
    } catch (err) {
      console.error("❌ Error saving message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// === REST API endpoints ===
app.get("/", (req, res) => {
  res.send("✅ Socket.IO Communication App Server is Running Successfully!");
});

app.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 }).limit(200).lean();
    res.json(messages.map((m) => m.text));
  } catch (err) {
    console.error("GET /messages error:", err.message);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// === Start the server ===
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed Origins: ${allowedOrigins.join(", ")}`);
});

// === Graceful shutdown ===
process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received. Shutting down gracefully...");
  await mongoose.disconnect();
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});
