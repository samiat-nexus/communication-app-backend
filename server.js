// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());

// === MongoDB connection ===
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/communicationApp';

mongoose.connect(MONGO_URI, {
})
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => {
    console.error('❌ MongoDB Connection Failed:', err);
  });

// === Message model (use existing models/Message.js if present) ===
let Message;
try {
  Message = require('./models/Message');
} catch (err) {
  // fallback: inline schema (safe if models/Message.js absent)
  const messageSchema = new mongoose.Schema({
    sender: { type: String, default: 'Anonymous' },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  });
  Message = mongoose.model('Message', messageSchema);
}

// === Create server & socket.io ===
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // path: '/socket.io' // default is fine
});

// Socket events
io.on('connection', async (socket) => {
  console.log('🟢 New client connected:', socket.id);

  // Send chat history as plain array of texts (frontend expects strings)
  try {
    const msgs = await Message.find().sort({ timestamp: 1 }).limit(200).lean();
    const texts = msgs.map(m => m.text);
    socket.emit('chat_history', texts);
  } catch (err) {
    console.error('Failed to load chat history:', err);
  }

  // Listen for 'chat message' (matches frontend)
  socket.on('chat message', async (data) => {
    try {
      // data may be a string or an object { sender, text }
      const text = (typeof data === 'string') ? data : (data.text || JSON.stringify(data));
      const sender = (typeof data === 'object' && data.sender) ? data.sender : 'Anonymous';

      // Save to DB
      const saved = await Message.create({ sender, text });

      // Broadcast to all clients — send plain text (frontend expects text)
      io.emit('chat message', saved.text);
      console.log('📩 Message saved and broadcasted:', saved.text);
    } catch (err) {
      console.error('Error saving/broadcasting message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

// === Simple API endpoint to fetch messages ===
app.get('/messages', async (req, res) => {
  try {
    const msgs = await Message.find().sort({ timestamp: 1 }).limit(200).lean();
    // return array of texts so frontend mapping stays simple
    const texts = msgs.map(m => m.text);
    res.json(texts);
  } catch (err) {
    console.error('GET /messages error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.get('/', (req, res) => res.send('✅ Socket server is running!'));

// === Start server ===
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// === Graceful shutdown ===
process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await mongoose.disconnect();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
