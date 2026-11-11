import cloudinary from '../config/cloudinary.js';
import Post from '../models/Post.js';
import Story from '../models/Story.js';

const ALLOWED_FOLDERS = ['insta_v2', 'insta_v2/posts', 'insta_v2/stories'];
const ALLOWED_RESOURCE_TYPES = ['image', 'video', 'auto'];

// @desc    Generate a secure signature for Cloudinary signed upload
// @route   POST /api/media/signature
// @access  Private
export const generateUploadSignature = async (req, res, next) => {
  try {
    const { folder = 'insta_v2', resourceType = 'auto' } = req.body;

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid upload folder specified'
      });
    }

    if (!ALLOWED_RESOURCE_TYPES.includes(resourceType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resource type specified'
      });
    }

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

    // Parameters to sign (must match exact parameters sent in FormData to Cloudinary)
    const paramsToSign = {
      timestamp,
      folder
    };

    if (uploadPreset) {
      paramsToSign.upload_preset = uploadPreset;
    }

    // Generate cryptographic signature using API secret
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

// Validate Cloudinary URL belongs to configured cloud name
const isValidCloudinaryUrl = (url) => {
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
    return true;
  } catch {
    return false;
  }
};

// @desc    Save uploaded post media metadata to MongoDB
// @route   POST /api/media/posts
// @access  Private
export const createPost = async (req, res, next) => {
  try {
    const {
      mediaUrl,
      publicId,
      mediaType = 'image',
      caption = '',
      location = '',
      mediaAspect = 'square'
    } = req.body;

    if (!mediaUrl || !publicId) {
      return res.status(400).json({
        success: false,
        message: 'mediaUrl and publicId are required'
      });
    }

    if (!isValidCloudinaryUrl(mediaUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media URL: media must be hosted on the configured Cloudinary account'
      });
    }

    if (!['image', 'video'].includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mediaType: must be image or video'
      });
    }

    const post = await Post.create({
      user: req.user._id,
      mediaUrl: mediaUrl.trim(),
      publicId: publicId.trim(),
      mediaType,
      caption: (caption || '').trim(),
      location: (location || '').trim(),
      mediaAspect: ['square', 'portrait', 'landscape'].includes(mediaAspect)
        ? mediaAspect
        : 'square'
    });

    const populatedPost = await Post.findById(post._id).populate(
      'user',
      'fullName username avatar'
    );

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: {
        id: populatedPost._id.toString(),
        _id: populatedPost._id.toString(),
        author: {
          id: req.user._id.toString(),
          username: req.user.username,
          fullName: req.user.fullName,
          avatar: req.user.avatar,
          isVerified: false
        },
        location: populatedPost.location || 'San Francisco, CA',
        mediaUrl: populatedPost.mediaUrl,
        publicId: populatedPost.publicId,
        mediaType: populatedPost.mediaType,
        mediaAspect: populatedPost.mediaAspect,
        caption: populatedPost.caption,
        likesCount: 0,
        isLiked: false,
        isSaved: false,
        comments: [],
        createdAt: 'JUST NOW'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save uploaded story media metadata to MongoDB
// @route   POST /api/media/stories
// @access  Private
export const createStory = async (req, res, next) => {
  try {
    const { mediaUrl, publicId, mediaType = 'image', caption = '' } = req.body;

    if (!mediaUrl || !publicId) {
      return res.status(400).json({
        success: false,
        message: 'mediaUrl and publicId are required'
      });
    }

    if (!isValidCloudinaryUrl(mediaUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media URL: media must be hosted on the configured Cloudinary account'
      });
    }

    if (!['image', 'video'].includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mediaType: must be image or video'
      });
    }

    const story = await Story.create({
      user: req.user._id,
      mediaUrl: mediaUrl.trim(),
      publicId: publicId.trim(),
      mediaType,
      caption: (caption || '').trim()
    });

    return res.status(201).json({
      success: true,
      message: 'Story created successfully',
      story: {
        id: story._id.toString(),
        _id: story._id.toString(),
        userId: req.user._id.toString(),
        username: req.user.username,
        userAvatar: req.user.avatar,
        mediaUrl: story.mediaUrl,
        publicId: story.publicId,
        mediaType: story.mediaType,
        caption: story.caption,
        timestamp: 'Just now',
        expiresAt: story.expiresAt,
        createdAt: story.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};
