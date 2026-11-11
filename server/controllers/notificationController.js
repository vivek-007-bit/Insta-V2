import notificationService from '../services/notificationService.js';

// @desc    Get paginated notifications for authenticated user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, cursor } = req.query;
    const data = await notificationService.getUserNotifications(req.user._id, {
      page,
      limit,
      cursor,
      unreadOnly: false
    });

    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated unread notifications for authenticated user
// @route   GET /api/notifications/unread
// @access  Private
export const getUnreadNotifications = async (req, res, next) => {
  try {
    const { page, limit, cursor } = req.query;
    const data = await notificationService.getUserNotifications(req.user._id, {
      page,
      limit,
      cursor,
      unreadOnly: true
    });

    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notifications count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user._id);
    return res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:notificationId/read
// @access  Private
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAsRead(
      req.user._id,
      req.params.notificationId
    );

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      ...result
    });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a single notification
// @route   DELETE /api/notifications/:notificationId
// @access  Private
export const deleteNotification = async (req, res, next) => {
  try {
    const result = await notificationService.deleteNotification(
      req.user._id,
      req.params.notificationId
    );

    return res.status(200).json({
      success: true,
      message: 'Notification deleted',
      ...result
    });
  } catch (error) {
    if (error.statusCode) res.status(error.statusCode);
    next(error);
  }
};

// @desc    Clear all notifications for authenticated user
// @route   DELETE /api/notifications/clear-all
// @access  Private
export const clearAllNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.clearAllNotifications(req.user._id);
    return res.status(200).json({
      success: true,
      message: 'All notifications cleared',
      ...result
    });
  } catch (error) {
    next(error);
  }
};
