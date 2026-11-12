import mongoose from 'mongoose';
import Conversation, { buildConversationPairKey } from '../models/Conversation.js';
import Message, { MAX_MESSAGE_LENGTH } from '../models/Message.js';
import User from '../models/User.js';
import { emitToUser, emitToConversation, isUserOnline } from '../config/socket.js';

const normalizeSecureUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  return trimmed.startsWith('http://res.cloudinary.com')
    ? trimmed.replace('http://', 'https://')
    : trimmed;
};

const formatMessage = (msg) => {
  if (!msg) return null;
  const senderObj =
    msg.sender && typeof msg.sender === 'object' && msg.sender._id
      ? {
          id: msg.sender._id.toString(),
          username: msg.sender.username,
          fullName: msg.sender.fullName,
          avatar: normalizeSecureUrl(msg.sender.avatar)
        }
      : null;

  const senderId = senderObj ? senderObj.id : msg.sender?.toString();

  return {
    id: msg._id.toString(),
    _id: msg._id.toString(),
    conversationId: msg.conversation?.toString(),
    senderId,
    sender: senderObj,
    text: msg.text,
    readBy: Array.isArray(msg.readBy) ? msg.readBy.map((id) => id.toString()) : [],
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt
  };
};

const formatConversationForViewer = (conv, viewerId, unreadCount = 0) => {
  const viewerIdStr = viewerId.toString();
  const participants = (conv.participants || []).filter(Boolean);
  const otherUser =
    participants.find((p) => p._id.toString() !== viewerIdStr) || participants[0];

  if (!otherUser) return null;

  const otherId = otherUser._id.toString();
  const lastMsgFormatted = conv.lastMessage ? formatMessage(conv.lastMessage) : null;

  return {
    id: conv._id.toString(),
    _id: conv._id.toString(),
    participants: participants.map((p) => p._id.toString()),
    user: {
      id: otherId,
      username: otherUser.username,
      fullName: otherUser.fullName || otherUser.username,
      avatar: normalizeSecureUrl(otherUser.avatar),
      isPrivate: Boolean(otherUser.isPrivate),
      isOnline: isUserOnline(otherId)
    },
    lastMessage: lastMsgFormatted,
    lastMessageAt: conv.lastMessageAt || conv.updatedAt || conv.createdAt,
    unreadCount: Number(unreadCount) || 0,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt
  };
};

// Verify conversation exists and caller is one of its participants
const verifyParticipant = async (conversationId, viewerId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return { errorStatus: 400, errorMessage: 'Invalid conversation ID' };
  }

  const conversation = await Conversation.findById(conversationId)
    .populate('participants', 'username fullName avatar isPrivate')
    .populate({
      path: 'lastMessage',
      select: 'conversation sender text readBy createdAt updatedAt'
    });

  if (!conversation) {
    return { errorStatus: 404, errorMessage: 'Conversation not found' };
  }

  const isMember = conversation.participants.some(
    (p) => p && p._id.toString() === viewerId.toString()
  );

  if (!isMember) {
    return { errorStatus: 403, errorMessage: 'You are not authorized to access this conversation' };
  }

  return { conversation };
};

