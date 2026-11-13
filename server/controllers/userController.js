import mongoose from 'mongoose';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import Post from '../models/Post.js';
import Reel from '../models/Reel.js';
import ReelLike from '../models/ReelLike.js';
import Like from '../models/Like.js';
import Comment from '../models/Comment.js';
import { canViewUserContent } from '../middleware/privacyMiddleware.js';
import { formatUserWithStats } from './authController.js';
import notificationService from '../services/notificationService.js';
import { scheduleUserCacheInvalidation } from '../services/mlRecommendationService.js';

// Helper to resolve user by ObjectId or username
const findUserByIdOrUsername = async (idOrUsername) => {
  if (!idOrUsername) return null;
  if (mongoose.Types.ObjectId.isValid(idOrUsername)) {
    const byId = await User.findById(idOrUsername);
    if (byId) return byId;
  }
  return await User.findOne({ username: idOrUsername.toLowerCase().trim() });
};

// Helper to compute viewer's relationship status with target user(s)
const getRelationshipStatus = async (viewerId, targetUserId) => {
  if (!viewerId || !targetUserId) {
    return { isFollowing: false, isPending: false, requestId: null, isSelf: false };
  }
  if (viewerId.toString() === targetUserId.toString()) {
    return { isFollowing: false, isPending: false, requestId: null, isSelf: true };
  }

  const [isFollowing, pendingReq] = await Promise.all([
    Follow.exists({ follower: viewerId, following: targetUserId }),
    FollowRequest.findOne({
      requester: viewerId,
      recipient: targetUserId,
      status: 'pending'
    }).select('_id')
  ]);

  return {
    isFollowing: Boolean(isFollowing),
    isPending: Boolean(pendingReq),
    requestId: pendingReq ? pendingReq._id.toString() : null,
    isSelf: false
  };
};

// Helper to enrich a list of user docs with follow status relative to viewer
const enrichUsersWithFollowStatus = async (viewerId, users) => {
  if (!users || users.length === 0) return [];
  const targetIds = users.map((u) => u._id);

  const [follows, pendingReqs] = await Promise.all([
    Follow.find({ follower: viewerId, following: { $in: targetIds } }).select('following'),
    FollowRequest.find({
      requester: viewerId,
      recipient: { $in: targetIds },
      status: 'pending'
    }).select('recipient _id')
  ]);

  const followingSet = new Set(follows.map((f) => f.following.toString()));
  const pendingMap = new Map(
    pendingReqs.map((r) => [r.recipient.toString(), r._id.toString()])
  );

  return users.map((u) => {
    const uid = u._id.toString();
    const isSelf = viewerId && viewerId.toString() === uid;
    return {
      id: uid,
      _id: uid,
      username: u.username,
      fullName: u.fullName,
      avatar: u.avatar,
      isPrivate: Boolean(u.isPrivate),
      isFollowing: followingSet.has(uid),
      isPending: pendingMap.has(uid),
      requestId: pendingMap.get(uid) || null,
      isSelf
    };
  });
};

