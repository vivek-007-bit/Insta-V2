import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io = null;

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

  // Authenticate every socket connection via HTTP-only JWT cookie
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers?.cookie);
      const token = cookies.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const secret =
        process.env.JWT_SECRET || process.env.SECRET_KEY || 'default_jwt_secret_insta_v2';
      const decoded = jwt.verify(token, secret);

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
    // Join private user-specific room derived strictly from verified JWT
    const userRoom = `user:${socket.userId}`;
    socket.join(userRoom);

    socket.on('disconnect', () => {
      socket.leave(userRoom);
    });
  });

  return io;
};

export const getIO = () => io;

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId.toString()}`).emit(event, payload);
};

export default {
  initSocket,
  getIO,
  emitToUser
};
