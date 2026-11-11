import axios from 'axios';
import api from './api';

// Inject Cloudinary adaptive video delivery transformations (f_auto,q_auto)
export function getOptimizedVideoUrl(url) {
  if (!url || !url.includes('cloudinary.com') || !url.includes('/video/upload/')) {
    return url;
  }
  if (url.includes('/video/upload/f_auto') || url.includes('/video/upload/q_auto')) {
    return url;
  }
  return url.replace('/video/upload/', '/video/upload/f_auto,q_auto/');
}

export const reelService = {
  // Get signed upload parameters for Reel video
  getUploadSignature: async () => {
    return await api.post('/reels/upload-signature');
  },

  // Upload video directly from browser to Cloudinary
  uploadVideoToCloudinary: async (file, signatureData, onProgress) => {
    const { signature, timestamp, apiKey, cloudName, folder, uploadPreset } = signatureData;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    if (folder) {
      formData.append('folder', folder);
    }
    if (uploadPreset) {
      formData.append('upload_preset', uploadPreset);
    }

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

    const response = await axios.post(cloudinaryUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(pct);
        }
      }
    });

    return {
      videoUrl: response.data.secure_url || response.data.url,
      publicId: response.data.public_id,
      duration: response.data.duration || 0,
      width: response.data.width,
      height: response.data.height
    };
  },

  // Save Reel metadata in MongoDB
  createReel: async (reelData) => {
    return await api.post('/reels', reelData);
  },

  // Get paginated Reels feed
  getReels: async (page = 1, limit = 8, cursor = null) => {
    const params = { page, limit };
    if (cursor) params.cursor = cursor;
    return await api.get('/reels', { params });
  },

  // Get single Reel by ID
  getReelById: async (reelId) => {
    return await api.get(`/reels/${encodeURIComponent(reelId)}`);
  },

  // Delete Reel (owner only)
  deleteReel: async (reelId) => {
    return await api.delete(`/reels/${encodeURIComponent(reelId)}`);
  },

  // Like Reel
  likeReel: async (reelId) => {
    return await api.post(`/reels/${encodeURIComponent(reelId)}/like`);
  },

  // Unlike Reel
  unlikeReel: async (reelId) => {
    return await api.delete(`/reels/${encodeURIComponent(reelId)}/like`);
  },

  // Get paginated comments for Reel
  getComments: async (reelId, page = 1, limit = 20) => {
    return await api.get(`/reels/${encodeURIComponent(reelId)}/comments`, {
      params: { page, limit }
    });
  },

  // Add comment to Reel
  addComment: async (reelId, text) => {
    return await api.post(`/reels/${encodeURIComponent(reelId)}/comments`, { text });
  },

  // Delete Reel comment
  deleteComment: async (commentId) => {
    return await api.delete(`/reels/comments/${encodeURIComponent(commentId)}`);
  },

  // Get share metadata & stable URL (enforces privacy)
  getShareInfo: async (reelId) => {
    return await api.get(`/reels/${encodeURIComponent(reelId)}/share`);
  }
};

export default reelService;
