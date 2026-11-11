import api from './api';

export const notificationService = {
  // Get paginated notifications
  getNotifications: async (page = 1, limit = 20, cursor = null) => {
    const params = { page, limit };
    if (cursor) params.cursor = cursor;
    return await api.get('/notifications', { params });
  },

  // Get unread notifications
  getUnreadNotifications: async (page = 1, limit = 20) => {
    return await api.get('/notifications/unread', { params: { page, limit } });
  },

  // Get unread notification count
  getUnreadCount: async () => {
    return await api.get('/notifications/unread-count');
  },

  // Mark a single notification as read
  markAsRead: async (notificationId) => {
    return await api.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    return await api.patch('/notifications/read-all');
  },

  // Delete a single notification
  deleteNotification: async (notificationId) => {
    return await api.delete(`/notifications/${encodeURIComponent(notificationId)}`);
  },

  // Clear all notifications
  clearAllNotifications: async () => {
    return await api.delete('/notifications/clear-all');
  }
};

export default notificationService;
