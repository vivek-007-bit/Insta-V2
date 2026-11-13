import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getRecommendedUsers,
  getRecommendedPosts,
  getRecommendedReels,
  recordRecommendationEvent,
  getRecommendationStatus
} from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const eventLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many recommendation events, please slow down.'
  }
});

router.get('/users', protect, getRecommendedUsers);
router.get('/posts', protect, getRecommendedPosts);
router.get('/reels', protect, getRecommendedReels);
router.post('/events', protect, eventLimiter, recordRecommendationEvent);
router.get('/status', protect, getRecommendationStatus);

export default router;
