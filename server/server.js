import './config/env.js';
import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

// Trust reverse proxy for secure cookies and rate limiting behind Vercel/Render/Nginx
app.set('trust proxy', 1);

// Build explicit CORS allowlist (comma-separated CLIENT_URL; never wildcard '*' with credentials)
const parseAllowedOrigins = () => {
  const configured = (process.env.CLIENT_URL || 'http://localhost:5173')
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
  // Allow same-origin / server-to-server / curl requests without an Origin header
  if (!origin) return callback(null, true);

  const normalized = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes(normalized)) {
    return callback(null, true);
  }

  // Optional Vercel preview origin opt-in (exact HTTPS vercel.app subdomain check)
  if (
    process.env.ALLOW_VERCEL_PREVIEWS === 'true' &&
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized)
  ) {
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

// Initialize Socket.IO with cookie-based JWT auth (persistent Node server mode)
if (!process.env.VERCEL) {
  initSocket(httpServer, corsOriginValidator);
}

// Body parsers & Cookie parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ensure MongoDB connection is ready before handling API routes (needed in serverless mode)
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Mount Routes
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
    console.log('[Insta-V2 Server] API server ready');
  });
};

if (!process.env.VERCEL) {
  startServer();
}

export default app;
