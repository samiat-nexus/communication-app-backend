// backend/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose"); // ✅ MongoDB
const Message = require("./models/Message"); // ✅ Message Model

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Connect to MongoDB
mongoose.connect('mongodb+srv://SNX_admin:samiat-nexusXmongodb-atlas@snx-cluster.rkyfoss.mongodb.net/?retryWrites=true&w=majority&appName=SNX-Cluster')
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Failed:", err));

const server = http.createServer(app);

// ✅ Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ Handle Socket.io connections
io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  // Listen for messages from clients
  socket.on("send_message", async (data) => {
    console.log("💬 Message Received:", data);

    try {
      // ✅ Save message to MongoDB
      const newMessage = new Message({
        username: "User", // later this will be dynamic
        text: data,
        timestamp: new Date()
      });
      await newMessage.save();
      console.log("📦 Message Saved to Database");

      // ✅ Broadcast the message to all other connected clients
      socket.broadcast.emit("receive_message", data);
    } catch (error) {
      console.error("❌ Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

// ✅ Simple test route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// ✅ Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));