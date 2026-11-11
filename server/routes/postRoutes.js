import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getFeedPosts,
  getPostById,
  getPostShareInfo,
  likePost,
  unlikePost,
  getPostLikes,
  addComment,
  getComments
} from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const interactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.'
  }
});

router.get('/feed', protect, getFeedPosts);
router.get('/:postId', protect, getPostById);
router.get('/:postId/share', protect, getPostShareInfo);
router.post('/:postId/like', protect, interactionLimiter, likePost);
router.delete('/:postId/like', protect, interactionLimiter, unlikePost);
router.get('/:postId/likes', protect, getPostLikes);
router.post('/:postId/comments', protect, interactionLimiter, addComment);
router.get('/:postId/comments', protect, getComments);

export default router;
