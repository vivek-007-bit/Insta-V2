import express from 'express';
import {
  getStoryUploadSignature,
  createStory,
  getStoriesFeed,
  getStoryById,
  recordStoryView,
  getStoryViewers,
  deleteStory
} from '../controllers/storyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/upload-signature', protect, getStoryUploadSignature);
router.get('/feed', protect, getStoriesFeed);
router.post('/', protect, createStory);
router.get('/:storyId', protect, getStoryById);
router.post('/:storyId/view', protect, recordStoryView);
router.get('/:storyId/viewers', protect, getStoryViewers);
router.delete('/:storyId', protect, deleteStory);

export default router;
