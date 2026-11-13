import User from '../models/User.js';
import Post from '../models/Post.js';
import Reel from '../models/Reel.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import Like from '../models/Like.js';
import Comment from '../models/Comment.js';
import ReelLike from '../models/ReelLike.js';
import ReelComment from '../models/ReelComment.js';
import ReelWatch from '../models/ReelWatch.js';
import {
  initRedisCache,
  getCachedRecommendations,
  getStaleRecommendations,
  setCachedRecommendations,
  invalidateUserRecommendations
} from './recommendationCacheService.js';
import { clearUserShuffleSession } from './recommendationShuffleService.js';

const getMlConfig = () => ({
  baseUrl: (process.env.ML_SERVICE_URL || '').trim().replace(/\/+$/, ''),
  internalKey: (process.env.ML_SERVICE_SECRET || process.env.ML_INTERNAL_API_KEY || '').trim(),
  timeoutMs: Math.max(500, parseInt(process.env.ML_TIMEOUT_MS || '3500', 10) || 3500),
  maxRetries: Math.max(0, Math.min(2, parseInt(process.env.ML_MAX_RETRIES || '1', 10) || 1)),
  cacheTtlSec: Math.max(1, parseInt(process.env.RECOMMENDATION_CACHE_TTL_SEC || '300', 10) || 300),
  failureThreshold: Math.max(1, parseInt(process.env.ML_CIRCUIT_FAILURE_THRESHOLD || '3', 10) || 3),
  cooldownMs: Math.max(2000, parseInt(process.env.ML_CIRCUIT_COOLDOWN_MS || '30000', 10) || 30000),
  // Configurable recommendation pool sizes to cache sufficient candidates for fresh presentation
  poolSizeUsers: Math.max(20, parseInt(process.env.RECOMMENDATION_POOL_SIZE_USERS || '50', 10) || 50),
  poolSizePosts: Math.max(30, parseInt(process.env.RECOMMENDATION_POOL_SIZE_POSTS || '80', 10) || 80),
  poolSizeReels: Math.max(20, parseInt(process.env.RECOMMENDATION_POOL_SIZE_REELS || '60', 10) || 60)
});

export const getTargetPoolSize = (contentType = 'posts') => {
  const cfg = getMlConfig();
  if (contentType === 'users') return cfg.poolSizeUsers;
  if (contentType === 'reels') return cfg.poolSizeReels;
  return cfg.poolSizePosts;
};

// Single-flight deduplication to avoid concurrent duplicate generation for the same user+type
const inFlightGenerations = new Map();

// Circuit breaker state
const circuitBreaker = {
  state: 'CLOSED', // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failures: 0,
  openedAt: 0,
  lastError: null
};

export const getCircuitBreakerState = () => ({
  state: circuitBreaker.state,
  failures: circuitBreaker.failures,
  openedAt: circuitBreaker.openedAt,
  lastError: circuitBreaker.lastError
});

export const resetCircuitBreaker = () => {
  circuitBreaker.state = 'CLOSED';
  circuitBreaker.failures = 0;
  circuitBreaker.openedAt = 0;
  circuitBreaker.lastError = null;
};

