import api from './api';

export const postService = {
  // Get feed posts (paginated)
  getFeedPosts: async (page = 1, limit = 20) => {
    return await api.get('/posts/feed', { params: { page, limit } });
  },

  // Get single post by ID
  getPostById: async (postId) => {
    return await api.get(`/posts/${encodeURIComponent(postId)}`);
  },

  // Get post share metadata (enforces privacy)
  getPostShareInfo: async (postId) => {
    return await api.get(`/posts/${encodeURIComponent(postId)}/share`);
  },

  // Like a post
  likePost: async (postId) => {
    return await api.post(`/posts/${encodeURIComponent(postId)}/like`);
  },

  // Unlike a post
  unlikePost: async (postId) => {
    return await api.delete(`/posts/${encodeURIComponent(postId)}/like`);
  },

  // Get post likes (paginated)
  getPostLikes: async (postId, page = 1, limit = 20) => {
    return await api.get(`/posts/${encodeURIComponent(postId)}/likes`, {
      params: { page, limit }
    });
  },

  // Add a comment to a post
  addComment: async (postId, text) => {
    return await api.post(`/posts/${encodeURIComponent(postId)}/comments`, { text });
  },

  // Get paginated comments for a post
  getComments: async (postId, page = 1, limit = 20) => {
    return await api.get(`/posts/${encodeURIComponent(postId)}/comments`, {
      params: { page, limit }
    });
  },

  // Delete a comment
  deleteComment: async (commentId) => {
    return await api.delete(`/comments/${encodeURIComponent(commentId)}`);
  }
};

export default postService;
