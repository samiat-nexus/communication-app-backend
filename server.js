// server.js (updated)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const Message = require("./models/Message");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.mongodb+srv://SNX_admin:samiat-nexusXmongodb-atlas@snx-cluster.rkyfoss.mongodb.net/?retryWrites=true&w=majority&appName=SNX-Cluster)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Failed:", err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.io
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Send existing chat history
  Message.find().then(messages => {
    socket.emit("chat_history", messages);
  });

  // Receive and save new message
  socket.on("send_message", async (data) => {
    const newMessage = new Message({
      sender: data.sender,
      text: data.text,
    });
    await newMessage.save();

    io.emit("receive_message", newMessage);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Route
app.get("/", (req, res) => {
  res.send("Server is running with chat history ✅");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
