// Recommendation Shuffle & Presentation Variety Service
// Implements Fisher-Yates shuffling, pool sizing, and duplicate-free pagination sessions in Node.js

const MAX_SESSION_ENTRIES = 2000;
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes session expiry

// Map<`${userId}:${contentType}`, SessionState>
// SessionState: { sequence: Array, displayedIds: Set, poolFingerprint: String, updatedAt: Number }
const activeShuffleSessions = new Map();

/**
 * Fisher-Yates shuffle implementation.
 * Always operates on a cloned array to guarantee zero mutation of shared cached data.
 */
export const fisherYatesShuffle = (array) => {
  if (!Array.isArray(array) || array.length <= 1) {
    return Array.isArray(array) ? [...array] : [];
  }
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
};

/**
 * Generate a lightweight fingerprint of candidate IDs to detect cache invalidation/regeneration.
 */
const getPoolFingerprint = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 'empty';
  const first = items[0]?.id || items[0]?._id || '';
  const last = items[items.length - 1]?.id || items[items.length - 1]?._id || '';
  return `${items.length}:${first}:${last}`;
};

/**
 * Clean up LRU or expired session states to keep memory bounded.
 */
const pruneOldSessions = () => {
  const now = Date.now();
  for (const [key, session] of activeShuffleSessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      activeShuffleSessions.delete(key);
    }
  }
  if (activeShuffleSessions.size > MAX_SESSION_ENTRIES) {
    const oldestKey = activeShuffleSessions.keys().next().value;
    if (oldestKey !== undefined) {
      activeShuffleSessions.delete(oldestKey);
    }
  }
};

/**
 * Get a shuffled, duplicate-free page of recommendations from the cached pool.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId - Authenticated viewer ID
 * @param {'users'|'posts'|'reels'} params.contentType - Pipeline type
 * @param {Array} params.allRecs - The full cached or fallback recommendation candidates
 * @param {number} params.page - 1-based page number
 * @param {number} params.limit - Number of items per page
 * @param {boolean} [params.refresh=false] - Whether to explicitly trigger a new shuffle
 * @returns {{ pageRecs: Array, totalItems: number, hasMore: boolean, isReshuffled: boolean }}
 */
export const getShuffledPageFromPool = ({
  userId,
  contentType,
  allRecs = [],
  page = 1,
  limit = 15,
  refresh = false
}) => {
  if (!Array.isArray(allRecs) || allRecs.length === 0) {
    return { pageRecs: [], totalItems: 0, hasMore: false, isReshuffled: false };
  }

  // 1. Deduplicate input candidates by ID, preserving relative score/reason metadata
  const seenIdSet = new Set();
  const uniqueCandidates = [];
  for (const item of allRecs) {
    const idStr = String(item?.id || item?._id || '');
    if (idStr && !seenIdSet.has(idStr)) {
      seenIdSet.add(idStr);
      uniqueCandidates.push({ ...item, id: idStr });
    }
  }

  const totalCandidates = uniqueCandidates.length;
  if (totalCandidates === 0) {
    return { pageRecs: [], totalItems: 0, hasMore: false, isReshuffled: false };
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, parseInt(limit, 10) || 15);
  const sessionKey = `${String(userId)}:${contentType}`;
  const currentFingerprint = getPoolFingerprint(uniqueCandidates);

  pruneOldSessions();

  let session = activeShuffleSessions.get(sessionKey);
  const isExpired = session && Date.now() - session.updatedAt > SESSION_TTL_MS;
  const poolChanged = session && session.poolFingerprint !== currentFingerprint;
  const isStartOfCycle = safePage === 1 || refresh || !session || isExpired || poolChanged;

  if (isStartOfCycle) {
    // Collect previously displayed IDs from previous browsing cycle (to deprioritize them)
    const prevDisplayed = session?.displayedIds instanceof Set ? session.displayedIds : new Set();

    let newSequence = [];
    if (totalCandidates > safeLimit && prevDisplayed.size > 0) {
      // Partition into fresh (unseen) items and previously seen items
      const freshItems = [];
      const seenItems = [];

      for (const item of uniqueCandidates) {
        if (prevDisplayed.has(item.id)) {
          seenItems.push(item);
        } else {
          freshItems.push(item);
        }
      }

      if (freshItems.length >= safeLimit) {
        // Sufficient fresh items exist: place freshly shuffled unseen items first
        newSequence = [
          ...fisherYatesShuffle(freshItems),
          ...fisherYatesShuffle(seenItems)
        ];
      } else {
        // Not enough purely fresh items: reshuffle the entire pool with remaining fresh items placed ahead
        newSequence = [
          ...fisherYatesShuffle(freshItems),
          ...fisherYatesShuffle(seenItems)
        ];
      }
    } else {
      // Fresh shuffle of the full candidate pool
      newSequence = fisherYatesShuffle(uniqueCandidates);
    }

    session = {
      sequence: newSequence,
      displayedIds: new Set(),
      poolFingerprint: currentFingerprint,
      updatedAt: Date.now()
    };
    activeShuffleSessions.set(sessionKey, session);
  } else {
    session.updatedAt = Date.now();
  }

  const skip = (safePage - 1) * safeLimit;

  // If pagination index exceeds current sequence length, safely refill sequence from reshuffled candidates
  if (skip >= session.sequence.length) {
    const refill = fisherYatesShuffle(uniqueCandidates);
    session.sequence = [...session.sequence, ...refill];
  }

  // Select slice for current page
  const pageRecs = session.sequence.slice(skip, skip + safeLimit);

  // Track displayed IDs in session
  for (const item of pageRecs) {
    session.displayedIds.add(item.id);
  }

  const hasMore = skip + pageRecs.length < session.sequence.length || totalCandidates > safeLimit;

  return {
    pageRecs,
    totalItems: totalCandidates,
    hasMore,
    isReshuffled: isStartOfCycle
  };
};

/**
 * Invalidate active shuffle session for a user when meaningful interactions occur.
 */
export const clearUserShuffleSession = (userId, types = ['users', 'posts', 'reels']) => {
  if (!userId) return;
  const uid = String(userId);
  for (const t of types) {
    activeShuffleSessions.delete(`${uid}:${t}`);
  }
};

/**
 * Reset all active shuffle sessions (used for test teardown).
 */
export const clearAllShuffleSessionsForTests = () => {
  activeShuffleSessions.clear();
};

export default {
  fisherYatesShuffle,
  getShuffledPageFromPool,
  clearUserShuffleSession,
  clearAllShuffleSessionsForTests
};
