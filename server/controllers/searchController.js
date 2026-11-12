import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Reel from '../models/Reel.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import Like from '../models/Like.js';
import RecentSearch from '../models/RecentSearch.js';

const MAX_RECENT_SEARCHES = 20;

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSecureUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  return trimmed.startsWith('http://res.cloudinary.com')
    ? trimmed.replace('http://', 'https://')
    : trimmed;
};

// Resolve IDs of all users whose posts/reels/locations the viewer is authorized to inspect
const getVisibleAuthorIds = async (viewerId) => {
  const [publicUsers, follows] = await Promise.all([
    User.find({ isPrivate: { $ne: true } }).select('_id').lean(),
    Follow.find({ follower: viewerId }).select('following').lean()
  ]);

  const idSet = new Set([viewerId.toString()]);
  for (const u of publicUsers) idSet.add(u._id.toString());
  for (const f of follows) idSet.add(f.following.toString());

  return Array.from(idSet).map((id) => new mongoose.Types.ObjectId(id));
};

const enrichAccountsForViewer = async (viewerId, users) => {
  if (!users || users.length === 0) return [];
  const targetIds = users.map((u) => u._id);

  const [follows, pendingReqs] = await Promise.all([
    Follow.find({ follower: viewerId, following: { $in: targetIds } }).select('following').lean(),
    FollowRequest.find({
      requester: viewerId,
      recipient: { $in: targetIds },
      status: 'pending'
    })
      .select('recipient _id')
      .lean()
  ]);

  const followingSet = new Set(follows.map((f) => f.following.toString()));
  const pendingMap = new Map(pendingReqs.map((r) => [r.recipient.toString(), r._id.toString()]));

  return users.map((u) => {
    const uid = u._id.toString();
    return {
      id: uid,
      _id: uid,
      username: u.username,
      fullName: u.fullName || u.username,
      avatar: normalizeSecureUrl(u.avatar),
      isPrivate: Boolean(u.isPrivate),
      isFollowing: followingSet.has(uid),
      isPending: pendingMap.has(uid),
      requestId: pendingMap.get(uid) || null,
      isSelf: uid === viewerId.toString()
    };
  });
};

const queryMatchingUsers = async (viewerId, rawQuery, limit = 15, page = 1) => {
  const clean = rawQuery.replace(/^@+/, '').trim();
  if (!clean) return { users: [], total: 0, hasMore: false };

  const escaped = escapeRegex(clean);
  const filter = {
    $or: [
      { username: { $regex: escaped, $options: 'i' } },
      { fullName: { $regex: escaped, $options: 'i' } }
    ]
  };

  const skip = (page - 1) * limit;
  const [candidates, total] = await Promise.all([
    User.find(filter)
      .select('username fullName avatar isPrivate')
      .sort({ username: 1 })
      .limit(100)
      .lean(),
    User.countDocuments(filter)
  ]);

  // Rank exact & prefix matches before general substring matches
  const lower = clean.toLowerCase();
  candidates.sort((a, b) => {
    const au = (a.username || '').toLowerCase();
    const bu = (b.username || '').toLowerCase();
    const an = (a.fullName || '').toLowerCase();
    const bn = (b.fullName || '').toLowerCase();

    const score = (u, n) => {
      if (u === lower) return 0;
      if (u.startsWith(lower)) return 1;
      if (n.startsWith(lower)) return 2;
      if (u.includes(lower)) return 3;
      return 4;
    };
    return score(au, an) - score(bu, bn);
  });

  const sliced = candidates.slice(skip, skip + limit);
  const enriched = await enrichAccountsForViewer(viewerId, sliced);

  return {
    users: enriched,
    total,
    hasMore: skip + sliced.length < total
  };
};

