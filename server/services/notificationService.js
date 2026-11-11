import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Post from '../models/Post.js';
import Reel from '../models/Reel.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import { emitToUser } from '../config/socket.js';

const DEDUPLICATED_TYPES = new Set([
  'follow',
  'follow_request',
  'follow_request_accepted',
  'like',
  'reel_like'
]);

// Build human-readable notification text
const getActionText = (type, message) => {
  switch (type) {
    case 'follow':
      return 'started following you.';
    case 'follow_request':
      return 'requested to follow you.';
    case 'follow_request_accepted':
      return 'accepted your follow request.';
    case 'like':
      return 'liked your post.';
    case 'comment':
      return message ? `commented: "${message}"` : 'commented on your post.';
    case 'reel_like':
      return 'liked your reel.';
    case 'reel_comment':
      return message ? `commented on your reel: "${message}"` : 'commented on your reel.';
    default:
      return 'interacted with your content.';
  }
};

// Format batch of notifications with entity previews and follow statuses
const formatNotificationsBatch = async (docs, viewerId) => {
  if (!docs || docs.length === 0) return [];

  const postIds = [];
  const reelIds = [];
  const followSenderIds = [];

  for (const n of docs) {
    if (n.entityType === 'Post' && n.entityId) {
      postIds.push(n.entityId);
    } else if (n.entityType === 'Reel' && n.entityId) {
      reelIds.push(n.entityId);
    }
    if ((n.type === 'follow' || n.type === 'follow_request_accepted') && n.sender?._id) {
      followSenderIds.push(n.sender._id);
    }
  }

  const [posts, reels, follows, pendingReqs] = await Promise.all([
    postIds.length > 0
      ? Post.find({ _id: { $in: postIds } }).select('mediaUrl mediaType')
      : [],
    reelIds.length > 0
      ? Reel.find({ _id: { $in: reelIds } }).select('thumbnailUrl videoUrl')
      : [],
    followSenderIds.length > 0
      ? Follow.find({ follower: viewerId, following: { $in: followSenderIds } }).select('following')
      : [],
    followSenderIds.length > 0
      ? FollowRequest.find({
          requester: viewerId,
          recipient: { $in: followSenderIds },
          status: 'pending'
        }).select('recipient _id')
      : []
  ]);

  const postMap = new Map(posts.map((p) => [p._id.toString(), p]));
  const reelMap = new Map(reels.map((r) => [r._id.toString(), r]));
  const followingSet = new Set(follows.map((f) => f.following.toString()));
  const pendingMap = new Map(
    pendingReqs.map((req) => [req.recipient.toString(), req._id.toString()])
  );

  return docs.map((n) => {
    const eid = n.entityId ? n.entityId.toString() : null;
    let targetThumbnail = null;
    let entityExists = true;

    if (n.entityType === 'Post') {
      const p = eid ? postMap.get(eid) : null;
      if (p) {
        targetThumbnail = p.mediaUrl;
      } else {
        entityExists = false;
      }
    } else if (n.entityType === 'Reel') {
      const r = eid ? reelMap.get(eid) : null;
      if (r) {
        targetThumbnail = r.thumbnailUrl || null;
      } else {
        entityExists = false;
      }
    }

    const senderObj = n.sender
      ? {
          id: n.sender._id.toString(),
          _id: n.sender._id.toString(),
          username: n.sender.username,
          fullName: n.sender.fullName,
          avatar: n.sender.avatar,
          isPrivate: Boolean(n.sender.isPrivate),
          isFollowing: followingSet.has(n.sender._id.toString()),
          isPending: pendingMap.has(n.sender._id.toString()),
          requestId: pendingMap.get(n.sender._id.toString()) || null
        }
      : {
          id: null,
          username: 'deleted_user',
          fullName: 'Deleted User',
          avatar:
            'https://ui-avatars.com/api/?name=Deleted&background=262626&color=ffffff&size=100',
          isPrivate: false,
          isFollowing: false,
          isPending: false,
          isDeleted: true
        };

    return {
      id: n._id.toString(),
      _id: n._id.toString(),
      type: n.type,
      entityType: n.entityType,
      entityId: eid,
      entityExists,
      message: n.message || '',
      text: getActionText(n.type, n.message),
      isRead: Boolean(n.isRead),
      createdAt: n.createdAt,
      sender: senderObj,
      user: senderObj, // Backward-compatible alias
      targetThumbnail
    };
  });
};

export const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({
    recipient: userId,
    isRead: false
  });
};

