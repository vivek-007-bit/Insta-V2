import mongoose from 'mongoose';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import Like from '../models/Like.js';
import Comment from '../models/Comment.js';
import { canViewUserContent } from '../middleware/privacyMiddleware.js';
import notificationService from '../services/notificationService.js';
import { scheduleUserCacheInvalidation } from '../services/mlRecommendationService.js';

// Helper to format post with author, like status, and comment previews
export const enrichPostsForViewer = async (posts, viewerId) => {
  if (!posts || posts.length === 0) return [];
  const postIds = posts.map((p) => p._id);

  const [userLikes, allComments] = await Promise.all([
    Like.find({ user: viewerId, post: { $in: postIds } }).select('post'),
    Comment.find({ post: { $in: postIds } })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
  ]);

  const likedPostIds = new Set(userLikes.map((l) => l.post.toString()));
  const commentsByPost = new Map();

  for (const c of allComments) {
    const pid = c.post.toString();
    if (!commentsByPost.has(pid)) commentsByPost.set(pid, []);
    if (commentsByPost.get(pid).length < 2) {
      commentsByPost.get(pid).push({
        id: c._id.toString(),
        _id: c._id.toString(),
        userId: c.user?._id?.toString(),
        username: c.user?.username || 'user',
        avatar: c.user?.avatar,
        text: c.text,
        createdAt: c.createdAt
      });
    }
  }

  return posts
    .filter((p) => p && p.user)
    .map((p) => {
      const pid = p._id.toString();
      const secureMediaUrl =
        p.mediaUrl && p.mediaUrl.startsWith('http://res.cloudinary.com')
          ? p.mediaUrl.replace('http://', 'https://')
          : p.mediaUrl;
      const secureAvatar =
        p.user.avatar && p.user.avatar.startsWith('http://res.cloudinary.com')
          ? p.user.avatar.replace('http://', 'https://')
          : p.user.avatar;

      return {
        id: pid,
        _id: pid,
        author: {
          id: p.user._id.toString(),
          username: p.user.username,
          fullName: p.user.fullName,
          avatar: secureAvatar,
          isPrivate: Boolean(p.user.isPrivate),
          isVerified: false
        },
        location: p.location || '',
        mediaUrl: secureMediaUrl,
        publicId: p.publicId,
        mediaType: p.mediaType,
        mediaAspect: p.mediaAspect,
        caption: p.caption,
        likesCount: p.likesCount || 0,
        commentsCount: p.commentsCount || 0,
        isLiked: likedPostIds.has(pid),
        isSaved: false,
        comments: (commentsByPost.get(pid) || []).reverse(),
        createdAt: p.createdAt
      };
    });
};

