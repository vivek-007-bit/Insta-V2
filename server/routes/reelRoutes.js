import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getReelUploadSignature,
  createReel,
  getReels,
  getReelById,
  deleteReel,
  likeReel,
  unlikeReel,
  getReelComments,
  addReelComment,
  deleteReelComment,
  getReelShareInfo
} from '../controllers/reelController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const interactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.'
  }
});

// Literal routes first
router.post('/upload-signature', protect, getReelUploadSignature);
router.delete('/comments/:commentId', protect, deleteReelComment);

// Collection routes
router.get('/', protect, getReels);
router.post('/', protect, createReel);

// Single Reel & Interaction routes
router.get('/:reelId', protect, getReelById);
router.delete('/:reelId', protect, deleteReel);
router.post('/:reelId/like', protect, interactionLimiter, likeReel);
router.delete('/:reelId/like', protect, interactionLimiter, unlikeReel);
router.get('/:reelId/comments', protect, getReelComments);
router.post('/:reelId/comments', protect, interactionLimiter, addReelComment);
router.get('/:reelId/share', protect, getReelShareInfo);

export default router;