// @desc    Get authenticated user's conversations sorted by latest activity
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const viewerId = req.user._id;

    const conversations = await Conversation.find({ participants: viewerId })
      .populate('participants', 'username fullName avatar isPrivate')
      .populate({
        path: 'lastMessage',
        select: 'conversation sender text readBy createdAt updatedAt'
      })
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    const convIds = conversations.map((c) => c._id);
    const unreadAgg =
      convIds.length > 0
        ? await Message.aggregate([
            {
              $match: {
                conversation: { $in: convIds },
                sender: { $ne: viewerId },
                readBy: { $ne: viewerId }
              }
            },
            {
              $group: {
                _id: '$conversation',
                count: { $sum: 1 }
              }
            }
          ])
        : [];

    const unreadMap = new Map(unreadAgg.map((row) => [row._id.toString(), row.count]));

    const formatted = conversations
      .map((conv) => formatConversationForViewer(conv, viewerId, unreadMap.get(conv._id.toString()) || 0))
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      conversations: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or retrieve a 1-to-1 conversation with another user
// @route   POST /api/messages/conversations
// @access  Private
export const createOrGetConversation = async (req, res, next) => {
  try {
    const viewerId = req.user._id;
    const { recipientId, username } = req.body || {};

    let recipient = null;
    if (recipientId) {
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({ success: false, message: 'Invalid recipientId' });
      }
      recipient = await User.findById(recipientId).select('username fullName avatar isPrivate');
    } else if (username) {
      recipient = await User.findOne({ username: String(username).trim().toLowerCase() }).select(
        'username fullName avatar isPrivate'
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'recipientId or username is required'
      });
    }

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient user not found' });
    }

    if (recipient._id.toString() === viewerId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot start a conversation with yourself'
      });
    }

    const pairKey = buildConversationPairKey(viewerId, recipient._id);
    const sortedParticipants = [viewerId, recipient._id].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    let existing = await Conversation.findOne({ pairKey })
      .populate('participants', 'username fullName avatar isPrivate')
      .populate({
        path: 'lastMessage',
        select: 'conversation sender text readBy createdAt updatedAt'
      });

    let created = false;
    if (!existing) {
      try {
        const doc = await Conversation.findOneAndUpdate(
          { pairKey },
          {
            $setOnInsert: {
              participants: sortedParticipants,
              pairKey,
              lastMessage: null,
              lastMessageAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        created = true;
        existing = await Conversation.findById(doc._id)
          .populate('participants', 'username fullName avatar isPrivate')
          .populate({
            path: 'lastMessage',
            select: 'conversation sender text readBy createdAt updatedAt'
          });
      } catch (dupErr) {
        if (dupErr?.code === 11000) {
          existing = await Conversation.findOne({ pairKey })
            .populate('participants', 'username fullName avatar isPrivate')
            .populate({
              path: 'lastMessage',
              select: 'conversation sender text readBy createdAt updatedAt'
            });
        } else {
          throw dupErr;
        }
      }
    }

    const unreadCount = await Message.countDocuments({
      conversation: existing._id,
      sender: { $ne: viewerId },
      readBy: { $ne: viewerId }
    });

    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      conversation: formatConversationForViewer(existing, viewerId, unreadCount)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single conversation details (participant only)
// @route   GET /api/messages/conversations/:conversationId
// @access  Private
export const getConversationById = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { conversation, errorStatus, errorMessage } = await verifyParticipant(
      conversationId,
      req.user._id
    );

    if (errorStatus) {
      return res.status(errorStatus).json({ success: false, message: errorMessage });
    }

    const unreadCount = await Message.countDocuments({
      conversation: conversation._id,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id }
    });

    return res.status(200).json({
      success: true,
      conversation: formatConversationForViewer(conversation, req.user._id, unreadCount)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated messages for a conversation (newest page first, ordered chronologically)
// @route   GET /api/messages/conversations/:conversationId/messages
// @access  Private
export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { conversation, errorStatus, errorMessage } = await verifyParticipant(
      conversationId,
      req.user._id
    );

    if (errorStatus) {
      return res.status(errorStatus).json({ success: false, message: errorMessage });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 50);
    const beforeId = req.query.before;

    const filter = { conversation: conversation._id };
    if (beforeId) {
      if (!mongoose.Types.ObjectId.isValid(beforeId)) {
        return res.status(400).json({ success: false, message: 'Invalid pagination cursor' });
      }
      const cursorMsg = await Message.findOne({
        _id: beforeId,
        conversation: conversation._id
      }).select('createdAt _id');

      if (!cursorMsg) {
        return res.status(400).json({ success: false, message: 'Invalid pagination cursor' });
      }

      filter.$or = [
        { createdAt: { $lt: cursorMsg.createdAt } },
        { createdAt: cursorMsg.createdAt, _id: { $lt: cursorMsg._id } }
      ];
    }

    const docs = await Message.find(filter)
      .populate('sender', 'username fullName avatar')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = docs.length > limit;
    const pageSlice = hasMore ? docs.slice(0, limit) : docs;
    // Reverse to chronological order (oldest -> newest) for chat UI rendering
    const chronological = pageSlice.reverse().map(formatMessage);
    const nextCursor = hasMore && chronological.length > 0 ? chronological[0].id : null;

    return res.status(200).json({
      success: true,
      messages: chronological,
      hasMore,
      nextCursor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a text-only message in a conversation
// @route   POST /api/messages/conversations/:conversationId/messages
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const senderId = req.user._id;
    const { conversation, errorStatus, errorMessage } = await verifyParticipant(
      conversationId,
      senderId
    );

    if (errorStatus) {
      return res.status(errorStatus).json({ success: false, message: errorMessage });
    }

    const rawText = req.body?.text;
    if (typeof rawText !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message text must be a string'
      });
    }

    const trimmedText = rawText.trim();
    if (!trimmedText) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    if (trimmedText.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`
      });
    }

    // 1. Save message in MongoDB first (sender derived strictly from req.user._id)
    const createdMessage = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      text: trimmedText,
      readBy: [senderId]
    });

    // 2. Update conversation's latest message metadata
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: createdMessage._id,
          lastMessageAt: createdMessage.createdAt
        }
      }
    );

    const populated = await Message.findById(createdMessage._id).populate(
      'sender',
      'username fullName avatar'
    );
    const formattedMessage = formatMessage(populated);

    // 3. Emit real-time Socket.IO events to recipient & conversation room
    const recipient = conversation.participants.find(
      (p) => p && p._id.toString() !== senderId.toString()
    );

    const socketPayload = {
      conversationId: conversation._id.toString(),
      message: formattedMessage
    };

    if (recipient) {
      emitToUser(recipient._id, 'new_message', socketPayload);
    }
    emitToConversation(conversation._id, 'new_message', socketPayload);

    return res.status(201).json({
      success: true,
      message: formattedMessage
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all received unread messages in a conversation as read
// @route   PATCH /api/messages/conversations/:conversationId/read
// @access  Private
export const markConversationAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const readerId = req.user._id;
    const { conversation, errorStatus, errorMessage } = await verifyParticipant(
      conversationId,
      readerId
    );

    if (errorStatus) {
      return res.status(errorStatus).json({ success: false, message: errorMessage });
    }

    const unreadMessages = await Message.find({
      conversation: conversation._id,
      sender: { $ne: readerId },
      readBy: { $ne: readerId }
    }).select('_id');

    const unreadIds = unreadMessages.map((m) => m._id);
    if (unreadIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        { $addToSet: { readBy: readerId } }
      );

      const otherParticipant = conversation.participants.find(
        (p) => p && p._id.toString() !== readerId.toString()
      );
      const readPayload = {
        conversationId: conversation._id.toString(),
        readerId: readerId.toString(),
        messageIds: unreadIds.map((id) => id.toString()),
        readAt: new Date().toISOString()
      };

      if (otherParticipant) {
        emitToUser(otherParticipant._id, 'messages_read', readPayload);
      }
      emitToConversation(conversation._id, 'messages_read', readPayload);
    }

    return res.status(200).json({
      success: true,
      conversationId: conversation._id.toString(),
      markedCount: unreadIds.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a message sent by the authenticated user
// @route   DELETE /api/messages/:messageId
// @access  Private
export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the sender can delete this message'
      });
    }

    const convId = message.conversation;
    await Message.deleteOne({ _id: message._id });

    const conversation = await Conversation.findById(convId);
    let nextLastMessageFormatted = null;

    if (conversation) {
      if (conversation.lastMessage && conversation.lastMessage.toString() === messageId) {
        const latestRemaining = await Message.findOne({ conversation: convId })
          .populate('sender', 'username fullName avatar')
          .sort({ createdAt: -1, _id: -1 });

        await Conversation.updateOne(
          { _id: convId },
          {
            $set: {
              lastMessage: latestRemaining ? latestRemaining._id : null,
              lastMessageAt: latestRemaining ? latestRemaining.createdAt : conversation.createdAt
            }
          }
        );
        nextLastMessageFormatted = latestRemaining ? formatMessage(latestRemaining) : null;
      }

      const deletePayload = {
        conversationId: convId.toString(),
        messageId: message._id.toString(),
        nextLastMessage: nextLastMessageFormatted
      };

      for (const participantId of conversation.participants) {
        emitToUser(participantId, 'message_deleted', deletePayload);
      }
      emitToConversation(convId, 'message_deleted', deletePayload);
    }

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      messageId: message._id.toString(),
      nextLastMessage: nextLastMessageFormatted
    });
  } catch (error) {
    next(error);
  }
};
