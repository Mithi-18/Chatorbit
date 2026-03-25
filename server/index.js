import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer implementation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Basic Authentication
app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword }
    });
    
    res.json({ message: 'User created. Please login.' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, profileImage: user.profileImage, bio: user.bio }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// User routes
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, profileImage: true, bio: true, isActive: true, lastSeen: true } });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/users/profile', upload.single('profileImage'), async (req, res) => {
  const { userId, bio } = req.body;
  const updateData = {};
  if (bio) updateData.bio = bio;
  if (req.file) updateData.profileImage = `/uploads/${req.file.filename}`;

  try {
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: updateData
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// Messages route
app.get('/messages/:userId/:contactId', async (req, res) => {
  const { userId, contactId } = req.params;
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: parseInt(userId), receiverId: parseInt(contactId) },
          { senderId: parseInt(contactId), receiverId: parseInt(userId) }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Media upload for messages
app.post('/upload', upload.single('mediaFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Socket.io Implementation
// Store active users: socket.id -> userId
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_connected', async (userId) => {
    onlineUsers.set(socket.id, userId);
    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    io.emit('user_status_changed', { userId, isActive: true });
    
    // Join a room for personal events like WebRTC signaling
    socket.join(`user_${userId}`);
  });

  socket.on('send_message', async (data) => {
    // data: { senderId, receiverId, content, mediaUrl, type }
    try {
      const msg = await prisma.message.create({
        data: {
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
          mediaUrl: data.mediaUrl,
          type: data.type
        }
      });
      // Emitting to the receiver's personal room
      io.to(`user_${data.receiverId}`).emit('receive_message', msg);
      // Also send back to sender so they can update UI
      socket.emit('receive_message', msg);
    } catch (error) {
      console.error('Save message error:', error);
    }
  });

  // WebRTC signaling
  socket.on('call_user', (data) => {
    io.to(`user_${data.userToCall}`).emit('call_incoming', {
      signal: data.signalData,
      from: data.from
    });
  });

  socket.on('answer_call', (data) => {
    io.to(`user_${data.to}`).emit('call_accepted', data.signal);
  });

  socket.on('disconnect', async () => {
    const userId = onlineUsers.get(socket.id);
    if (userId) {
      onlineUsers.delete(socket.id);
      await prisma.user.update({ where: { id: userId }, data: { isActive: false, lastSeen: new Date() } });
      io.emit('user_status_changed', { userId, isActive: false });
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