// @desc    Get authorized feed posts (own posts + following + public accounts)
// @route   GET /api/posts/feed
// @access  Private
export const getFeedPosts = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    // Find users current user follows & public users
    const [followingDocs, publicUsers] = await Promise.all([
      Follow.find({ follower: req.user._id }).select('following'),
      User.find({ isPrivate: false }).select('_id')
    ]);

    const allowedUserIds = new Set([
      req.user._id.toString(),
      ...followingDocs.map((f) => f.following.toString()),
      ...publicUsers.map((u) => u._id.toString())
    ]);

    const allowedIdsArray = Array.from(allowedUserIds);

    const [posts, totalPosts] = await Promise.all([
      Post.find({ user: { $in: allowedIdsArray } })
        .populate('user', 'fullName username avatar isPrivate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ user: { $in: allowedIdsArray } })
    ]);

    const formattedPosts = await enrichPostsForViewer(posts, req.user._id);

    return res.status(200).json({
      success: true,
      posts: formattedPosts,
      totalPosts,
      page,
      hasMore: skip + posts.length < totalPosts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single post by ID (enforces private account rules)
// @route   GET /api/posts/:postId
// @access  Private
export const getPostById = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId).populate(
      'user',
      'fullName username avatar isPrivate'
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const allowed = await canViewUserContent(req.user._id, post.user._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        isPrivate: true,
        author: {
          id: post.user._id.toString(),
          username: post.user.username,
          avatar: post.user.avatar
        },
        message: 'This post belongs to a private account. Follow the user to view it.'
      });
    }

    const [formatted] = await enrichPostsForViewer([post], req.user._id);

    return res.status(200).json({
      success: true,
      post: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get shareable metadata & link for a post (enforces privacy)
// @route   GET /api/posts/:postId/share
// @access  Private
export const getPostShareInfo = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId).populate(
      'user',
      'fullName username avatar isPrivate'
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const allowed = await canViewUserContent(req.user._id, post.user._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        canView: false,
        isPrivate: true,
        author: {
          username: post.user.username,
          avatar: post.user.avatar
        },
        message: 'This post is private. Only approved followers can view or access its media.'
      });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const shareUrl = `${clientUrl}/p/${post._id.toString()}`;

    return res.status(200).json({
      success: true,
      canView: true,
      isPrivate: Boolean(post.user.isPrivate),
      shareUrl,
      title: `Post by @${post.user.username} on Insta-V2`,
      text: post.caption || `Check out this post by @${post.user.username} on Insta-V2`,
      post: {
        id: post._id.toString(),
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        caption: post.caption,
        author: {
          id: post.user._id.toString(),
          username: post.user.username,
          fullName: post.user.fullName,
          avatar: post.user.avatar
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like a post (enforces privacy & prevents duplicate likes)
// @route   POST /api/posts/:postId/like
// @access  Private
export const likePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const allowed = await canViewUserContent(req.user._id, post.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to interact with this private post'
      });
    }

    // Attempt atomic creation; if duplicate key (11000), user already liked it
    try {
      await Like.create({ user: req.user._id, post: post._id });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'You have already liked this post',
          liked: true,
          likesCount: post.likesCount
        });
      }
      throw err;
    }

    const updatedPost = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    await notificationService.createNotification({
      recipientId: post.user,
      senderId: req.user._id,
      type: 'like',
      entityType: 'Post',
      entityId: post._id
    });

    scheduleUserCacheInvalidation(req.user._id, ['posts']);

    return res.status(201).json({
      success: true,
      liked: true,
      likesCount: updatedPost.likesCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlike a post
// @route   DELETE /api/posts/:postId/like
// @access  Private
export const unlikePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const allowed = await canViewUserContent(req.user._id, post.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to interact with this private post'
      });
    }

    const deleted = await Like.findOneAndDelete({
      user: req.user._id,
      post: post._id
    });

    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'You have not liked this post',
        liked: false,
        likesCount: post.likesCount
      });
    }

    const updatedPost = await Post.findOneAndUpdate(
      { _id: post._id, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } },
      { new: true }
    );

    await notificationService.removeMatchingNotifications({
      recipientId: post.user,
      senderId: req.user._id,
      type: 'like',
      entityId: post._id
    });

    scheduleUserCacheInvalidation(req.user._id, ['posts']);

    return res.status(200).json({
      success: true,
      liked: false,
      likesCount: updatedPost ? updatedPost.likesCount : 0
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users who liked a post (paginated, enforces privacy)
// @route   GET /api/posts/:postId/likes
// @access  Private
export const getPostLikes = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const allowed = await canViewUserContent(req.user._id, post.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view likes for this private post'
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const [likes, totalCount] = await Promise.all([
      Like.find({ post: post._id })
        .populate('user', 'username fullName avatar isPrivate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Like.countDocuments({ post: post._id })
    ]);

    const users = likes
      .map((l) => l.user)
      .filter((u) => u !== null)
      .map((u) => ({
        id: u._id.toString(),
        _id: u._id.toString(),
        username: u.username,
        fullName: u.fullName,
        avatar: u.avatar,
        isPrivate: Boolean(u.isPrivate)
      }));

    return res.status(200).json({
      success: true,
      likes: users,
      totalCount,
      page,
      hasMore: skip + likes.length < totalCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a comment to a post (enforces privacy)
// @route   POST /api/posts/:postId/comments
// @access  Private
export const addComment = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text cannot be empty' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const allowed = await canViewUserContent(req.user._id, post.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to comment on this private post'
      });
    }

    const comment = await Comment.create({
      user: req.user._id,
      post: post._id,
      text: text.trim()
    });

    const updatedPost = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { commentsCount: 1 } },
      { new: true }
    );

    await notificationService.createNotification({
      recipientId: post.user,
      senderId: req.user._id,
      type: 'comment',
      entityType: 'Post',
      entityId: post._id,
      message: comment.text
    });

    scheduleUserCacheInvalidation(req.user._id, ['posts']);

    return res.status(201).json({
      success: true,
      message: 'Comment added',
      comment: {
        id: comment._id.toString(),
        _id: comment._id.toString(),
        userId: req.user._id.toString(),
        username: req.user.username,
        avatar: req.user.avatar,
        text: comment.text,
        createdAt: comment.createdAt
      },
      commentsCount: updatedPost.commentsCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated comments for a post (enforces privacy)
// @route   GET /api/posts/:postId/comments
// @access  Private
export const getComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const allowed = await canViewUserContent(req.user._id, post.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view comments on this private post'
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const [comments, totalComments] = await Promise.all([
      Comment.find({ post: post._id })
        .populate('user', 'username fullName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments({ post: post._id })
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

// @desc    Delete a comment (only comment author or post owner)
// @route   DELETE /api/comments/:commentId
// @access  Private
export const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const post = await Post.findById(comment.post);
    if (!post) {
      // Post was deleted; allow comment owner to clean up orphan comment
      if (comment.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      await Comment.deleteOne({ _id: comment._id });
      return res.status(200).json({
        success: true,
        message: 'Comment deleted',
        commentId: comment._id.toString()
      });
    }

    const isCommentOwner = comment.user.toString() === req.user._id.toString();
    const isPostOwner = post.user.toString() === req.user._id.toString();

    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this comment'
      });
    }

    await Comment.deleteOne({ _id: comment._id });

    const updatedPost = await Post.findOneAndUpdate(
      { _id: post._id, commentsCount: { $gt: 0 } },
      { $inc: { commentsCount: -1 } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Comment deleted',
      commentId: comment._id.toString(),
      postId: post._id.toString(),
      commentsCount: updatedPost ? updatedPost.commentsCount : 0
    });
  } catch (error) {
    next(error);
  }
};
