import api from './api';

export const userService = {
  // Search users
  searchUsers: async (query = '', limit = 20) => {
    return await api.get(`/users/search`, { params: { q: query, limit } });
  },

  // Get suggested users
  getSuggestedUsers: async (limit = 10) => {
    return await api.get(`/users/suggestions`, { params: { limit } });
  },

  // Get user profile by ID or username
  getUserProfile: async (userIdOrUsername) => {
    return await api.get(`/users/${encodeURIComponent(userIdOrUsername)}/profile`);
  },

  // Get user posts (paginated)
  getUserPosts: async (userId, page = 1, limit = 18) => {
    return await api.get(`/users/${encodeURIComponent(userId)}/posts`, {
      params: { page, limit }
    });
  },

  // Follow a user (public -> immediate, private -> pending request)
  followUser: async (userId) => {
    return await api.post(`/users/${encodeURIComponent(userId)}/follow`);
  },

  // Unfollow a user
  unfollowUser: async (userId) => {
    return await api.delete(`/users/${encodeURIComponent(userId)}/follow`);
  },

  // Get followers list (paginated)
  getFollowers: async (userId, page = 1, limit = 20) => {
    return await api.get(`/users/${encodeURIComponent(userId)}/followers`, {
      params: { page, limit }
    });
  },

  // Get following list (paginated)
  getFollowing: async (userId, page = 1, limit = 20) => {
    return await api.get(`/users/${encodeURIComponent(userId)}/following`, {
      params: { page, limit }
    });
  },

  // Get follow status
  getFollowStatus: async (userId) => {
    return await api.get(`/users/${encodeURIComponent(userId)}/follow-status`);
  },

  // Toggle account privacy (public / private)
  updatePrivacy: async (isPrivate) => {
    return await api.patch('/users/me/privacy', { isPrivate });
  },

  // Update profile details
  updateProfile: async (profileData) => {
    return await api.patch('/users/me/profile', profileData);
  }
};

export default userService;