const queryMatchingHashtags = async (visibleAuthorIds, rawQuery, limit = 15) => {
  const clean = rawQuery.replace(/^#+/, '').trim().toLowerCase();
  if (!clean) return [];

  const tagRegex = new RegExp(`#${escapeRegex(clean)}`, 'i');
  const [posts, reels] = await Promise.all([
    Post.find({ user: { $in: visibleAuthorIds }, caption: tagRegex })
      .select('caption')
      .limit(200)
      .lean(),
    Reel.find({ user: { $in: visibleAuthorIds }, caption: tagRegex })
      .select('caption')
      .limit(150)
      .lean()
  ]);

  const counts = new Map();
  const extractRegex = /#([a-zA-Z0-9_]+)/g;

  for (const item of [...posts, ...reels]) {
    if (!item.caption) continue;
    const seenInDoc = new Set();
    let match;
    extractRegex.lastIndex = 0;
    while ((match = extractRegex.exec(item.caption)) !== null) {
      const tag = match[1].toLowerCase();
      if (!tag.includes(clean) || seenInDoc.has(tag)) continue;
      seenInDoc.add(tag);
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, postsCount]) => ({ tag, postsCount }))
    .sort((a, b) => {
      const aExact = a.tag === clean ? 0 : a.tag.startsWith(clean) ? 1 : 2;
      const bExact = b.tag === clean ? 0 : b.tag.startsWith(clean) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      return b.postsCount - a.postsCount;
    })
    .slice(0, limit);
};

const queryMatchingPlaces = async (visibleAuthorIds, rawQuery, limit = 15) => {
  const clean = rawQuery.trim();
  if (!clean) return [];

  const locRegex = new RegExp(escapeRegex(clean), 'i');
  const agg = await Post.aggregate([
    {
      $match: {
        user: { $in: visibleAuthorIds },
        location: { $regex: locRegex }
      }
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$location',
        postsCount: { $sum: 1 },
        previewUrl: { $first: '$mediaUrl' }
      }
    },
    { $sort: { postsCount: -1 } },
    { $limit: limit }
  ]);

  return agg
    .filter((item) => item._id && String(item._id).trim().length > 0)
    .map((item) => ({
      name: item._id,
      postsCount: item.postsCount,
      previewUrl: normalizeSecureUrl(item.previewUrl)
    }));
};

const queryMatchingPosts = async (
  viewerId,
  visibleAuthorIds,
  { q = '', tag = '', location = '', page = 1, limit = 12 }
) => {
  const filter = { user: { $in: visibleAuthorIds } };

  if (tag) {
    const cleanTag = tag.replace(/^#+/, '').trim();
    if (!cleanTag) return { posts: [], total: 0, hasMore: false };
    filter.caption = { $regex: `(?:^|\\s)#${escapeRegex(cleanTag)}(?:\\b|$)`, $options: 'i' };
  } else if (location) {
    filter.location = { $regex: `^${escapeRegex(location.trim())}$`, $options: 'i' };
  } else if (q) {
    const escaped = escapeRegex(q.trim());
    filter.$or = [
      { caption: { $regex: escaped, $options: 'i' } },
      { location: { $regex: escaped, $options: 'i' } }
    ];
  } else {
    return { posts: [], total: 0, hasMore: false };
  }

  const skip = (page - 1) * limit;
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate('user', 'username fullName avatar isPrivate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Post.countDocuments(filter)
  ]);

  const validPosts = posts.filter((p) => p && p.user);
  const postIds = validPosts.map((p) => p._id);
  const userLikes =
    postIds.length > 0
      ? await Like.find({ user: viewerId, post: { $in: postIds } }).select('post').lean()
      : [];
  const likedSet = new Set(userLikes.map((l) => l.post.toString()));

  return {
    posts: validPosts.map((p) => {
      const pid = p._id.toString();
      return {
        id: pid,
        _id: pid,
        author: {
          id: p.user._id.toString(),
          username: p.user.username,
          fullName: p.user.fullName,
          avatar: normalizeSecureUrl(p.user.avatar),
          isPrivate: Boolean(p.user.isPrivate),
          isVerified: false
        },
        location: p.location || '',
        mediaUrl: normalizeSecureUrl(p.mediaUrl),
        publicId: p.publicId,
        mediaType: p.mediaType || 'image',
        mediaAspect: p.mediaAspect || 'square',
        caption: p.caption || '',
        likesCount: p.likesCount || 0,
        commentsCount: p.commentsCount || 0,
        isLiked: likedSet.has(pid),
        isSaved: false,
        comments: [],
        createdAt: p.createdAt
      };
    }),
    total,
    hasMore: skip + validPosts.length < total
  };
};

