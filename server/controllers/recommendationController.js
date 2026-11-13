import mongoose from 'mongoose';
import Post from '../models/Post.js';
import Reel from '../models/Reel.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import ReelWatch from '../models/ReelWatch.js';
import { canViewUserContent } from '../middleware/privacyMiddleware.js';
import { enrichPostsForViewer } from './postController.js';
import { enrichReelsForViewer } from './reelController.js';
import {
  getRecommendedIdsForUser,
  scheduleUserCacheInvalidation,
  getCircuitBreakerState,
  getTargetPoolSize
} from '../services/mlRecommendationService.js';
import { getCacheStatus } from '../services/recommendationCacheService.js';
import { getShuffledPageFromPool } from '../services/recommendationShuffleService.js';

const getPermittedAuthorIdSet = async (viewerId) => {
  const [followingDocs, publicUsers] = await Promise.all([
    Follow.find({ follower: viewerId }).select('following').lean(),
    User.find({ isPrivate: false }).select('_id').lean()
  ]);

  return new Set([
    viewerId.toString(),
    ...followingDocs.map((f) => f.following.toString()),
    ...publicUsers.map((u) => u._id.toString())
  ]);
};

// @desc    Get personalized post recommendations (cached / Django ML / MongoDB fallback)
// @route   GET /api/recommendations/posts?page=1&limit=15
// @access  Private
export const getRecommendedPosts = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 30);
    const isRefresh = req.query.refresh === 'true' || page === 1;

    const poolSize = getTargetPoolSize('posts');
    const recResult = await getRecommendedIdsForUser(req.user._id, 'posts', { limit: poolSize });
    const allRecs = recResult.items || [];

    const { pageRecs, totalItems, hasMore } = getShuffledPageFromPool({
      userId: req.user._id,
      contentType: 'posts',
      allRecs,
      page,
      limit,
      refresh: isRefresh
    });

    if (pageRecs.length === 0) {
      return res.status(200).json({
        success: true,
        posts: [],
        page,
        limit,
        totalPosts: totalItems,
        hasMore: false,
        source: recResult.source,
        engine: recResult.engine
      });
    }

    const pageIds = pageRecs.map((item) => item.id).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const scoreById = new Map(pageRecs.map((item) => [item.id, item]));

    const [postDocs, permittedAuthors] = await Promise.all([
      Post.find({ _id: { $in: pageIds } }).populate('user', 'fullName username avatar isPrivate'),
      getPermittedAuthorIdSet(req.user._id)
    ]);

    // Re-enforce privacy even if cached/stale
    const permittedDocs = postDocs.filter(
      (doc) => doc && doc.user && permittedAuthors.has(doc.user._id.toString())
    );
    const docById = new Map(permittedDocs.map((doc) => [doc._id.toString(), doc]));
    const orderedDocs = pageIds.map((id) => docById.get(id)).filter(Boolean);

    const formattedPosts = await enrichPostsForViewer(orderedDocs, req.user._id);
    const enrichedWithReason = formattedPosts.map((post) => {
      const meta = scoreById.get(post.id);
      return {
        ...post,
        recommendationReason: meta?.reason || null,
        recommendationScore: meta?.score ?? null
      };
    });

    return res.status(200).json({
      success: true,
      posts: enrichedWithReason,
      page,
      limit,
      totalPosts: totalItems,
      hasMore,
      source: recResult.source,
      engine: recResult.engine
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get personalized Reel recommendations (cached / Django ML / MongoDB fallback)
// @route   GET /api/recommendations/reels?page=1&limit=8
// @access  Private
export const getRecommendedReels = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 25);
    const isRefresh = req.query.refresh === 'true' || page === 1;

    const poolSize = getTargetPoolSize('reels');
    const recResult = await getRecommendedIdsForUser(req.user._id, 'reels', { limit: poolSize });
    const allRecs = recResult.items || [];

    const { pageRecs, totalItems, hasMore } = getShuffledPageFromPool({
      userId: req.user._id,
      contentType: 'reels',
      allRecs,
      page,
      limit,
      refresh: isRefresh
    });

    if (pageRecs.length === 0) {
      return res.status(200).json({
        success: true,
        reels: [],
        page,
        limit,
        totalReels: totalItems,
        hasMore: false,
        source: recResult.source,
        engine: recResult.engine
      });
    }

    const pageIds = pageRecs.map((item) => item.id).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const scoreById = new Map(pageRecs.map((item) => [item.id, item]));

    const [reelDocs, permittedAuthors] = await Promise.all([
      Reel.find({ _id: { $in: pageIds } }).populate('user', 'fullName username avatar isPrivate'),
      getPermittedAuthorIdSet(req.user._id)
    ]);

    const permittedDocs = reelDocs.filter(
      (doc) => doc && doc.user && permittedAuthors.has(doc.user._id.toString())
    );
    const docById = new Map(permittedDocs.map((doc) => [doc._id.toString(), doc]));
    const orderedDocs = pageIds.map((id) => docById.get(id)).filter(Boolean);

    const formattedReels = await enrichReelsForViewer(orderedDocs, req.user._id);
    const enrichedWithReason = formattedReels.map((reel) => {
      const meta = scoreById.get(reel.id);
      return {
        ...reel,
        recommendationReason: meta?.reason || null,
        recommendationScore: meta?.score ?? null
      };
    });

    return res.status(200).json({
      success: true,
      reels: enrichedWithReason,
      page,
      limit,
      totalReels: totalItems,
      hasMore,
      source: recResult.source,
      engine: recResult.engine
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get personalized User recommendations (cached / Django ML / MongoDB fallback)
// @route   GET /api/recommendations/users?page=1&limit=10
// @access  Private
export const getRecommendedUsers = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
    const isRefresh = req.query.refresh === 'true' || page === 1;

    const poolSize = getTargetPoolSize('users');
    const recResult = await getRecommendedIdsForUser(req.user._id, 'users', { limit: poolSize });
    const allRecs = recResult.items || [];

    const { pageRecs, totalItems, hasMore } = getShuffledPageFromPool({
      userId: req.user._id,
      contentType: 'users',
      allRecs,
      page,
      limit,
      refresh: isRefresh
    });

    if (pageRecs.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        page,
        limit,
        totalUsers: totalItems,
        hasMore: false,
        source: recResult.source,
        engine: recResult.engine
      });
    }

    const pageIds = pageRecs.map((item) => item.id).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const scoreById = new Map(pageRecs.map((item) => [item.id, item]));

    const [userDocs, follows, pendingReqs] = await Promise.all([
      User.find({ _id: { $in: pageIds } })
        .select('username fullName avatar isPrivate bio')
        .lean(),
      Follow.find({ follower: req.user._id, following: { $in: pageIds } })
        .select('following')
        .lean(),
      FollowRequest.find({
        requester: req.user._id,
        recipient: { $in: pageIds },
        status: 'pending'
      })
        .select('recipient _id')
        .lean()
    ]);

    const followingSet = new Set(follows.map((f) => f.following.toString()));
    const pendingMap = new Map(pendingReqs.map((r) => [r.recipient.toString(), r._id.toString()]));
    const docById = new Map(userDocs.map((u) => [u._id.toString(), u]));

    const orderedUsers = pageIds
      .map((id) => {
        const u = docById.get(id);
        if (!u) return null;
        const recMeta = scoreById.get(id) || {};
        const uid = u._id.toString();
        const mutualCount = recMeta.mutual_count || 0;
        const mutualSample = recMeta.mutual_sample || [];

        let subtitle = 'Suggested for you';
        if (mutualCount > 0) {
          if (mutualSample.length > 0) {
            subtitle = `Followed by ${mutualSample[0]}${
              mutualCount > 1 ? ` + ${mutualCount - 1} more` : ''
            }`;
          } else {
            subtitle = `${mutualCount} mutual follower${mutualCount > 1 ? 's' : ''}`;
          }
        } else if (recMeta.reason === 'shared_interests') {
          subtitle = 'Similar interests';
        } else if (recMeta.reason === 'interacted_recently') {
          subtitle = 'Based on your activity';
        } else if (recMeta.reason === 'popular') {
          subtitle = 'Popular on Insta-V2';
        }

        return {
          id: uid,
          _id: uid,
          username: u.username,
          fullName: u.fullName || '',
          avatar: u.avatar || '',
          bio: u.bio || '',
          isPrivate: Boolean(u.isPrivate),
          isFollowing: followingSet.has(uid),
          isPending: pendingMap.has(uid),
          requestId: pendingMap.get(uid) || null,
          subtitle,
          recommendationScore: recMeta.score ?? null,
          recommendationReason: recMeta.reason || 'suggested_for_you',
          mutualFollowersCount: mutualCount,
          mutualFollowersSample: mutualSample
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      users: orderedUsers,
      page,
      limit,
      totalUsers: totalItems,
      hasMore,
      source: recResult.source,
      engine: recResult.engine
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record watch / engagement event for ML feedback & controlled cache invalidation
// @route   POST /api/recommendations/events
// @access  Private
export const recordRecommendationEvent = async (req, res, next) => {
  try {
    const {
      contentType = 'reel',
      contentId,
      eventType = 'watch',
      watchDurationSec = 0,
      completionRate = 0
    } = req.body || {};

    const cleanType = String(contentType || '').trim().toLowerCase();
    const cleanEvent = String(eventType || '').trim().toLowerCase();

    if (!['post', 'reel'].includes(cleanType)) {
      return res.status(400).json({
        success: false,
        message: 'contentType must be "post" or "reel"'
      });
    }

    if (!['watch', 'like', 'comment'].includes(cleanEvent)) {
      return res.status(400).json({
        success: false,
        message: 'eventType must be "watch", "like", or "comment"'
      });
    }

    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid contentId is required'
      });
    }

    const doc =
      cleanType === 'reel'
        ? await Reel.findById(contentId).select('user')
        : await Post.findById(contentId).select('user');

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: `${cleanType === 'reel' ? 'Reel' : 'Post'} not found`
      });
    }

    const allowed = await canViewUserContent(req.user._id, doc.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to interact with this private content'
      });
    }

    const safeDuration = Math.max(0, Number(watchDurationSec) || 0);
    const safeCompletion = Math.max(0, Math.min(1, Number(completionRate) || 0));

    if (cleanType === 'reel' && cleanEvent === 'watch') {
      await ReelWatch.findOneAndUpdate(
        { user: req.user._id, reel: doc._id },
        {
          $max: {
            watchDurationSec: safeDuration,
            completionRate: safeCompletion
          },
          $set: {
            lastWatchedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }

    // Meaningful engagement triggers controlled cache invalidation (ignores tiny <3s skips)
    const isMeaningfulWatch = cleanEvent === 'watch' && (safeDuration >= 3 || safeCompletion >= 0.4);
    if (isMeaningfulWatch || cleanEvent === 'like' || cleanEvent === 'comment') {
      scheduleUserCacheInvalidation(req.user._id, [cleanType === 'reel' ? 'reels' : 'posts']);
    }

    return res.status(200).json({
      success: true,
      recorded: true
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get non-sensitive recommendation cache & circuit-breaker diagnostics
// @route   GET /api/recommendations/status
// @access  Private
export const getRecommendationStatus = async (req, res) => {
  return res.status(200).json({
    success: true,
    cache: getCacheStatus(),
    circuitBreaker: getCircuitBreakerState()
  });
};
