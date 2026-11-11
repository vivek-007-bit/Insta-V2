import express from 'express';
import {
  getIncomingRequests,
  getSentRequests,
  acceptRequest,
  rejectRequest,
  cancelRequest
} from '../controllers/followRequestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getIncomingRequests);
router.get('/sent', protect, getSentRequests);
router.post('/:requestId/accept', protect, acceptRequest);
router.post('/:requestId/reject', protect, rejectRequest);
router.delete('/:requestId', protect, cancelRequest);

export default router;
