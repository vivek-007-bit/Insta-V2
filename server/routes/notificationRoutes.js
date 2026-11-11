import express from 'express';
import {
  getNotifications,
  getUnreadNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Literal routes first
router.get('/unread', protect, getUnreadNotifications);
router.get('/unread-count', protect, getUnreadNotificationCount);
router.patch('/read-all', protect, markAllNotificationsAsRead);
router.delete('/clear-all', protect, clearAllNotifications);

// Collection & ID routes
router.get('/', protect, getNotifications);
router.patch('/:notificationId/read', protect, markNotificationAsRead);
router.delete('/:notificationId', protect, deleteNotification);

export default router;