const queryMatchingReels = async (
  visibleAuthorIds,
  { q = '', tag = '', page = 1, limit = 10 }
) => {
  const filter = { user: { $in: visibleAuthorIds } };

  if (tag) {
    const cleanTag = tag.replace(/^#+/, '').trim();
    if (!cleanTag) return { reels: [], total: 0, hasMore: false };
    filter.caption = { $regex: `(?:^|\\s)#${escapeRegex(cleanTag)}(?:\\b|$)`, $options: 'i' };
  } else if (q) {
    const escaped = escapeRegex(q.trim());
    filter.$or = [
      { caption: { $regex: escaped, $options: 'i' } },
      { audioTrack: { $regex: escaped, $options: 'i' } }
    ];
  } else {
    return { reels: [], total: 0, hasMore: false };
  }

  const skip = (page - 1) * limit;
  const [reels, total] = await Promise.all([
    Reel.find(filter)
      .populate('user', 'username fullName avatar isPrivate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Reel.countDocuments(filter)
  ]);

  const validReels = reels.filter((r) => r && r.user);
  return {
    reels: validReels.map((r) => ({
      id: r._id.toString(),
      _id: r._id.toString(),
      author: {
        id: r.user._id.toString(),
        username: r.user.username,
        fullName: r.user.fullName,
        avatar: normalizeSecureUrl(r.user.avatar),
        isPrivate: Boolean(r.user.isPrivate)
      },
      videoUrl: normalizeSecureUrl(r.videoUrl),
      thumbnailUrl: normalizeSecureUrl(r.thumbnailUrl),
      posterUrl: normalizeSecureUrl(r.thumbnailUrl),
      caption: r.caption || '',
      audioTrack: r.audioTrack || '',
      likesCount: r.likesCount || 0,
      commentsCount: r.commentsCount || 0,
      createdAt: r.createdAt
    })),
    total,
    hasMore: skip + validReels.length < total
  };
};

// @desc    Unified Instagram-style search across accounts, hashtags, places, posts, reels
// @route   GET /api/search?q=query&type=all|top|accounts|tags|places
// @access  Private
export const globalSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const type = String(req.query.type || 'all').toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);

    if (!q) {
      return res.status(200).json({
        success: true,
        query: '',
        type,
        users: [],
        hashtags: [],
        places: [],
        posts: [],
        reels: []
      });
    }

    const visibleAuthorIds = await getVisibleAuthorIds(req.user._id);

    if (type === 'accounts' || type === 'users') {
      const userRes = await queryMatchingUsers(req.user._id, q, limit, 1);
      return res.status(200).json({
        success: true,
        query: q,
        type,
        users: userRes.users,
        hashtags: [],
        places: [],
        posts: [],
        reels: []
      });
    }

    if (type === 'tags' || type === 'hashtags') {
      const hashtags = await queryMatchingHashtags(visibleAuthorIds, q, limit);
      return res.status(200).json({
        success: true,
        query: q,
        type,
        users: [],
        hashtags,
        places: [],
        posts: [],
        reels: []
      });
    }

    if (type === 'places') {
      const places = await queryMatchingPlaces(visibleAuthorIds, q, limit);
      return res.status(200).json({
        success: true,
        query: q,
        type,
        users: [],
        hashtags: [],
        places,
        posts: [],
        reels: []
      });
    }

    const [userRes, hashtags, places, postRes, reelRes] = await Promise.all([
      queryMatchingUsers(req.user._id, q, Math.min(limit, 8), 1),
      queryMatchingHashtags(visibleAuthorIds, q, Math.min(limit, 6)),
      queryMatchingPlaces(visibleAuthorIds, q, Math.min(limit, 5)),
      queryMatchingPosts(req.user._id, visibleAuthorIds, { q, limit: Math.min(limit, 6) }),
      queryMatchingReels(visibleAuthorIds, { q, limit: Math.min(limit, 4) })
    ]);

    return res.status(200).json({
      success: true,
      query: q,
      type,
      users: userRes.users,
      hashtags,
      places,
      posts: postRes.posts,
      reels: reelRes.reels
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search user accounts
// @route   GET /api/search/users?q=...&page=1&limit=20
// @access  Private
export const searchUsersEndpoint = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 30);

    const result = await queryMatchingUsers(req.user._id, q, limit, page);
    return res.status(200).json({
      success: true,
      users: result.users,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search hashtags with post/reel counts (privacy-aware)
// @route   GET /api/search/hashtags?q=...&limit=20
// @access  Private
export const searchHashtagsEndpoint = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 30);
    const visibleAuthorIds = await getVisibleAuthorIds(req.user._id);
    const hashtags = await queryMatchingHashtags(visibleAuthorIds, q, limit);

    return res.status(200).json({
      success: true,
      hashtags
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search posts by caption, hashtag, or location (privacy-aware)
// @route   GET /api/search/posts?q=...&tag=...&location=...&page=1&limit=18
// @access  Private
export const searchPostsEndpoint = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const tag = String(req.query.tag || '').trim().slice(0, 80);
    const location = String(req.query.location || '').trim().slice(0, 120);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 18, 1), 36);

    const visibleAuthorIds = await getVisibleAuthorIds(req.user._id);
    const result = await queryMatchingPosts(req.user._id, visibleAuthorIds, {
      q,
      tag,
      location,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      posts: result.posts,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search Reels by caption, audioTrack, or hashtag (privacy-aware)
// @route   GET /api/search/reels?q=...&tag=...&page=1&limit=12
// @access  Private
export const searchReelsEndpoint = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const tag = String(req.query.tag || '').trim().slice(0, 80);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);

    const visibleAuthorIds = await getVisibleAuthorIds(req.user._id);
    const result = await queryMatchingReels(visibleAuthorIds, { q, tag, page, limit });

    return res.status(200).json({
      success: true,
      reels: result.reels,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search locations/places from visible posts
// @route   GET /api/search/places?q=...&limit=15
// @access  Private
export const searchPlacesEndpoint = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 30);
    const visibleAuthorIds = await getVisibleAuthorIds(req.user._id);
    const places = await queryMatchingPlaces(visibleAuthorIds, q, limit);

    return res.status(200).json({
      success: true,
      places
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suggested accounts (friends-of-friends + popularity, excluding self)
// @route   GET /api/search/suggestions?limit=10
// @access  Private
export const getSearchSuggestions = async (req, res, next) => {
  try {
    const viewerId = req.user._id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);

    const [myFollows, myPending] = await Promise.all([
      Follow.find({ follower: viewerId }).select('following').lean(),
      FollowRequest.find({ requester: viewerId, status: 'pending' }).select('recipient').lean()
    ]);

    const myFollowingIds = myFollows.map((f) => f.following);
    const excludedIds = new Set([viewerId.toString()]);

    // Gather 2nd-degree connections (accounts followed by people I follow)
    const fofAgg =
      myFollowingIds.length > 0
        ? await Follow.aggregate([
            {
              $match: {
                follower: { $in: myFollowingIds },
                following: { $nin: [viewerId, ...myFollowingIds] }
              }
            },
            {
              $group: {
                _id: '$following',
                mutualCount: { $sum: 1 },
                sampleFollower: { $first: '$follower' }
              }
            },
            { $sort: { mutualCount: -1 } },
            { $limit: limit * 2 }
          ])
        : [];

    const fofMap = new Map(fofAgg.map((row) => [row._id.toString(), row]));

    // Also pull popular accounts overall so new accounts always get rich suggestions
    const followerCountsAgg = await Follow.aggregate([
      { $match: { following: { $ne: viewerId } } },
      { $group: { _id: '$following', followersCount: { $sum: 1 } } },
      { $sort: { followersCount: -1 } },
      { $limit: limit * 3 }
    ]);
    const popMap = new Map(followerCountsAgg.map((r) => [r._id.toString(), r.followersCount]));

    const allCandidates = await User.find({ _id: { $ne: viewerId } })
      .select('username fullName avatar isPrivate createdAt')
      .limit(50)
      .lean();

    const followingSet = new Set(myFollowingIds.map((id) => id.toString()));
    const pendingSet = new Set(myPending.map((r) => r.recipient.toString()));

    allCandidates.sort((a, b) => {
      const aid = a._id.toString();
      const bid = b._id.toString();

      // Prioritize accounts user is NOT already following
      const aFollowed = followingSet.has(aid) ? 1 : 0;
      const bFollowed = followingSet.has(bid) ? 1 : 0;
      if (aFollowed !== bFollowed) return aFollowed - bFollowed;

      const aMutual = fofMap.get(aid)?.mutualCount || 0;
      const bMutual = fofMap.get(bid)?.mutualCount || 0;
      if (aMutual !== bMutual) return bMutual - aMutual;

      return (popMap.get(bid) || 0) - (popMap.get(aid) || 0);
    });

    const selected = allCandidates.filter((u) => !excludedIds.has(u._id.toString())).slice(0, limit);
    const enriched = await enrichAccountsForViewer(viewerId, selected);

    // Resolve one sample mutual follower username when available
    const sampleFollowerIds = Array.from(
      new Set(
        enriched
          .map((u) => fofMap.get(u.id)?.sampleFollower)
          .filter(Boolean)
          .map((id) => id.toString())
      )
    );
    const sampleFollowers =
      sampleFollowerIds.length > 0
        ? await User.find({ _id: { $in: sampleFollowerIds } }).select('username').lean()
        : [];
    const sampleNameMap = new Map(sampleFollowers.map((u) => [u._id.toString(), u.username]));

    const usersWithReason = enriched.map((u) => {
      const fofInfo = fofMap.get(u.id);
      let subtitle = u.fullName;
      if (fofInfo && sampleNameMap.has(fofInfo.sampleFollower.toString())) {
        const mutualName = sampleNameMap.get(fofInfo.sampleFollower.toString());
        subtitle =
          fofInfo.mutualCount > 1
            ? `Followed by ${mutualName} + ${fofInfo.mutualCount - 1} more`
            : `Followed by ${mutualName}`;
      } else if (pendingSet.has(u.id)) {
        subtitle = 'Follow request sent';
      } else if ((popMap.get(u.id) || 0) >= 5) {
        subtitle = 'Popular on Insta-V2';
      }
      return {
        ...u,
        subtitle
      };
    });

    return res.status(200).json({
      success: true,
      users: usersWithReason
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get authenticated user's persistent recent searches (max 20)
// @route   GET /api/search/recent
// @access  Private
export const getRecentSearches = async (req, res, next) => {
  try {
    const docs = await RecentSearch.find({ user: req.user._id })
      .populate('targetUser', 'username fullName avatar isPrivate')
      .sort({ searchedAt: -1 })
      .limit(MAX_RECENT_SEARCHES);

    const recent = docs
      .filter((doc) => doc.type !== 'user' || doc.targetUser)
      .map((doc) => ({
        id: doc._id.toString(),
        type: doc.type,
        query: doc.query,
        hashtag: doc.hashtag,
        location: doc.location,
        searchedAt: doc.searchedAt,
        targetUser: doc.targetUser
          ? {
              id: doc.targetUser._id.toString(),
              username: doc.targetUser.username,
              fullName: doc.targetUser.fullName,
              avatar: normalizeSecureUrl(doc.targetUser.avatar),
              isPrivate: Boolean(doc.targetUser.isPrivate)
            }
          : null
      }));

    return res.status(200).json({
      success: true,
      recent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save a recent search entry for authenticated user (deduplicated & capped at 20)
// @route   POST /api/search/recent
// @access  Private
export const addRecentSearch = async (req, res, next) => {
  try {
    const viewerId = req.user._id;
    const { type = 'query', targetUserId, query = '', hashtag = '', location = '' } = req.body || {};

    if (!['user', 'hashtag', 'place', 'query'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid search history type' });
    }

    let dedupeKey = '';
    let resolvedTargetUser = null;
    const cleanQuery = String(query || '').trim().slice(0, 120);
    const cleanHashtag = String(hashtag || '').replace(/^#+/, '').trim().toLowerCase().slice(0, 80);
    const cleanLocation = String(location || '').trim().slice(0, 120);

    if (type === 'user') {
      if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ success: false, message: 'Valid targetUserId is required' });
      }
      const targetUserDoc = await User.findById(targetUserId).select('username fullName avatar isPrivate');
      if (!targetUserDoc) {
        return res.status(404).json({ success: false, message: 'Target user not found' });
      }
      resolvedTargetUser = targetUserDoc._id;
      dedupeKey = `user:${resolvedTargetUser.toString()}`;
    } else if (type === 'hashtag') {
      if (!cleanHashtag) {
        return res.status(400).json({ success: false, message: 'Hashtag cannot be empty' });
      }
      dedupeKey = `hashtag:${cleanHashtag}`;
    } else if (type === 'place') {
      if (!cleanLocation) {
        return res.status(400).json({ success: false, message: 'Location cannot be empty' });
      }
      dedupeKey = `place:${cleanLocation.toLowerCase()}`;
    } else {
      if (!cleanQuery) {
        return res.status(400).json({ success: false, message: 'Search query cannot be empty' });
      }
      dedupeKey = `query:${cleanQuery.toLowerCase()}`;
    }

    const doc = await RecentSearch.findOneAndUpdate(
      { user: viewerId, dedupeKey },
      {
        $set: {
          type,
          query: cleanQuery || cleanHashtag || cleanLocation,
          targetUser: resolvedTargetUser,
          hashtag: cleanHashtag,
          location: cleanLocation,
          searchedAt: new Date()
        }
      },
      { upsert: true, new: true }
    ).populate('targetUser', 'username fullName avatar isPrivate');

    // Enforce max 20 entries per user
    const overflow = await RecentSearch.find({ user: viewerId })
      .sort({ searchedAt: -1 })
      .skip(MAX_RECENT_SEARCHES)
      .select('_id');
    if (overflow.length > 0) {
      await RecentSearch.deleteMany({ _id: { $in: overflow.map((d) => d._id) } });
    }

    return res.status(201).json({
      success: true,
      item: {
        id: doc._id.toString(),
        type: doc.type,
        query: doc.query,
        hashtag: doc.hashtag,
        location: doc.location,
        searchedAt: doc.searchedAt,
        targetUser: doc.targetUser
          ? {
              id: doc.targetUser._id.toString(),
              username: doc.targetUser.username,
              fullName: doc.targetUser.fullName,
              avatar: normalizeSecureUrl(doc.targetUser.avatar),
              isPrivate: Boolean(doc.targetUser.isPrivate)
            }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a single recent search owned by the authenticated user
// @route   DELETE /api/search/recent/:id
// @access  Private
export const deleteRecentSearchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid recent search ID' });
    }

    const deleted = await RecentSearch.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Recent search not found'
      });
    }

    return res.status(200).json({
      success: true,
      id: deleted._id.toString()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all recent searches for the authenticated user
// @route   DELETE /api/search/recent
// @access  Private
export const clearRecentSearches = async (req, res, next) => {
  try {
    await RecentSearch.deleteMany({ user: req.user._id });
    return res.status(200).json({
      success: true,
      message: 'Recent searches cleared'
    });
  } catch (error) {
    next(error);
  }
};
