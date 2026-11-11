import express from 'express';
import { deleteComment } from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.delete('/:commentId', protect, deleteComment);

export default router;
