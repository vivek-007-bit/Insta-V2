import mongoose from 'mongoose';
import cloudinary from '../config/cloudinary.js';
import Story from '../models/Story.js';
import Follow from '../models/Follow.js';
import { canViewUserContent } from '../middleware/privacyMiddleware.js';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);

const normalizeSecureUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  return trimmed.startsWith('http://res.cloudinary.com')
    ? trimmed.replace('http://', 'https://')
    : trimmed;
};

const isValidCloudinaryUrl = (url, expectedMediaType = null) => {
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
    if (expectedMediaType === 'video' && !parsed.pathname.includes('/video/')) {
      return false;
    }
    if (expectedMediaType === 'image' && !parsed.pathname.includes('/image/')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const formatStorySlide = (story, viewerId) => {
  const viewerIdStr = viewerId?.toString();
  const ownerIdStr = story.user?._id ? story.user._id.toString() : story.user?.toString();
  const isOwner = Boolean(viewerIdStr && ownerIdStr && viewerIdStr === ownerIdStr);

  const viewers = Array.isArray(story.viewers) ? story.viewers : [];
  const isViewed = Boolean(
    viewerIdStr &&
      viewers.some((v) => (v.user?._id || v.user)?.toString() === viewerIdStr)
  );

  // Exclude the story owner from external viewer counts so owners see real audience count
  const audienceViewersCount = viewers.filter(
    (v) => (v.user?._id || v.user)?.toString() !== ownerIdStr
  ).length;

  return {
    id: story._id.toString(),
    _id: story._id.toString(),
    userId: ownerIdStr,
    mediaUrl: normalizeSecureUrl(story.mediaUrl),
    publicId: story.publicId,
    mediaType: story.mediaType || 'image',
    caption: story.caption || '',
    isViewed,
    isOwner,
    viewersCount: isOwner ? audienceViewersCount : undefined,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt
  };
};

// @desc    Generate signed Cloudinary upload parameters for a Story (image/video)
// @route   POST /api/stories/upload-signature
// @access  Private
export const getStoryUploadSignature = async (req, res, next) => {
  try {
    const { resourceType = 'auto', fileSize, mimeType } = req.body || {};

    if (!['image', 'video', 'auto'].includes(resourceType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resourceType: must be image, video, or auto'
      });
    }

    if (mimeType) {
      const cleanMime = String(mimeType).toLowerCase().trim();
      const isAllowedImage = ALLOWED_IMAGE_MIMES.has(cleanMime);
      const isAllowedVideo = ALLOWED_VIDEO_MIMES.has(cleanMime);
      if (!isAllowedImage && !isAllowedVideo) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported story file format. Use JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV.'
        });
      }
      if (resourceType === 'image' && !isAllowedImage) {
        return res.status(400).json({
          success: false,
          message: 'File MIME type does not match image resourceType'
        });
      }
      if (resourceType === 'video' && !isAllowedVideo) {
        return res.status(400).json({
          success: false,
          message: 'File MIME type does not match video resourceType'
        });
      }
    }

    if (fileSize !== undefined && fileSize !== null) {
      const numericSize = Number(fileSize);
      const maxAllowed = resourceType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (!Number.isFinite(numericSize) || numericSize <= 0 || numericSize > maxAllowed) {
        return res.status(400).json({
          success: false,
          message:
            resourceType === 'video'
              ? 'Story video size must be 50 MB or less'
              : 'Story image size must be 15 MB or less'
        });
      }
    }

    const folder = 'insta_v2/stories';
    const timestamp = Math.round(Date.now() / 1000);
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

    const paramsToSign = { timestamp, folder };
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
      resourceType
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save uploaded story metadata to MongoDB (expires in 24h)
// @route   POST /api/stories
// @access  Private
export const createStory = async (req, res, next) => {
  try {
    const { mediaUrl, publicId, mediaType = 'image', caption = '', fileSize } = req.body || {};

    if (!mediaUrl || !publicId) {
      return res.status(400).json({
        success: false,
        message: 'mediaUrl and publicId are required'
      });
    }

    if (!['image', 'video'].includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mediaType: must be image or video'
      });
    }

    if (!isValidCloudinaryUrl(mediaUrl, mediaType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid mediaUrl: must be a valid Cloudinary ${mediaType} asset`
      });
    }

    if (fileSize !== undefined && fileSize !== null) {
      const numericSize = Number(fileSize);
      const maxAllowed = mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (!Number.isFinite(numericSize) || numericSize <= 0 || numericSize > maxAllowed) {
        return res.status(400).json({
          success: false,
          message:
            mediaType === 'video'
              ? 'Story video size exceeds 50 MB limit'
              : 'Story image size exceeds 15 MB limit'
        });
      }
    }

    const cleanCaption = String(caption || '').trim();
    if (cleanCaption.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Story caption cannot exceed 150 characters'
      });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await Story.create({
      user: req.user._id,
      mediaUrl: normalizeSecureUrl(mediaUrl),
      publicId: String(publicId).trim(),
      mediaType,
      caption: cleanCaption,
      viewers: [],
      expiresAt
    });

    const formattedSlide = formatStorySlide(story, req.user._id);

    return res.status(201).json({
      success: true,
      message: 'Story shared successfully',
      story: {
        ...formattedSlide,
        username: req.user.username,
        userAvatar: normalizeSecureUrl(req.user.avatar)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active stories feed grouped by user (self + followed accounts)
// @route   GET /api/stories/feed
// @access  Private
export const getStoriesFeed = async (req, res, next) => {
  try {
    const viewerId = req.user._id;
    const now = new Date();

    // Only approved follow relationships exist in Follow collection (covers public + approved private)
    const follows = await Follow.find({ follower: viewerId }).select('following');
    const followedUserIds = follows.map((f) => f.following);
    const eligibleOwnerIds = [viewerId, ...followedUserIds];

    const activeStories = await Story.find({
      user: { $in: eligibleOwnerIds },
      expiresAt: { $gt: now }
    })
      .populate('user', 'username fullName avatar isPrivate')
      .sort({ createdAt: 1 });

    // Group active stories by user
    const groupsMap = new Map();

    for (const story of activeStories) {
      if (!story.user) continue; // Guard against orphaned records if a user was deleted

      const uid = story.user._id.toString();
      if (!groupsMap.has(uid)) {
        groupsMap.set(uid, {
          id: `story_group_${uid}`,
          userId: uid,
          username: story.user.username,
          fullName: story.user.fullName,
          userAvatar: normalizeSecureUrl(story.user.avatar),
          isPrivate: Boolean(story.user.isPrivate),
          isOwn: uid === viewerId.toString(),
          hasUnseen: false,
          latestCreatedAt: story.createdAt,
          stories: []
        });
      }

      const group = groupsMap.get(uid);
      const slide = formatStorySlide(story, viewerId);
      group.stories.push(slide);

      if (!slide.isViewed) {
        group.hasUnseen = true;
      }
      if (new Date(story.createdAt) > new Date(group.latestCreatedAt)) {
        group.latestCreatedAt = story.createdAt;
      }
    }

    const groups = Array.from(groupsMap.values());

    // Sort: own story first, then unseen stories (newest first), then seen stories (newest first)
    groups.sort((a, b) => {
      if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return new Date(b.latestCreatedAt) - new Date(a.latestCreatedAt);
    });

    return res.status(200).json({
      success: true,
      storyGroups: groups
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single active story by ID with privacy check
// @route   GET /api/stories/:storyId
// @access  Private
export const getStoryById = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid story ID'
      });
    }

    const story = await Story.findOne({
      _id: storyId,
      expiresAt: { $gt: new Date() }
    }).populate('user', 'username fullName avatar isPrivate');

    if (!story || !story.user) {
      return res.status(404).json({
        success: false,
        message: 'Story not found or has expired'
      });
    }

    const allowed = await canViewUserContent(req.user._id, story.user._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'This story belongs to a private account. Follow this user to view it.'
      });
    }

    const slide = formatStorySlide(story, req.user._id);

    return res.status(200).json({
      success: true,
      story: {
        ...slide,
        username: story.user.username,
        fullName: story.user.fullName,
        userAvatar: normalizeSecureUrl(story.user.avatar),
        isPrivate: Boolean(story.user.isPrivate)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a unique view on an active story
// @route   POST /api/stories/:storyId/view
// @access  Private
export const recordStoryView = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid story ID'
      });
    }

    const story = await Story.findOne({
      _id: storyId,
      expiresAt: { $gt: new Date() }
    }).select('user viewers');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found or has expired'
      });
    }

    const allowed = await canViewUserContent(req.user._id, story.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'This story belongs to a private account. Follow this user to view it.'
      });
    }

    await Story.updateOne(
      { _id: story._id, 'viewers.user': { $ne: req.user._id } },
      { $push: { viewers: { user: req.user._id, viewedAt: new Date() } } }
    );

    const updated = await Story.findById(story._id).select('user viewers');
    const isOwner = story.user.toString() === req.user._id.toString();
    const audienceCount = (updated?.viewers || []).filter(
      (v) => v.user?.toString() !== story.user.toString()
    ).length;

    return res.status(200).json({
      success: true,
      storyId: story._id.toString(),
      viewed: true,
      viewersCount: isOwner ? audienceCount : undefined
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get list of users who viewed an owned story
// @route   GET /api/stories/:storyId/viewers
// @access  Private (Owner only)
export const getStoryViewers = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid story ID'
      });
    }

    const story = await Story.findOne({
      _id: storyId,
      expiresAt: { $gt: new Date() }
    })
      .select('user viewers')
      .populate('viewers.user', 'username fullName avatar isPrivate');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found or has expired'
      });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the story owner can inspect story viewers'
      });
    }

    const ownerIdStr = req.user._id.toString();
    const viewers = (story.viewers || [])
      .filter((entry) => entry.user && entry.user._id.toString() !== ownerIdStr)
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
      .map((entry) => ({
        id: entry.user._id.toString(),
        username: entry.user.username,
        fullName: entry.user.fullName,
        avatar: normalizeSecureUrl(entry.user.avatar),
        isPrivate: Boolean(entry.user.isPrivate),
        viewedAt: entry.viewedAt
      }));

    return res.status(200).json({
      success: true,
      storyId: story._id.toString(),
      viewersCount: viewers.length,
      viewers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an owned story from MongoDB and Cloudinary
// @route   DELETE /api/stories/:storyId
// @access  Private (Owner only)
export const deleteStory = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid story ID'
      });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this story'
      });
    }

    if (story.publicId && !story.publicId.startsWith('insta-v2/demo/')) {
      try {
        await cloudinary.uploader.destroy(story.publicId, {
          resource_type: story.mediaType === 'video' ? 'video' : 'image'
        });
      } catch (cloudErr) {
        console.warn('[Stories] Cloudinary destroy warning:', cloudErr.message);
      }
    }

    await Story.deleteOne({ _id: story._id });

    return res.status(200).json({
      success: true,
      message: 'Story deleted successfully',
      storyId: story._id.toString()
    });
  } catch (error) {
    next(error);
  }
};