const canAttemptMlRequest = (cfg) => {
  if (!cfg.baseUrl || !cfg.internalKey) return false;
  if (circuitBreaker.state === 'CLOSED') return true;
  if (circuitBreaker.state === 'OPEN') {
    if (Date.now() - circuitBreaker.openedAt >= cfg.cooldownMs) {
      circuitBreaker.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  return true; // HALF_OPEN
};

const recordMlSuccess = () => {
  circuitBreaker.state = 'CLOSED';
  circuitBreaker.failures = 0;
  circuitBreaker.openedAt = 0;
  circuitBreaker.lastError = null;
};

const recordMlFailure = (errMsg, cfg) => {
  circuitBreaker.failures += 1;
  circuitBreaker.lastError = errMsg || 'ML service request failed';
  if (circuitBreaker.state === 'HALF_OPEN' || circuitBreaker.failures >= cfg.failureThreshold) {
    circuitBreaker.state = 'OPEN';
    circuitBreaker.openedAt = Date.now();
  }
};

const extractHashtags = (caption = '') => {
  const matches = String(caption || '').match(/#([a-zA-Z0-9_]+)/g) || [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
};

const getAllowedAuthorIds = async (viewerId) => {
  const [followingDocs, publicUsers] = await Promise.all([
    Follow.find({ follower: viewerId }).select('following').lean(),
    User.find({ isPrivate: false }).select('_id').lean()
  ]);

  const followedSet = new Set(followingDocs.map((f) => f.following.toString()));
  const allowedSet = new Set([
    viewerId.toString(),
    ...followedSet,
    ...publicUsers.map((u) => u._id.toString())
  ]);

  return {
    allowedIds: Array.from(allowedSet),
    followedSet
  };
};

const buildPostsContext = async (viewerId, allowedIds, followedSet, limit = 80) => {
  const queryLimit = Math.max(160, limit * 2);
  const candidates = await Post.find({ user: { $in: allowedIds } })
    .select('user caption location mediaType likesCount commentsCount createdAt')
    .sort({ createdAt: -1 })
    .limit(queryLimit)
    .lean();

  if (candidates.length === 0) {
    return { candidates: [], payload: null };
  }

  const candidateIds = candidates.map((p) => p._id);
  const [userLikes, userComments, peerLikes, peerComments] = await Promise.all([
    Like.find({ user: viewerId, post: { $in: candidateIds } }).select('post').lean(),
    Comment.find({ user: viewerId, post: { $in: candidateIds } }).select('post').lean(),
    Like.find({ user: { $ne: viewerId }, post: { $in: candidateIds } })
      .select('user post')
      .limit(400)
      .lean(),
    Comment.find({ user: { $ne: viewerId }, post: { $in: candidateIds } })
      .select('user post')
      .limit(400)
      .lean()
  ]);

  const peerMap = new Map();
  for (const l of peerLikes) {
    const uid = l.user.toString();
    const pid = l.post.toString();
    if (!peerMap.has(uid)) peerMap.set(uid, {});
    peerMap.get(uid)[pid] = (peerMap.get(uid)[pid] || 0) + 2.5;
  }
  for (const c of peerComments) {
    const uid = c.user.toString();
    const pid = c.post.toString();
    if (!peerMap.has(uid)) peerMap.set(uid, {});
    peerMap.get(uid)[pid] = (peerMap.get(uid)[pid] || 0) + 3.5;
  }

  const peerInteractions = Array.from(peerMap.entries())
    .slice(0, 60)
    .map(([uid, itemWeights]) => ({ user_id: uid, item_weights: itemWeights }));

  const payload = {
    user_id: viewerId.toString(),
    limit,
    user_profile: {
      liked_ids: userLikes.map((l) => l.post.toString()),
      commented_ids: userComments.map((c) => c.post.toString()),
      followed_author_ids: Array.from(followedSet),
      watch_history: {}
    },
    peer_interactions: peerInteractions,
    candidates: candidates.map((p) => ({
      id: p._id.toString(),
      author_id: p.user.toString(),
      caption: p.caption || '',
      hashtags: extractHashtags(p.caption),
      location: p.location || '',
      media_type: p.mediaType || 'image',
      likes_count: p.likesCount || 0,
      comments_count: p.commentsCount || 0,
      shares_count: 0,
      created_at: p.createdAt ? new Date(p.createdAt).toISOString() : null
    }))
  };

  return { candidates, payload };
};

const buildReelsContext = async (viewerId, allowedIds, followedSet, limit = 60) => {
  const queryLimit = Math.max(120, limit * 2);
  const candidates = await Reel.find({ user: { $in: allowedIds } })
    .select('user caption audioTrack likesCount commentsCount sharesCount createdAt')
    .sort({ createdAt: -1 })
    .limit(queryLimit)
    .lean();

  if (candidates.length === 0) {
    return { candidates: [], payload: null };
  }

  const candidateIds = candidates.map((r) => r._id);
  const [userLikes, userComments, userWatches, peerLikes, peerWatches] = await Promise.all([
    ReelLike.find({ user: viewerId, reel: { $in: candidateIds } }).select('reel').lean(),
    ReelComment.find({ user: viewerId, reel: { $in: candidateIds } }).select('reel').lean(),
    ReelWatch.find({ user: viewerId, reel: { $in: candidateIds } })
      .select('reel watchDurationSec completionRate')
      .lean(),
    ReelLike.find({ user: { $ne: viewerId }, reel: { $in: candidateIds } })
      .select('user reel')
      .limit(400)
      .lean(),
    ReelWatch.find({ user: { $ne: viewerId }, reel: { $in: candidateIds } })
      .select('user reel completionRate')
      .limit(400)
      .lean()
  ]);

  const watchHistory = {};
  for (const w of userWatches) {
    watchHistory[w.reel.toString()] = {
      duration_sec: w.watchDurationSec || 0,
      completion_rate: w.completionRate || 0
    };
  }

  const peerMap = new Map();
  for (const l of peerLikes) {
    const uid = l.user.toString();
    const rid = l.reel.toString();
    if (!peerMap.has(uid)) peerMap.set(uid, {});
    peerMap.get(uid)[rid] = (peerMap.get(uid)[rid] || 0) + 2.5;
  }
  for (const w of peerWatches) {
    const uid = w.user.toString();
    const rid = w.reel.toString();
    if (!peerMap.has(uid)) peerMap.set(uid, {});
    peerMap.get(uid)[rid] = (peerMap.get(uid)[rid] || 0) + (0.5 + 2.5 * (w.completionRate || 0));
  }

  const peerInteractions = Array.from(peerMap.entries())
    .slice(0, 60)
    .map(([uid, itemWeights]) => ({ user_id: uid, item_weights: itemWeights }));

  const payload = {
    user_id: viewerId.toString(),
    limit,
    user_profile: {
      liked_ids: userLikes.map((l) => l.reel.toString()),
      commented_ids: userComments.map((c) => c.reel.toString()),
      followed_author_ids: Array.from(followedSet),
      watch_history: watchHistory
    },
    peer_interactions: peerInteractions,
    candidates: candidates.map((r) => ({
      id: r._id.toString(),
      author_id: r.user.toString(),
      caption: r.caption || '',
      hashtags: extractHashtags(r.caption),
      location: '',
      audio_track: r.audioTrack || '',
      media_type: 'video',
      likes_count: r.likesCount || 0,
      comments_count: r.commentsCount || 0,
      shares_count: r.sharesCount || 0,
      created_at: r.createdAt ? new Date(r.createdAt).toISOString() : null
    }))
  };

  return { candidates, payload };
};

const buildUsersContext = async (viewerId, limit = 50) => {
  const queryLimit = Math.max(80, limit * 2);
  const [viewer, followingDocs, pendingRequests] = await Promise.all([
    User.findById(viewerId).select('bio username').lean(),
    Follow.find({ follower: viewerId }).select('following').lean(),
    FollowRequest.find({ requester: viewerId, status: 'pending' }).select('recipient').lean()
  ]);

  const followedSet = new Set(followingDocs.map((f) => f.following.toString()));
  const pendingSet = new Set(pendingRequests.map((r) => r.recipient.toString()));
  const excludedSet = new Set([viewerId.toString(), ...followedSet, ...pendingSet]);

  const candidateUsers = await User.find({ _id: { $nin: Array.from(excludedSet) } })
    .select('username fullName avatar bio isPrivate createdAt')
    .sort({ createdAt: -1 })
    .limit(queryLimit)
    .lean();

  if (candidateUsers.length === 0) {
    return {
      candidates: [],
      payload: null,
      mutualMap: new Map(),
      followersMap: new Map(),
      interactionMap: new Map()
    };
  }

  const candidateIds = candidateUsers.map((u) => u._id);

  // Compute mutual followers
  const mutualFollowDocs =
    followedSet.size > 0
      ? await Follow.find({
          follower: { $in: Array.from(followedSet) },
          following: { $in: candidateIds }
        })
          .populate('follower', 'username')
          .lean()
      : [];

  const mutualMap = new Map();
  for (const f of mutualFollowDocs) {
    const candId = f.following.toString();
    if (!mutualMap.has(candId)) {
      mutualMap.set(candId, { ids: [], usernames: [] });
    }
    const followerId = f.follower?._id?.toString() || f.follower?.toString();
    const followerUsername = f.follower?.username || '';
    mutualMap.get(candId).ids.push(followerId);
    if (followerUsername && !mutualMap.get(candId).usernames.includes(followerUsername)) {
      mutualMap.get(candId).usernames.push(followerUsername);
    }
  }

  // Aggregate candidate metrics and viewer cross-interactions
  const [followerCounts, postCounts, viewerLikesOnCandidates] = await Promise.all([
    Follow.aggregate([
      { $match: { following: { $in: candidateIds } } },
      { $group: { _id: '$following', count: { $sum: 1 } } }
    ]),
    Post.aggregate([
      { $match: { user: { $in: candidateIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } }
    ]),
    Like.aggregate([
      { $match: { user: viewerId } },
      {
        $lookup: {
          from: 'posts',
          localField: 'post',
          foreignField: '_id',
          as: 'postDoc'
        }
      },
      { $unwind: '$postDoc' },
      { $match: { 'postDoc.user': { $in: candidateIds } } },
      { $group: { _id: '$postDoc.user', count: { $sum: 1 } } }
    ])
  ]);

  const followersMap = new Map(followerCounts.map((f) => [f._id.toString(), f.count]));
  const postsMap = new Map(postCounts.map((p) => [p._id.toString(), p.count]));
  const interactionMap = new Map(viewerLikesOnCandidates.map((l) => [l._id.toString(), l.count]));

  const payload = {
    user_id: viewerId.toString(),
    limit,
    user_profile: {
      bio: viewer?.bio || '',
      following_ids: Array.from(followedSet),
      interacted_author_ids: Object.fromEntries(interactionMap.entries()),
      top_hashtags: []
    },
    candidates: candidateUsers.map((u) => {
      const uid = u._id.toString();
      const m = mutualMap.get(uid) || { ids: [], usernames: [] };
      return {
        id: uid,
        username: u.username,
        full_name: u.fullName || '',
        bio: u.bio || '',
        avatar: u.avatar || '',
        is_private: Boolean(u.isPrivate),
        followers_count: followersMap.get(uid) || 0,
        posts_count: postsMap.get(uid) || 0,
        top_hashtags: [],
        mutual_follower_ids: m.ids,
        mutual_follower_usernames: m.usernames,
        interaction_score: interactionMap.get(uid) || 0
      };
    })
  };

  return {
    candidates: candidateUsers,
    payload,
    mutualMap,
    followersMap,
    interactionMap
  };
};

const buildMongoUserFallbackRanking = (candidates, mutualMap, followersMap, interactionMap) => {
  const scored = candidates.map((u) => {
    const uid = u._id.toString();
    const mCount = (mutualMap.get(uid)?.ids || []).length;
    const fCount = followersMap.get(uid) || 0;
    const iCount = interactionMap.get(uid) || 0;
    const jitter = Math.random() * 0.15;
    const score = Number((mCount * 1.5 + Math.log1p(fCount) * 0.4 + iCount * 0.8 + jitter).toFixed(6));
    const reason =
      mCount > 0
        ? 'mutual_followers'
        : iCount > 0
        ? 'interacted_recently'
        : fCount >= 5
        ? 'popular'
        : 'suggested_for_you';

    return {
      id: uid,
      score,
      reason,
      mutual_count: mCount,
      mutual_sample: mutualMap.get(uid)?.usernames || []
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
};

const callDjangoMlService = async (endpointPath, payload, cfg) => {
  let lastErr = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const response = await fetch(`${cfg.baseUrl}${endpointPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service-Key': cfg.internalKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const msg = `Django ML service responded with HTTP ${response.status}`;
        if (response.status >= 500) {
          throw new Error(msg);
        }
        // 4xx config/validation errors should not retry repeatedly
        const err = new Error(msg);
        err.noRetry = true;
        throw err;
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.recommendations)) {
        throw new Error('Invalid response structure from ML service');
      }

      recordMlSuccess();
      return data;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err?.noRetry) break;
    }
  }

  recordMlFailure(lastErr?.message, cfg);
  throw lastErr || new Error('ML service unavailable');
};

const buildMongoFallbackRanking = (candidates, followedSet) => {
  const now = Date.now();
  const scored = candidates.map((item) => {
    const ageHours = item.createdAt
      ? Math.max(0, (now - new Date(item.createdAt).getTime()) / 3600000)
      : 48;
    const engagement = Math.log1p(
      (item.likesCount || 0) + 2 * (item.commentsCount || 0) + 2 * (item.sharesCount || 0)
    );
    const recency = Math.exp(-ageHours / 72);
    const followBoost = followedSet.has(item.user.toString()) ? 0.35 : 0;
    const jitter = Math.random() * 0.25; // Randomized shuffle factor so fallback feed varies cleanly
    const score = Number((0.45 * recency + 0.35 * (engagement / 6) + followBoost + jitter).toFixed(6));

    return {
      id: item._id.toString(),
      score,
      reason: followBoost > 0 ? 'following' : 'fallback'
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
};

export const getRecommendedIdsForUser = async (viewerId, contentType = 'posts', { limit } = {}) => {
  await initRedisCache();
  const cfg = getMlConfig();
  const targetPoolSize = Math.max(limit || 0, getTargetPoolSize(contentType));
  const uid = viewerId.toString();
  const flightKey = `${contentType}:${uid}`;

  // 1. Check fresh cache first
  const cached = await getCachedRecommendations(uid, contentType);
  if (cached && Array.isArray(cached.items)) {
    return {
      items: cached.items,
      source: 'cache',
      engine: cached.engine || 'cached'
    };
  }

  // 2. Deduplicate concurrent generation requests for the same user+type
  if (inFlightGenerations.has(flightKey)) {
    return inFlightGenerations.get(flightKey);
  }

  const generationPromise = (async () => {
    let ctx;
    let endpoint;
    let followedSet = new Set();

    if (contentType === 'users') {
      ctx = await buildUsersContext(viewerId, targetPoolSize);
      endpoint = '/api/ml/recommend/users';
    } else if (contentType === 'reels') {
      const authInfo = await getAllowedAuthorIds(viewerId);
      followedSet = authInfo.followedSet;
      ctx = await buildReelsContext(viewerId, authInfo.allowedIds, followedSet, targetPoolSize);
      endpoint = '/api/ml/recommend/reels';
    } else {
      const authInfo = await getAllowedAuthorIds(viewerId);
      followedSet = authInfo.followedSet;
      ctx = await buildPostsContext(viewerId, authInfo.allowedIds, followedSet, targetPoolSize);
      endpoint = '/api/ml/recommend/posts';
    }

    if (!ctx.candidates || ctx.candidates.length === 0) {
      return {
        items: [],
        source: 'empty',
        engine: 'none'
      };
    }

    // 3. Call Django ML service if circuit breaker permits
    if (canAttemptMlRequest(cfg)) {
      try {
        const mlRes = await callDjangoMlService(endpoint, ctx.payload, cfg);
        const resultPayload = {
          items: mlRes.recommendations,
          engine: mlRes.engine || (contentType === 'users' ? 'user-graph-interest-v1' : 'hybrid-tfidf-cf-v1'),
          generatedAt: new Date().toISOString()
        };
        await setCachedRecommendations(uid, contentType, resultPayload, cfg.cacheTtlSec);
        return {
          items: resultPayload.items,
          source: 'ml-django',
          engine: resultPayload.engine
        };
      } catch (err) {
        console.warn(`[ML Recommendation] Falling back (${contentType}):`, err.message);
      }
    }

    // 4. Stale-cache fallback if Django is unavailable/open
    const stale = await getStaleRecommendations(uid, contentType);
    if (stale && Array.isArray(stale.items) && stale.items.length > 0) {
      return {
        items: stale.items,
        source: 'stale-cache',
        engine: stale.engine || 'stale-cache'
      };
    }

    // 5. MongoDB rule-based randomized fallback (privacy-safe)
    const fallbackItems =
      contentType === 'users'
        ? buildMongoUserFallbackRanking(
            ctx.candidates,
            ctx.mutualMap,
            ctx.followersMap,
            ctx.interactionMap
          ).slice(0, targetPoolSize)
        : buildMongoFallbackRanking(ctx.candidates, followedSet).slice(0, targetPoolSize);

    return {
      items: fallbackItems,
      source: 'mongodb-fallback',
      engine: contentType === 'users' ? 'mongodb-user-rules-v1' : 'mongodb-rules-v1'
    };
  })().finally(() => {
    inFlightGenerations.delete(flightKey);
  });

  inFlightGenerations.set(flightKey, generationPromise);
  return generationPromise;
};

export const scheduleUserCacheInvalidation = (
  userId,
  types = ['users', 'posts', 'reels'],
  options = {}
) => {
  if (!userId) return;
  clearUserShuffleSession(userId, types);
  invalidateUserRecommendations(userId, types, options).catch(() => {});
};
