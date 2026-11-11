import FollowRequest from '../models/FollowRequest.js';
import Follow from '../models/Follow.js';
import User from '../models/User.js';
import notificationService from '../services/notificationService.js';

// @desc    Get incoming pending follow requests for the authenticated user
// @route   GET /api/follow-requests
// @access  Private
export const getIncomingRequests = async (req, res, next) => {
  try {
    const requests = await FollowRequest.find({
      recipient: req.user._id,
      status: 'pending'
    })
      .populate('requester', 'username fullName avatar isPrivate')
      .sort({ createdAt: -1 });

    const formatted = requests.map((r) => ({
      id: r._id.toString(),
      _id: r._id.toString(),
      status: r.status,
      createdAt: r.createdAt,
      user: {
        id: r.requester._id.toString(),
        _id: r.requester._id.toString(),
        username: r.requester.username,
        fullName: r.requester.fullName,
        avatar: r.requester.avatar,
        isPrivate: Boolean(r.requester.isPrivate)
      }
    }));

    return res.status(200).json({
      success: true,
      requests: formatted,
      count: formatted.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get outgoing pending follow requests sent by the authenticated user
// @route   GET /api/follow-requests/sent
// @access  Private
export const getSentRequests = async (req, res, next) => {
  try {
    const requests = await FollowRequest.find({
      requester: req.user._id,
      status: 'pending'
    })
      .populate('recipient', 'username fullName avatar isPrivate')
      .sort({ createdAt: -1 });

    const formatted = requests.map((r) => ({
      id: r._id.toString(),
      _id: r._id.toString(),
      status: r.status,
      createdAt: r.createdAt,
      recipient: {
        id: r.recipient._id.toString(),
        _id: r.recipient._id.toString(),
        username: r.recipient.username,
        fullName: r.recipient.fullName,
        avatar: r.recipient.avatar,
        isPrivate: Boolean(r.recipient.isPrivate)
      }
    }));

    return res.status(200).json({
      success: true,
      requests: formatted,
      count: formatted.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept an incoming follow request
// @route   POST /api/follow-requests/:requestId/accept
// @access  Private
export const acceptRequest = async (req, res, next) => {
  try {
    const requestDoc = await FollowRequest.findById(req.params.requestId);
    if (!requestDoc) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    // Only the recipient can accept the request
    if (requestDoc.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this request'
      });
    }

    // Prevent approving own request
    if (requestDoc.requester.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid operation'
      });
    }

    // Create follow relationship if not already existing
    await Follow.updateOne(
      { follower: requestDoc.requester, following: req.user._id },
      { $setOnInsert: { follower: requestDoc.requester, following: req.user._id, createdAt: new Date() } },
      { upsert: true }
    );

    // Delete or mark accepted
    await FollowRequest.deleteOne({ _id: requestDoc._id });

    // Remove stale follow_request notification and notify requester of acceptance
    await notificationService.removeMatchingNotifications({
      recipientId: req.user._id,
      senderId: requestDoc.requester,
      type: 'follow_request',
      entityId: requestDoc._id
    });

    await notificationService.createNotification({
      recipientId: requestDoc.requester,
      senderId: req.user._id,
      type: 'follow_request_accepted',
      entityType: 'User',
      entityId: req.user._id
    });

    const followersCount = await Follow.countDocuments({ following: req.user._id });

    return res.status(200).json({
      success: true,
      message: 'Follow request accepted',
      followersCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject an incoming follow request
// @route   POST /api/follow-requests/:requestId/reject
// @access  Private
export const rejectRequest = async (req, res, next) => {
  try {
    const requestDoc = await FollowRequest.findById(req.params.requestId);
    if (!requestDoc) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    // Only recipient can reject
    if (requestDoc.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this request'
      });
    }

    // Delete follow request without creating follow relationship
    await FollowRequest.deleteOne({ _id: requestDoc._id });

    // Clean up stale follow_request notification (no rejection notification generated)
    await notificationService.removeMatchingNotifications({
      recipientId: req.user._id,
      senderId: requestDoc.requester,
      type: 'follow_request',
      entityId: requestDoc._id
    });

    return res.status(200).json({
      success: true,
      message: 'Follow request rejected'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel an outgoing pending follow request
// @route   DELETE /api/follow-requests/:requestId
// @access  Private
export const cancelRequest = async (req, res, next) => {
  try {
    const requestDoc = await FollowRequest.findById(req.params.requestId);
    if (!requestDoc) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    // Requester can cancel their outgoing request, or recipient can delete
    const isRequester = requestDoc.requester.toString() === req.user._id.toString();
    const isRecipient = requestDoc.recipient.toString() === req.user._id.toString();

    if (!isRequester && !isRecipient) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this request'
      });
    }

    await FollowRequest.deleteOne({ _id: requestDoc._id });

    // Clean up stale follow_request notification
    await notificationService.removeMatchingNotifications({
      recipientId: requestDoc.recipient,
      senderId: requestDoc.requester,
      type: 'follow_request',
      entityId: requestDoc._id
    });

    return res.status(200).json({
      success: true,
      message: 'Follow request cancelled'
    });
  } catch (error) {
    next(error);
  }
};
