// ✅ server.js -

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const socketio = require("socket.io");
const path = require("path");
require("dotenv").config();

// ✅ Express + HTTP Server
const app = express();
const server = http.createServer(app);

// ✅ Socket.io Setup
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ MongoDB Model
const Message = require("./models/Message");

// ✅ Middlewares
app.use(express.json());
app.use(cors());

// ✅ MongoDB Connect
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatDB";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ Routes for API Test
app.get("/api/status", (req, res) => {
  res.json({ status: "Backend is Running ✅" });
});

// ✅ Socket Events
io.on("connection", async (socket) => {
  console.log("🟢 New client connected:", socket.id);

  const history = await Message.find().sort({ timestamp: 1 }).lean();
  socket.emit("chat_history", history.map(msg => `${msg.username}: ${msg.text}`));

  socket.on("chat message", async (data) => {
    const newMsg = await Message.create({
      username: data.sender,
      text: data.text
    });

    io.emit("chat message", `${newMsg.username}: ${newMsg.text}`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client Disconnected");
  });
});

// ✅ Serve React frontend in production
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend/build");
  app.use(express.static(frontendPath));

  // ✅ Wildcard fix for Express v5
  app.use((req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// ✅ PORT
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
