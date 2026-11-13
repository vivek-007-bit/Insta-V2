import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { getJwtSecret } from '../utils/generateToken.js';

let io = null;
// Map<userId, Set<socketId>> for accurate real-time online presence
const onlineUserSockets = new Map();

export const isUserOnline = (userId) => {
  if (!userId) return false;
  const sockets = onlineUserSockets.get(userId.toString());
  return Boolean(sockets && sockets.size > 0);
};

// Parse raw cookie header string into key/value map
const parseCookies = (cookieHeader = '') => {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  });
  return cookies;
};

export const initSocket = (httpServer, allowedOrigin) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Authenticate every socket connection via HTTP-only JWT cookie (with auth/header fallbacks)
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers?.cookie);
      let token = cookies.token;

      // Also check handshake auth and headers for token fallback
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
          token = parts[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, getJwtSecret());

      const user = await User.findById(decoded.id).select('_id username');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;
    const userRoom = `user:${uid}`;
    socket.join(userRoom);

    // Track connected sockets per user for accurate online presence
    if (!onlineUserSockets.has(uid)) {
      onlineUserSockets.set(uid, new Set());
    }
    const wasOffline = onlineUserSockets.get(uid).size === 0;
    onlineUserSockets.get(uid).add(socket.id);

    if (wasOffline) {
      io.emit('user_presence', { userId: uid, isOnline: true });
    }

    // Join conversation room only after verifying participant membership
    socket.on('join_conversation', async (conversationId, ack) => {
      try {
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          ack?.({ ok: false, message: 'Invalid conversation ID' });
          return;
        }
        const isParticipant = await Conversation.exists({
          _id: conversationId,
          participants: uid
        });
        if (!isParticipant) {
          ack?.({ ok: false, message: 'Not authorized to join this conversation' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    socket.on('disconnect', () => {
      socket.leave(userRoom);
      const userSockets = onlineUserSockets.get(uid);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUserSockets.delete(uid);
          io.emit('user_presence', { userId: uid, isOnline: false });
        }
      }
    });
  });

  return io;
};

export const getIO = () => io;

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId.toString()}`).emit(event, payload);
};

export const emitToConversation = (conversationId, event, payload) => {
  if (!io || !conversationId) return;
  io.to(`conversation:${conversationId.toString()}`).emit(event, payload);
};

export default {
  initSocket,
  getIO,
  emitToUser,
  emitToConversation,
  isUserOnline
};
