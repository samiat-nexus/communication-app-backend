// ✅ server.js

require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const socketio = require("socket.io");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"]
  })
);

const MONGO_URI = process.env.MONGO_URI;
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

app.get("/api/status", (req, res) => {
  res.json({ message: "✅ Backend is Live!" });
});

const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", async (socket) => {
  console.log("🟢 Socket Connected:", socket.id);

  const history = await Message.find().lean();
  socket.emit(
    "chat_history",
    history.map((m) => `${m.username}: ${m.text}`)
  );

  socket.on("chat message", async (data) => {
    const saved = await Message.create({
      username: data.sender,
      text: data.text
    });
    io.emit("chat message", `${saved.username}: ${saved.text}`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket Disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Backend Running Port: ${PORT}`)
);
