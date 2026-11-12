import express from 'express';
import {
  getConversations,
  createOrGetConversation,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationAsRead,
  deleteMessage
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/conversations', protect, getConversations);
router.post('/conversations', protect, createOrGetConversation);
router.get('/conversations/:conversationId', protect, getConversationById);
router.get('/conversations/:conversationId/messages', protect, getMessages);
router.post('/conversations/:conversationId/messages', protect, sendMessage);
router.patch('/conversations/:conversationId/read', protect, markConversationAsRead);
router.delete('/:messageId', protect, deleteMessage);

export default router;
