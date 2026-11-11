import express from 'express';
import {
  generateUploadSignature,
  createPost,
  createStory
} from '../controllers/mediaController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signature', protect, generateUploadSignature);
router.post('/posts', protect, createPost);
router.post('/stories', protect, createStory);

export default router;