// @desc    Search users by username or full name
// @route   GET /api/users/search?q=...
// @access  Private
export const searchUsers = async (req, res, next) => {
  try {
    const rawQuery = (req.query.q || '').trim();
    const escapedQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const filter = escapedQuery
      ? {
          $or: [
            { username: { $regex: escapedQuery, $options: 'i' } },
            { fullName: { $regex: escapedQuery, $options: 'i' } }
          ]
        }
      : {};

    const users = await User.find(filter)
      .select('username fullName avatar isPrivate')
      .limit(limit)
      .sort({ createdAt: -1 });

    const enriched = await enrichUsersWithFollowStatus(req.user._id, users);

    return res.status(200).json({
      success: true,
      users: enriched
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suggested users to follow (other users in database)
// @route   GET /api/users/suggestions
// @access  Private
export const getSuggestedUsers = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);

    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username fullName avatar isPrivate')
      .limit(limit)
      .sort({ createdAt: -1 });

    const enriched = await enrichUsersWithFollowStatus(req.user._id, users);

    return res.status(200).json({
      success: true,
      users: enriched
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's account privacy (public/private)
// @route   PATCH /api/users/me/privacy
// @access  Private
export const updatePrivacy = async (req, res, next) => {
  try {
    const { isPrivate } = req.body;

    if (typeof isPrivate !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isPrivate must be a boolean value'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const wasPrivate = Boolean(user.isPrivate);
    user.isPrivate = isPrivate;
    await user.save();

    // When transitioning from private -> public, handle pending requests consistently and securely
    if (wasPrivate && !isPrivate) {
      const pendingRequests = await FollowRequest.find({
        recipient: user._id,
        status: 'pending'
      });

      for (const reqDoc of pendingRequests) {
        // Never create self-follow or follow for non-existent users
        if (reqDoc.requester.toString() === user._id.toString()) {
          await FollowRequest.deleteOne({ _id: reqDoc._id });
          continue;
        }
        const requesterExists = await User.exists({ _id: reqDoc.requester });
        if (!requesterExists) {
          await FollowRequest.deleteOne({ _id: reqDoc._id });
          continue;
        }

        // Safely upsert follow relationship without duplicates
        await Follow.updateOne(
          { follower: reqDoc.requester, following: user._id },
          { $setOnInsert: { follower: reqDoc.requester, following: user._id, createdAt: new Date() } },
          { upsert: true }
        );

        reqDoc.status = 'accepted';
        await reqDoc.save();
      }
    }

    const updatedProfile = await formatUserWithStats(user);

    return res.status(200).json({
      success: true,
      message: `Account is now ${isPrivate ? 'Private' : 'Public'}`,
      isPrivate: user.isPrivate,
      user: updatedProfile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's profile info
// @route   PATCH /api/users/me/profile
// @access  Private
export const updateMyProfile = async (req, res, next) => {
  try {
    const { fullName, username, bio, website, avatar } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (username !== undefined) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3 || !/^[a-z0-9_.]+$/.test(cleanUsername)) {
        return res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters and contain only letters, numbers, underscores, and periods'
        });
      }
      if (cleanUsername !== user.username) {
        const exists = await User.exists({ username: cleanUsername, _id: { $ne: user._id } });
        if (exists) {
          return res.status(400).json({
            success: false,
            message: 'This username is already taken'
          });
        }
        user.username = cleanUsername;
      }
    }

    if (fullName !== undefined) user.fullName = fullName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (website !== undefined) user.website = website.trim();
    if (avatar !== undefined && avatar.trim()) user.avatar = avatar.trim();

    await user.save();

    const updatedProfile = await formatUserWithStats(user);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedProfile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a user's profile with privacy & follow status
// @route   GET /api/users/:userId/profile
// @access  Private
export const getUserProfile = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const [profileStats, followStatus, canViewContent] = await Promise.all([
      formatUserWithStats(targetUser),
      getRelationshipStatus(req.user._id, targetUser._id),
      canViewUserContent(req.user._id, targetUser._id)
    ]);

    return res.status(200).json({
      success: true,
      user: {
        id: profileStats.id,
        _id: profileStats._id,
        username: profileStats.username,
        fullName: profileStats.fullName,
        avatar: profileStats.avatar,
        bio: profileStats.bio,
        website: profileStats.website,
        isPrivate: profileStats.isPrivate,
        postsCount: profileStats.postsCount,
        followersCount: profileStats.followersCount,
        followingCount: profileStats.followingCount,
        isVerified: profileStats.isVerified
      },
      followStatus,
      canViewContent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a user's posts (enforces private account rules)
// @route   GET /api/users/:userId/posts
// @access  Private
export const getUserPosts = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const allowed = await canViewUserContent(req.user._id, targetUser._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'This account is private. Follow this user to see their posts.'
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 18, 50);
    const skip = (page - 1) * limit;

    const [posts, totalPosts] = await Promise.all([
      Post.find({ user: targetUser._id })
        .populate('user', 'fullName username avatar isPrivate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ user: targetUser._id })
    ]);

    const postIds = posts.map((p) => p._id);
    const [userLikes, latestComments] = await Promise.all([
      Like.find({ user: req.user._id, post: { $in: postIds } }).select('post'),
      Comment.find({ post: { $in: postIds } })
        .populate('user', 'username avatar')
        .sort({ createdAt: -1 })
    ]);

    const likedPostIds = new Set(userLikes.map((l) => l.post.toString()));
    const commentsByPost = new Map();
    for (const c of latestComments) {
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

    const formattedPosts = posts
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

// @desc    Get a user's reels (enforces private account rules)
// @route   GET /api/users/:userId/reels
// @access  Private
export const getUserReels = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const allowed = await canViewUserContent(req.user._id, targetUser._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'This account is private. Follow this user to see their reels.'
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 18, 50);
    const skip = (page - 1) * limit;

    const [reels, totalReels] = await Promise.all([
      Reel.find({ user: targetUser._id })
        .populate('user', 'fullName username avatar isPrivate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Reel.countDocuments({ user: targetUser._id })
    ]);

    const reelIds = reels.map((r) => r._id);
    const userLikes = await ReelLike.find({ user: req.user._id, reel: { $in: reelIds } }).select('reel');
    const likedReelIds = new Set(userLikes.map((l) => l.reel.toString()));

    const formattedReels = reels
      .filter((r) => r && r.user)
      .map((r) => {
        const rid = r._id.toString();
        const secureVideo =
          r.videoUrl && r.videoUrl.startsWith('http://res.cloudinary.com')
            ? r.videoUrl.replace('http://', 'https://')
            : r.videoUrl;
        const secureThumb =
          r.thumbnailUrl && r.thumbnailUrl.startsWith('http://res.cloudinary.com')
            ? r.thumbnailUrl.replace('http://', 'https://')
            : r.thumbnailUrl;
        return {
          id: rid,
          _id: rid,
          author: {
            id: r.user._id.toString(),
            username: r.user.username,
            fullName: r.user.fullName,
            avatar: r.user.avatar,
            isPrivate: Boolean(r.user.isPrivate),
            isVerified: false
          },
          videoUrl: secureVideo,
          thumbnailUrl: secureThumb || '',
          posterUrl: secureThumb || '',
          caption: r.caption || '',
          audioTrack: r.audioTrack || `${r.user.username} • Original Audio`,
          likesCount: r.likesCount || 0,
          commentsCount: r.commentsCount || 0,
          sharesCount: r.sharesCount || 0,
          isLiked: likedReelIds.has(rid),
          createdAt: r.createdAt
        };
      });

    return res.status(200).json({
      success: true,
      reels: formattedReels,
      totalReels,
      page,
      hasMore: skip + reels.length < totalReels
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Follow a public user or send follow request to a private user
// @route   POST /api/users/:userId/follow
// @access  Private
export const followUser = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    // Check if already following
    const existingFollow = await Follow.exists({
      follower: req.user._id,
      following: targetUser._id
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'You are already following this user'
      });
    }

    // Public account -> follow immediately
    if (!targetUser.isPrivate) {
      await Follow.create({
        follower: req.user._id,
        following: targetUser._id
      });

      // Remove any leftover follow request
      await FollowRequest.deleteMany({
        requester: req.user._id,
        recipient: targetUser._id
      });

      const followersCount = await Follow.countDocuments({ following: targetUser._id });

      await notificationService.createNotification({
        recipientId: targetUser._id,
        senderId: req.user._id,
        type: 'follow',
        entityType: 'User',
        entityId: req.user._id
      });

      scheduleUserCacheInvalidation(req.user._id, ['users', 'posts']);

      return res.status(201).json({
        success: true,
        status: 'following',
        isFollowing: true,
        isPending: false,
        requestId: null,
        followersCount,
        message: `You are now following @${targetUser.username}`
      });
    }

    // Private account -> check existing pending request
    const existingRequest = await FollowRequest.findOne({
      requester: req.user._id,
      recipient: targetUser._id
    });

    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Follow request already sent'
      });
    }

    // Create or reset to pending
    let requestDoc;
    if (existingRequest) {
      existingRequest.status = 'pending';
      requestDoc = await existingRequest.save();
    } else {
      requestDoc = await FollowRequest.create({
        requester: req.user._id,
        recipient: targetUser._id,
        status: 'pending'
      });
    }

    await notificationService.createNotification({
      recipientId: targetUser._id,
      senderId: req.user._id,
      type: 'follow_request',
      entityType: 'FollowRequest',
      entityId: requestDoc._id
    });

    scheduleUserCacheInvalidation(req.user._id, ['users']);

    return res.status(201).json({
      success: true,
      status: 'requested',
      isFollowing: false,
      isPending: true,
      requestId: requestDoc._id.toString(),
      message: `Follow request sent to @${targetUser.username}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:userId/follow
// @access  Private
export const unfollowUser = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid operation'
      });
    }

    const deleted = await Follow.findOneAndDelete({
      follower: req.user._id,
      following: targetUser._id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'You are not following this user'
      });
    }

    const followersCount = await Follow.countDocuments({ following: targetUser._id });

    await notificationService.removeMatchingNotifications({
      recipientId: targetUser._id,
      senderId: req.user._id,
      type: 'follow',
      entityId: req.user._id
    });

    scheduleUserCacheInvalidation(req.user._id, ['users', 'posts']);

    return res.status(200).json({
      success: true,
      status: 'none',
      isFollowing: false,
      isPending: false,
      requestId: null,
      followersCount,
      message: `Unfollowed @${targetUser.username}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a user's followers (paginated)
// @route   GET /api/users/:userId/followers
// @access  Private
export const getFollowers = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const allowed = await canViewUserContent(req.user._id, targetUser._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'This account is private. Follow this user to see their followers.'
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const [followDocs, totalCount] = await Promise.all([
      Follow.find({ following: targetUser._id })
        .populate('follower', 'username fullName avatar isPrivate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Follow.countDocuments({ following: targetUser._id })
    ]);

    const followerUsers = followDocs
      .map((doc) => doc.follower)
      .filter((u) => u !== null);

    const enriched = await enrichUsersWithFollowStatus(req.user._id, followerUsers);

    return res.status(200).json({
      success: true,
      followers: enriched,
      totalCount,
      page,
      hasMore: skip + followDocs.length < totalCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users that a user is following (paginated)
// @route   GET /api/users/:userId/following
// @access  Private
export const getFollowing = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const allowed = await canViewUserContent(req.user._id, targetUser._id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'This account is private. Follow this user to see who they follow.'
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const [followDocs, totalCount] = await Promise.all([
      Follow.find({ follower: targetUser._id })
        .populate('following', 'username fullName avatar isPrivate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Follow.countDocuments({ follower: targetUser._id })
    ]);

    const followingUsers = followDocs
      .map((doc) => doc.following)
      .filter((u) => u !== null);

    const enriched = await enrichUsersWithFollowStatus(req.user._id, followingUsers);

    return res.status(200).json({
      success: true,
      following: enriched,
      totalCount,
      page,
      hasMore: skip + followDocs.length < totalCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get follow relationship status between current user and target user
// @route   GET /api/users/:userId/follow-status
// @access  Private
export const getFollowStatus = async (req, res, next) => {
  try {
    const targetUser = await findUserByIdOrUsername(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const status = await getRelationshipStatus(req.user._id, targetUser._id);

    return res.status(200).json({
      success: true,
      ...status,
      isPrivate: Boolean(targetUser.isPrivate)
    });
  } catch (error) {
    next(error);
  }
};
