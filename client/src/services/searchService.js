import api from './api';

const CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 100;
const searchCache = new Map();

const getCached = (key) => {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCached = (key, data) => {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) {
      searchCache.delete(oldestKey);
    }
  }
  searchCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
};

export const clearSearchCache = () => {
  searchCache.clear();
};

export const searchService = {
  clearCache: clearSearchCache,

  // Unified global search across users, hashtags, places, posts, and reels
  globalSearch: async (query = '', type = 'all', limit = 12, { signal, skipCache = false } = {}) => {
    const cleanQuery = String(query || '').trim();
    const cleanType = String(type || 'all').toLowerCase();
    const cacheKey = `global:${cleanType}:${limit}:${cleanQuery.toLowerCase()}`;

    if (!skipCache) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const res = await api.get('/search', {
      params: { q: cleanQuery, type: cleanType, limit },
      signal
    });
    setCached(cacheKey, res);
    return res;
  },

  // Paginated user search
  searchUsers: async (query = '', page = 1, limit = 20, { signal, skipCache = false } = {}) => {
    const cleanQuery = String(query || '').trim();
    const cacheKey = `users:${page}:${limit}:${cleanQuery.toLowerCase()}`;

    if (!skipCache) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const res = await api.get('/search/users', {
      params: { q: cleanQuery, page, limit },
      signal
    });
    setCached(cacheKey, res);
    return res;
  },

  // Hashtag search
  searchHashtags: async (query = '', limit = 20, { signal, skipCache = false } = {}) => {
    const cleanQuery = String(query || '').trim();
    const cacheKey = `hashtags:${limit}:${cleanQuery.toLowerCase()}`;

    if (!skipCache) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const res = await api.get('/search/hashtags', {
      params: { q: cleanQuery, limit },
      signal
    });
    setCached(cacheKey, res);
    return res;
  },

  // Posts search by query, hashtag, or location
  searchPosts: async ({ query = '', tag = '', location = '', page = 1, limit = 18 } = {}, { signal, skipCache = false } = {}) => {
    const cleanQuery = String(query || '').trim();
    const cleanTag = String(tag || '').replace(/^#/, '').trim();
    const cleanLocation = String(location || '').trim();
    const cacheKey = `posts:${page}:${limit}:${cleanQuery.toLowerCase()}:${cleanTag.toLowerCase()}:${cleanLocation.toLowerCase()}`;

    if (!skipCache) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const res = await api.get('/search/posts', {
      params: { q: cleanQuery, tag: cleanTag, location: cleanLocation, page, limit },
      signal
    });
    setCached(cacheKey, res);
    return res;
  },

  // Reels search by query or hashtag
  searchReels: async ({ query = '', tag = '', page = 1, limit = 12 } = {}, { signal, skipCache = false } = {}) => {
    const cleanQuery = String(query || '').trim();
    const cleanTag = String(tag || '').replace(/^#/, '').trim();
    const cacheKey = `reels:${page}:${limit}:${cleanQuery.toLowerCase()}:${cleanTag.toLowerCase()}`;

    if (!skipCache) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const res = await api.get('/search/reels', {
      params: { q: cleanQuery, tag: cleanTag, page, limit },
      signal
    });
    setCached(cacheKey, res);
    return res;
  },

  // Places search by location metadata
  searchPlaces: async (query = '', limit = 15, { signal, skipCache = false } = {}) => {
    const cleanQuery = String(query || '').trim();
    const cacheKey = `places:${limit}:${cleanQuery.toLowerCase()}`;

    if (!skipCache) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const res = await api.get('/search/places', {
      params: { q: cleanQuery, limit },
      signal
    });
    setCached(cacheKey, res);
    return res;
  },

  // Personalized suggested accounts
  getSuggestions: async (limit = 10, { signal } = {}) => {
    return await api.get('/search/suggestions', {
      params: { limit },
      signal
    });
  },

  // Persistent recent searches
  getRecentSearches: async ({ signal } = {}) => {
    return await api.get('/search/recent', { signal });
  },

  addRecentSearch: async (payload) => {
    return await api.post('/search/recent', payload);
  },

  deleteRecentSearch: async (id) => {
    return await api.delete(`/search/recent/${encodeURIComponent(id)}`);
  },

  clearRecentSearches: async () => {
    return await api.delete('/search/recent');
  }
};

export default searchService;
