import api from './api';

export const followRequestService = {
  // Get incoming pending follow requests
  getIncomingRequests: async () => {
    return await api.get('/follow-requests');
  },

  // Get outgoing sent follow requests
  getSentRequests: async () => {
    return await api.get('/follow-requests/sent');
  },

  // Accept incoming follow request
  acceptRequest: async (requestId) => {
    return await api.post(`/follow-requests/${encodeURIComponent(requestId)}/accept`);
  },

  // Reject incoming follow request
  rejectRequest: async (requestId) => {
    return await api.post(`/follow-requests/${encodeURIComponent(requestId)}/reject`);
  },

  // Cancel outgoing follow request
  cancelRequest: async (requestId) => {
    return await api.delete(`/follow-requests/${encodeURIComponent(requestId)}`);
  }
};

export default followRequestService;
