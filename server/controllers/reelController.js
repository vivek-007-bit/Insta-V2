import mongoose from 'mongoose';
import cloudinary from '../config/cloudinary.js';
import Reel from '../models/Reel.js';
import ReelLike from '../models/ReelLike.js';
import ReelComment from '../models/ReelComment.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import { canViewUserContent } from '../middleware/privacyMiddleware.js';
import notificationService from '../services/notificationService.js';

// Validate Cloudinary video URL belongs to configured cloud name
const isValidCloudinaryVideoUrl = (url) => {
  try {
    const parsed = new URL(url);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const validHost =
      parsed.hostname.endsWith('cloudinary.com') &&
      (parsed.protocol === 'https:' || parsed.protocol === 'http:');
    if (!validHost) return false;
    if (cloudName && !parsed.pathname.includes(`/${cloudName}/`)) {
      return false;
    }
    if (!parsed.pathname.includes('/video/')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Build Cloudinary thumbnail URL from video publicId
const buildCloudinaryThumbnail = (publicId) => {
  try {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      secure: true,
      transformation: [
        { start_offset: '0', width: 720, crop: 'limit', quality: 'auto' }
      ]
    });
  } catch {
    return '';
  }
};

// Enrich reels with creator follow status and viewer like status
const enrichReelsForViewer = async (reels, viewerId) => {
  if (!reels || reels.length === 0) return [];

  const reelIds = reels.map((r) => r._id);
  const authorIds = [...new Set(reels.map((r) => r.user._id.toString()))];

  const [userLikes, follows, pendingReqs] = await Promise.all([
    ReelLike.find({ user: viewerId, reel: { $in: reelIds } }).select('reel'),
    Follow.find({ follower: viewerId, following: { $in: authorIds } }).select('following'),
    FollowRequest.find({
      requester: viewerId,
      recipient: { $in: authorIds },
      status: 'pending'
    }).select('recipient _id')
  ]);

  const likedReelIds = new Set(userLikes.map((l) => l.reel.toString()));
  const followingSet = new Set(follows.map((f) => f.following.toString()));
  const pendingMap = new Map(
    pendingReqs.map((req) => [req.recipient.toString(), req._id.toString()])
  );

  return reels.map((r) => {
    const rid = r._id.toString();
    const authorId = r.user._id.toString();
    const isSelf = viewerId && viewerId.toString() === authorId;

    return {
      id: rid,
      _id: rid,
      author: {
        id: authorId,
        _id: authorId,
        username: r.user.username,
        fullName: r.user.fullName,
        avatar: r.user.avatar,
        isPrivate: Boolean(r.user.isPrivate),
        isVerified: false,
        isFollowing: followingSet.has(authorId),
        isPending: pendingMap.has(authorId),
        requestId: pendingMap.get(authorId) || null,
        isSelf
      },
      videoUrl: r.videoUrl,
      publicId: r.publicId,
      posterUrl: r.thumbnailUrl || buildCloudinaryThumbnail(r.publicId),
      thumbnailUrl: r.thumbnailUrl || buildCloudinaryThumbnail(r.publicId),
      caption: r.caption || '',
      audioTrack: r.audioTrack || `${r.user.username} • Original Audio`,
      duration: r.duration || 0,
      aspectRatio: r.aspectRatio || '9:16',
      likesCount: r.likesCount || 0,
      commentsCount: r.commentsCount || 0,
      sharesCount: r.sharesCount || 0,
      isLiked: likedReelIds.has(rid),
      isSaved: false,
      createdAt: r.createdAt
    };
  });
};

// @desc    Generate Cloudinary signed upload signature specifically for Reel videos
// @route   POST /api/reels/upload-signature
// @access  Private
export const getReelUploadSignature = async (req, res, next) => {
  try {
    const folder = 'insta_v2/reels';
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!apiSecret || !apiKey || !cloudName) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary server credentials are not fully configured'
      });
    }

    const paramsToSign = {
      timestamp,
      folder
    };

    if (uploadPreset) {
      paramsToSign.upload_preset = uploadPreset;
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return res.status(200).json({
      success: true,
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      uploadPreset: uploadPreset || null,
      resourceType: 'video'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new Reel after direct Cloudinary upload
// @route   POST /api/reels
// @access  Private
export const createReel = async (req, res, next) => {
  try {
    const {
      videoUrl,
      publicId,
      caption = '',
      thumbnailUrl = '',
      duration = 0,
      aspectRatio = '9:16',
      audioTrack = ''
    } = req.body;

    if (!videoUrl || !publicId) {
      return res.status(400).json({
        success: false,
        message: 'videoUrl and publicId are required'
      });
    }

    if (!isValidCloudinaryVideoUrl(videoUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video URL: Reel must be a valid Cloudinary video asset'
      });
    }

    const cleanPublicId = publicId.trim();
    const resolvedThumbnail =
      thumbnailUrl && thumbnailUrl.includes('cloudinary.com')
        ? thumbnailUrl.trim()
        : buildCloudinaryThumbnail(cleanPublicId);

    const parsedDuration = Number(duration);
    const safeDuration = Number.isFinite(parsedDuration) && parsedDuration >= 0 ? parsedDuration : 0;

    const reel = await Reel.create({
      user: req.user._id,
      videoUrl: videoUrl.trim(),
      publicId: cleanPublicId,
      thumbnailUrl: resolvedThumbnail,
      caption: (caption || '').trim(),
      audioTrack: (audioTrack || '').trim() || `${req.user.username} • Original Audio`,
      duration: safeDuration,
      aspectRatio: (aspectRatio || '9:16').trim()
    });

    const populatedReel = await Reel.findById(reel._id).populate(
      'user',
      'fullName username avatar isPrivate'
    );

    const [formatted] = await enrichReelsForViewer([populatedReel], req.user._id);

    return res.status(201).json({
      success: true,
      message: 'Reel published successfully',
      reel: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated Reels feed respecting private account authorization
// @route   GET /api/reels
// @access  Private
export const getReels = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
    const cursor = req.query.cursor;

    const [followingDocs, publicUsers] = await Promise.all([
      Follow.find({ follower: req.user._id }).select('following'),
      User.find({ isPrivate: false }).select('_id')
    ]);

    const allowedUserIds = Array.from(
      new Set([
        req.user._id.toString(),
        ...followingDocs.map((f) => f.following.toString()),
        ...publicUsers.map((u) => u._id.toString())
      ])
    );

    const query = { user: { $in: allowedUserIds } };
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        query.createdAt = { $lt: cursorDate };
      }
    }

    const skip = cursor ? 0 : (page - 1) * limit;

    const [reels, totalReels] = await Promise.all([
      Reel.find(query)
        .populate('user', 'fullName username avatar isPrivate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Reel.countDocuments({ user: { $in: allowedUserIds } })
    ]);

    const formattedReels = await enrichReelsForViewer(reels, req.user._id);
    const nextCursor =
      reels.length > 0 ? reels[reels.length - 1].createdAt.toISOString() : null;

    return res.status(200).json({
      success: true,
      reels: formattedReels,
      totalReels,
      page,
      hasMore: cursor ? reels.length === limit : skip + reels.length < totalReels,
      nextCursor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single Reel by ID (enforces private account rules)
// @route   GET /api/reels/:reelId
// @access  Private
export const getReelById = async (req, res, next) => {
  try {
    const { reelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID' });
    }

    const reel = await Reel.findById(reelId).populate(
      'user',
      'fullName username avatar isPrivate'
    );

    if (!reel || !reel.user) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const allowed = await canViewUserContent(req.user._id, reel.user._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        isPrivate: true,
        author: {
          id: reel.user._id.toString(),
          username: reel.user.username,
          avatar: reel.user.avatar
        },
        message: 'This reel belongs to a private account. Follow the user to view it.'
      });
    }

    const [formatted] = await enrichReelsForViewer([reel], req.user._id);

    return res.status(200).json({
      success: true,
      reel: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Reel (owner only, removes from MongoDB & Cloudinary)
// @route   DELETE /api/reels/:reelId
// @access  Private
export const deleteReel = async (req, res, next) => {
  try {
    const { reelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID' });
    }

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    // Verify ownership strictly
    if (reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this reel'
      });
    }

    // Attempt to delete video asset from Cloudinary via server-side SDK
    let cloudinaryDeleted = false;
    if (reel.publicId) {
      try {
        const result = await cloudinary.uploader.destroy(reel.publicId, {
          resource_type: 'video',
          invalidate: true
        });
        cloudinaryDeleted = result?.result === 'ok' || result?.result === 'not found';
        if (!cloudinaryDeleted) {
          console.warn(
            `[Cloudinary] Unexpected destroy response for ${reel.publicId}:`,
            result
          );
        }
      } catch (cloudErr) {
        // Log gracefully without failing DB deletion if asset is missing or unreachable
        console.error(
          `[Cloudinary] Failed to destroy reel video ${reel.publicId}:`,
          cloudErr.message
        );
      }
    }

    // Delete associated likes, comments, and the reel document
    await Promise.all([
      ReelLike.deleteMany({ reel: reel._id }),
      ReelComment.deleteMany({ reel: reel._id }),
      Reel.deleteOne({ _id: reel._id })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Reel deleted successfully',
      reelId: reel._id.toString(),
      cloudinaryDeleted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like a Reel (prevents duplicates, enforces privacy)
// @route   POST /api/reels/:reelId/like
// @access  Private
export const likeReel = async (req, res, next) => {
  try {
    const { reelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID' });
    }

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const allowed = await canViewUserContent(req.user._id, reel.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to interact with this private reel'
      });
    }

    try {
      await ReelLike.create({ user: req.user._id, reel: reel._id });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'You have already liked this reel',
          liked: true,
          likesCount: reel.likesCount
        });
      }
      throw err;
    }

    const updatedReel = await Reel.findByIdAndUpdate(
      reel._id,
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    await notificationService.createNotification({
      recipientId: reel.user,
      senderId: req.user._id,
      type: 'reel_like',
      entityType: 'Reel',
      entityId: reel._id
    });

    return res.status(201).json({
      success: true,
      liked: true,
      likesCount: updatedReel.likesCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlike a Reel
// @route   DELETE /api/reels/:reelId/like
// @access  Private
export const unlikeReel = async (req, res, next) => {
  try {
    const { reelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID' });
    }

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const allowed = await canViewUserContent(req.user._id, reel.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to interact with this private reel'
      });
    }

    const deleted = await ReelLike.findOneAndDelete({
      user: req.user._id,
      reel: reel._id
    });

    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'You have not liked this reel',
        liked: false,
        likesCount: reel.likesCount
      });
    }

    const updatedReel = await Reel.findOneAndUpdate(
      { _id: reel._id, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } },
      { new: true }
    );

    await notificationService.removeMatchingNotifications({
      recipientId: reel.user,
      senderId: req.user._id,
      type: 'reel_like',
      entityId: reel._id
    });

    return res.status(200).json({
      success: true,
      liked: false,
      likesCount: updatedReel ? updatedReel.likesCount : 0
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated comments for a Reel (enforces privacy)
// @route   GET /api/reels/:reelId/comments
// @access  Private
export const getReelComments = async (req, res, next) => {
  try {
    const { reelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID' });
    }

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const allowed = await canViewUserContent(req.user._id, reel.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view comments on this private reel'
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const [comments, totalComments] = await Promise.all([
      ReelComment.find({ reel: reel._id })
        .populate('user', 'username fullName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ReelComment.countDocuments({ reel: reel._id })
    ]);

    const formatted = comments
      .filter((c) => c.user !== null)
      .map((c) => ({
        id: c._id.toString(),
        _id: c._id.toString(),
        userId: c.user._id.toString(),
        username: c.user.username,
        fullName: c.user.fullName,
        avatar: c.user.avatar,
        text: c.text,
        createdAt: c.createdAt
      }));

    return res.status(200).json({
      success: true,
      comments: formatted,
      totalComments,
      page,
      hasMore: skip + comments.length < totalComments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a comment to a Reel (enforces privacy)
// @route   POST /api/reels/:reelId/comments
// @access  Private
export const addReelComment = async (req, res, next) => {
  try {
    const { reelId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text cannot be empty' });
    }

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const allowed = await canViewUserContent(req.user._id, reel.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to comment on this private reel'
      });
    }

    const comment = await ReelComment.create({
      user: req.user._id,
      reel: reel._id,
      text: text.trim()
    });

    const updatedReel = await Reel.findByIdAndUpdate(
      reel._id,
      { $inc: { commentsCount: 1 } },
      { new: true }
    );

    await notificationService.createNotification({
      recipientId: reel.user,
      senderId: req.user._id,
      type: 'reel_comment',
      entityType: 'Reel',
      entityId: reel._id,
      message: comment.text
    });

    return res.status(201).json({
      success: true,
      message: 'Comment added',
      comment: {
        id: comment._id.toString(),
        _id: comment._id.toString(),
        userId: req.user._id.toString(),
        username: req.user.username,
        fullName: req.user.fullName,
        avatar: req.user.avatar,
        text: comment.text,
        createdAt: comment.createdAt
      },
      commentsCount: updatedReel.commentsCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Reel comment (comment author or reel owner)
// @route   DELETE /api/reels/comments/:commentId
// @access  Private
export const deleteReelComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const reel = await Reel.findById(comment.reel);
    if (!reel) {
      if (comment.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      await ReelComment.deleteOne({ _id: comment._id });
      return res.status(200).json({
        success: true,
        message: 'Comment deleted',
        commentId: comment._id.toString()
      });
    }

    const isCommentOwner = comment.user.toString() === req.user._id.toString();
    const isReelOwner = reel.user.toString() === req.user._id.toString();

    if (!isCommentOwner && !isReelOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this comment'
      });
    }

    await ReelComment.deleteOne({ _id: comment._id });

    const updatedReel = await Reel.findOneAndUpdate(
      { _id: reel._id, commentsCount: { $gt: 0 } },
      { $inc: { commentsCount: -1 } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Comment deleted',
      commentId: comment._id.toString(),
      reelId: reel._id.toString(),
      commentsCount: updatedReel ? updatedReel.commentsCount : 0
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get share metadata & stable URL for a Reel (enforces privacy)
// @route   GET /api/reels/:reelId/share
// @access  Private
export const getReelShareInfo = async (req, res, next) => {
  try {
    const { reelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({ success: false, message: 'Invalid reel ID' });
    }

    const reel = await Reel.findById(reelId).populate(
      'user',
      'fullName username avatar isPrivate'
    );

    if (!reel || !reel.user) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const allowed = await canViewUserContent(req.user._id, reel.user._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        canView: false,
        isPrivate: true,
        author: {
          username: reel.user.username,
          avatar: reel.user.avatar
        },
        message: 'This reel is private. Only approved followers can view or share it.'
      });
    }

    // Increment share count atomically
    const updated = await Reel.findByIdAndUpdate(
      reel._id,
      { $inc: { sharesCount: 1 } },
      { new: true }
    );

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const shareUrl = `${clientUrl}/reels/${reel._id.toString()}`;

    return res.status(200).json({
      success: true,
      canView: true,
      isPrivate: Boolean(reel.user.isPrivate),
      shareUrl,
      sharesCount: updated.sharesCount,
      title: `Reel by @${reel.user.username} on Insta-V2`,
      text: reel.caption || `Watch this Reel by @${reel.user.username} on Insta-V2`
    });
  } catch (error) {
    next(error);
  }
};
