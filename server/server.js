import './config/env.js';
import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { initSocket } from './config/socket.js';
import authRoutes from './routes/authRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import userRoutes from './routes/userRoutes.js';
import followRequestRoutes from './routes/followRequestRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import reelRoutes from './routes/reelRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import storyRoutes from './routes/storyRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

const app = express();
const httpServer = http.createServer(app);

// Trust Render's reverse proxy so req.secure, x-forwarded-proto, and rate limiting work properly
app.set('trust proxy', 1);

// Build explicit CORS allowlist (comma-separated CLIENT_URL; never wildcard '*' with credentials)
const parseAllowedOrigins = () => {
  const rawOrigins = [process.env.CLIENT_URL, process.env.FRONTEND_URL]
    .filter(Boolean)
    .join(',');

  const configured = rawOrigins
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    for (const devOrigin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      if (!configured.includes(devOrigin)) configured.push(devOrigin);
    }
  }
  return configured;
};

const allowedOrigins = parseAllowedOrigins();

const corsOriginValidator = (origin, callback) => {
  // Allow non-browser / same-origin / health-check requests without an Origin header
  if (!origin) return callback(null, true);

  const normalized = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes(normalized)) {
    return callback(null, true);
  }

  const corsErr = new Error(`Origin ${origin} is not allowed by CORS`);
  corsErr.statusCode = 403;
  return callback(corsErr);
};

const corsOptions = {
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsers & Cookie parser (must run before auth & API routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Initialize Socket.IO with cookie-based JWT auth on persistent HTTP server
initSocket(httpServer, corsOriginValidator);

// Public Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Insta-V2 API is running',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  const readyState = mongoose.connection.readyState;
  const isHealthy = readyState === 1;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'ok' : 'degraded',
    server: 'running',
    database: dbStates[readyState] || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Ensure MongoDB connection is active before handling API routes
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/follow-requests', followRequestRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/search', searchRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  console.log(`[Insta-V2 Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`[Insta-V2 Server] Persistent Express + Socket.IO server listening on port ${PORT}`);
  });
};

startServer();

export default app;