export const createNotification = async ({
  recipientId,
  senderId,
  type,
  entityType,
  entityId,
  message = ''
}) => {
  try {
    if (!recipientId || !senderId || !entityId) return null;

    // Never notify users about their own actions
    if (recipientId.toString() === senderId.toString()) {
      return null;
    }

    // Prevent duplicate notifications for idempotent events (follow, like, request)
    if (DEDUPLICATED_TYPES.has(type)) {
      const exists = await Notification.exists({
        recipient: recipientId,
        sender: senderId,
        type,
        entityId
      });
      if (exists) {
        return null;
      }
    }

    const cleanMessage = message ? String(message).trim().slice(0, 200) : '';

    const doc = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      entityType,
      entityId,
      message: cleanMessage
    });

    const populated = await Notification.findById(doc._id).populate(
      'sender',
      'username fullName avatar isPrivate'
    );

    const [formatted] = await formatNotificationsBatch([populated], recipientId);
    const unreadCount = await getUnreadCount(recipientId);

    // Emit real-time updates solely to the intended recipient's private room
    emitToUser(recipientId, 'new_notification', formatted);
    emitToUser(recipientId, 'unread_count_updated', { unreadCount });

    return formatted;
  } catch (err) {
    console.error('[NotificationService] createNotification error:', err.message);
    return null;
  }
};

export const removeMatchingNotifications = async ({
  recipientId,
  senderId,
  type,
  entityId
}) => {
  try {
    const query = { recipient: recipientId, type };
    if (senderId) query.sender = senderId;
    if (entityId) query.entityId = entityId;

    const result = await Notification.deleteMany(query);
    if (result.deletedCount > 0) {
      const unreadCount = await getUnreadCount(recipientId);
      emitToUser(recipientId, 'unread_count_updated', { unreadCount });
    }
  } catch (err) {
    console.error('[NotificationService] removeMatchingNotifications error:', err.message);
  }
};

export const getUserNotifications = async (
  userId,
  { page = 1, limit = 20, cursor = null, unreadOnly = false } = {}
) => {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(parseInt(limit, 10) || 20, 50);

  const filter = { recipient: userId };
  if (unreadOnly) {
    filter.isRead = false;
  }
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!isNaN(cursorDate.getTime())) {
      filter.createdAt = { $lt: cursorDate };
    }
  }

  const skip = cursor ? 0 : (safePage - 1) * safeLimit;

  const [docs, totalCount, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('sender', 'username fullName avatar isPrivate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Notification.countDocuments(unreadOnly ? { recipient: userId, isRead: false } : { recipient: userId }),
    getUnreadCount(userId)
  ]);

  const notifications = await formatNotificationsBatch(docs, userId);
  const nextCursor =
    docs.length > 0 ? docs[docs.length - 1].createdAt.toISOString() : null;

  return {
    notifications,
    totalCount,
    unreadCount,
    page: safePage,
    hasMore: cursor ? docs.length === safeLimit : skip + docs.length < totalCount,
    nextCursor
  };
};

export const markAsRead = async (userId, notificationId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    const error = new Error('Invalid notification ID');
    error.statusCode = 400;
    throw error;
  }

  const existing = await Notification.findById(notificationId);
  if (!existing) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  if (existing.recipient.toString() !== userId.toString()) {
    const error = new Error('Not authorized to modify this notification');
    error.statusCode = 403;
    throw error;
  }

  if (!existing.isRead) {
    existing.isRead = true;
    await existing.save();
  }

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'unread_count_updated', { unreadCount });

  return { notificationId: existing._id.toString(), isRead: true, unreadCount };
};

export const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true } }
  );

  emitToUser(userId, 'unread_count_updated', { unreadCount: 0 });
  return { unreadCount: 0 };
};

export const deleteNotification = async (userId, notificationId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    const error = new Error('Invalid notification ID');
    error.statusCode = 400;
    throw error;
  }

  const existing = await Notification.findById(notificationId);
  if (!existing) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  if (existing.recipient.toString() !== userId.toString()) {
    const error = new Error('Not authorized to delete this notification');
    error.statusCode = 403;
    throw error;
  }

  await Notification.deleteOne({ _id: existing._id });

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'unread_count_updated', { unreadCount });

  return { notificationId: existing._id.toString(), unreadCount };
};

export const clearAllNotifications = async (userId) => {
  await Notification.deleteMany({ recipient: userId });
  emitToUser(userId, 'unread_count_updated', { unreadCount: 0 });
  return { unreadCount: 0 };
};

export default {
  createNotification,
  removeMatchingNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications
};
