// backend/server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const { Server } = require("socket.io");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

// Allowed origins (add your frontend URLs)
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

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/communicationApp";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// Mount your existing API routes (auth, profile, etc.)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));

// REST: get messages (public for now if token provided)
app.get("/api/messages", async (req, res) => {
  try {
    // Return last 200 messages sorted by timestamp asc
    const msgs = await Message.find().sort({ timestamp: 1 }).limit(200).lean();
    res.json(msgs);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

// JWT verification helper for socket auth
function verifySocketToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");
    return decoded; // should contain id, email
  } catch (err) {
    return null;
  }
}

// Create socket.io server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// On socket connection
io.on("connection", async (socket) => {
  try {
    // Read token from socket handshake auth (client sends { auth: { token } })
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const decoded = verifySocketToken(token);

    if (decoded) {
      socket.userId = decoded.id || decoded._id || decoded.userId;
      socket.userEmail = decoded.email || decoded.email;
    } else {
      // allow anonymous if you want, but mark as unknown
      socket.userId = null;
      socket.userEmail = "Anonymous";
    }

    console.log(`🟢 Socket connected: ${socket.id} (user: ${socket.userEmail})`);

    // Send chat history (array of message objects)
    const history = await Message.find().sort({ timestamp: 1 }).limit(200).lean();
    // send full objects; frontend will render
    socket.emit("chat_history", history);

    // Listen for chat messages from client
    socket.on("chat message", async (data) => {
      try {
        // Expect data: { text: "..." } OR { text, sender }.
        const text = (data && data.text) ? String(data.text).trim() : "";
        if (!text) return;

        const userId = socket.userId || (data.userId || null);
        const sender = socket.userEmail || data.sender || "Anonymous";

        const newMsg = new Message({
          userId: userId,
          sender: sender,
          text: text,
          timestamp: new Date()
        });

        await newMsg.save();

        // Broadcast full message object to everyone
        io.emit("chat message", {
          _id: newMsg._id,
          userId: newMsg.userId,
          sender: newMsg.sender,
          text: newMsg.text,
          timestamp: newMsg.timestamp
        });
      } catch (err) {
        console.error("socket chat message error:", err);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket disconnected: ${socket.id} (${reason})`);
    });
  } catch (err) {
    console.error("socket connection error:", err);
  }
});

// Serve frontend build in production (optional)
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
  });
}

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
});
