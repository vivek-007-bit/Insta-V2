import api from './api';

export const recommendationService = {
  // Fetch personalized user recommendations (Node.js -> Cache / Django ML / MongoDB fallback)
  getRecommendedUsers: async (page = 1, limit = 10, refresh = false) => {
    return await api.get('/recommendations/users', {
      params: { page, limit, ...(refresh ? { refresh: true } : {}) }
    });
  },

  // Fetch personalized post recommendations (Node.js -> Cache / Django ML / MongoDB fallback)
  getRecommendedPosts: async (page = 1, limit = 15, refresh = false) => {
    return await api.get('/recommendations/posts', {
      params: { page, limit, ...(refresh ? { refresh: true } : {}) }
    });
  },

  // Fetch personalized Reel recommendations (Node.js -> Cache / Django ML / MongoDB fallback)
  getRecommendedReels: async (page = 1, limit = 8, refresh = false) => {
    return await api.get('/recommendations/reels', {
      params: { page, limit, ...(refresh ? { refresh: true } : {}) }
    });
  },

  // Record watch duration / completion event for ML feedback
  recordEvent: async ({
    contentType = 'reel',
    contentId,
    eventType = 'watch',
    watchDurationSec = 0,
    completionRate = 0
  }) => {
    if (!contentId) return null;
    try {
      return await api.post('/recommendations/events', {
        contentType,
        contentId,
        eventType,
        watchDurationSec,
        completionRate
      });
    } catch {
      // Telemetry failures must never disrupt playback or UI
      return null;
    }
  }
};

export default recommendationService;
