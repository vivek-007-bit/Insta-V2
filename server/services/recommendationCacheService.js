import { createClient } from 'redis';

const DEFAULT_TTL_SEC = Math.max(30, parseInt(process.env.RECOMMENDATION_CACHE_TTL_SEC || '300', 10) || 300);
const STALE_TTL_SEC = Math.max(DEFAULT_TTL_SEC * 6, 3600);
const MAX_MEMORY_ENTRIES = Math.max(50, parseInt(process.env.RECOMMENDATION_MEMORY_CACHE_MAX || '500', 10) || 500);
const INVALIDATION_COOLDOWN_MS = Math.max(0, parseInt(process.env.RECOMMENDATION_INVALIDATION_COOLDOWN_MS || '2000', 10) || 2000);

// Bounded LRU + TTL in-memory fallback caches (fresh + stale)
const memoryCache = new Map();
const staleMemoryCache = new Map();
const lastInvalidationAt = new Map();

let redisClient = null;
let redisReady = false;
let redisInitAttempted = false;

const buildKey = (userId, contentType, stale = false) =>
  `rec:v1:${stale ? 'stale:' : ''}${contentType}:${String(userId)}`;

const setBoundedMemory = (store, key, value, ttlSec) => {
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) {
      store.delete(oldestKey);
    }
  }
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000
  });
};

const getBoundedMemory = (store, key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // Refresh LRU order
  store.delete(key);
  store.set(key, entry);
  return entry.value;
};

export const initRedisCache = async () => {
  if (redisInitAttempted) return redisReady;
  redisInitAttempted = true;

  const redisUrl = (process.env.REDIS_URL || '').trim();
  if (!redisUrl) {
    return false;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 2500,
        reconnectStrategy: (retries) => {
          if (retries > 3) return false;
          return Math.min(retries * 300, 1500);
        }
      }
    });

    redisClient.on('ready', () => {
      redisReady = true;
      console.log('[Recommendation Cache] Connected to Redis');
    });

    redisClient.on('error', (err) => {
      redisReady = false;
      console.warn('[Recommendation Cache] Redis unavailable, using in-memory fallback:', err.message);
    });

    redisClient.on('end', () => {
      redisReady = false;
    });

    await redisClient.connect();
    return true;
  } catch (err) {
    redisReady = false;
    console.warn('[Recommendation Cache] Redis connection failed, falling back to memory:', err.message);
    return false;
  }
};

export const getCachedRecommendations = async (userId, contentType) => {
  const freshKey = buildKey(userId, contentType, false);

  if (redisClient && redisReady) {
    try {
      const raw = await redisClient.get(freshKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      redisReady = false;
    }
  }

  return getBoundedMemory(memoryCache, freshKey);
};

export const getStaleRecommendations = async (userId, contentType) => {
  const staleKey = buildKey(userId, contentType, true);

  if (redisClient && redisReady) {
    try {
      const raw = await redisClient.get(staleKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      redisReady = false;
    }
  }

  return getBoundedMemory(staleMemoryCache, staleKey);
};

export const setCachedRecommendations = async (
  userId,
  contentType,
  payload,
  ttlSec = DEFAULT_TTL_SEC
) => {
  const safeTtl = Math.max(1, Number(ttlSec) || DEFAULT_TTL_SEC);
  const freshKey = buildKey(userId, contentType, false);
  const staleKey = buildKey(userId, contentType, true);

  setBoundedMemory(memoryCache, freshKey, payload, safeTtl);
  setBoundedMemory(staleMemoryCache, staleKey, payload, Math.max(safeTtl * 6, STALE_TTL_SEC));

  if (redisClient && redisReady) {
    try {
      const serialized = JSON.stringify(payload);
      await Promise.all([
        redisClient.set(freshKey, serialized, { EX: safeTtl }),
        redisClient.set(staleKey, serialized, { EX: Math.max(safeTtl * 6, STALE_TTL_SEC) })
      ]);
    } catch {
      redisReady = false;
    }
  }
};

export const invalidateUserRecommendations = async (
  userId,
  types = ['users', 'posts', 'reels'],
  { force = false } = {}
) => {
  if (!userId) return false;
  const uid = String(userId);
  const now = Date.now();

  const effectiveTypes = types.filter((t) => {
    if (force || INVALIDATION_COOLDOWN_MS <= 0) return true;
    const cooldownKey = `${uid}:${t}`;
    const prev = lastInvalidationAt.get(cooldownKey) || 0;
    return now - prev >= INVALIDATION_COOLDOWN_MS;
  });

  if (effectiveTypes.length === 0) {
    return false;
  }

  for (const t of effectiveTypes) {
    lastInvalidationAt.set(`${uid}:${t}`, now);
  }

  const keysToDelete = effectiveTypes.map((t) => buildKey(uid, t, false));
  for (const k of keysToDelete) {
    memoryCache.delete(k);
  }

  if (redisClient && redisReady) {
    try {
      await redisClient.del(keysToDelete);
    } catch {
      redisReady = false;
    }
  }
  return true;
};

export const clearAllRecommendationCachesForTests = async () => {
  memoryCache.clear();
  staleMemoryCache.clear();
  lastInvalidationAt.clear();
};

export const getCacheStatus = () => ({
  backend: redisReady ? 'redis' : 'memory-fallback',
  redisConfigured: Boolean((process.env.REDIS_URL || '').trim()),
  redisConnected: redisReady,
  memoryEntries: memoryCache.size,
  staleEntries: staleMemoryCache.size,
  ttlSeconds: DEFAULT_TTL_SEC
});
