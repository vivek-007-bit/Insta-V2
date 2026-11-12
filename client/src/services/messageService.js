import api from './api';

export const messageService = {
  // Fetch authenticated user's direct message conversations
  getConversations: async () => {
    return await api.get('/messages/conversations');
  },

  // Create or retrieve a 1-to-1 conversation with another user
  createOrGetConversation: async ({ recipientId, username }) => {
    return await api.post('/messages/conversations', { recipientId, username });
  },

  // Fetch single conversation metadata
  getConversationById: async (conversationId) => {
    return await api.get(`/messages/conversations/${encodeURIComponent(conversationId)}`);
  },

  // Fetch paginated messages (newest batch first, returned chronologically)
  getMessages: async (conversationId, { limit = 25, before = null } = {}) => {
    const params = { limit };
    if (before) params.before = before;
    return await api.get(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
      params
    });
  },

  // Send a text-only message in a conversation
  sendMessage: async (conversationId, text) => {
    return await api.post(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
      text
    });
  },

  // Mark all received messages in a conversation as read
  markAsRead: async (conversationId) => {
    return await api.patch(`/messages/conversations/${encodeURIComponent(conversationId)}/read`);
  },

  // Delete a sent message
  deleteMessage: async (messageId) => {
    return await api.delete(`/messages/${encodeURIComponent(messageId)}`);
  }
};

export default messageService;
