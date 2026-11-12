import axios from 'axios';
import api from './api';

export const STORY_MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
export const STORY_MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_STORY_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_STORY_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];

export const storyService = {
  // Get signed Cloudinary upload parameters scoped to insta_v2/stories
  getUploadSignature: async ({ resourceType = 'auto', fileSize, mimeType } = {}) => {
    return await api.post('/stories/upload-signature', {
      resourceType,
      fileSize,
      mimeType
    });
  },

  // Upload image/video directly from browser to Cloudinary
  uploadToCloudinary: async (file, signatureData, onProgress) => {
    const { signature, timestamp, apiKey, cloudName, folder, uploadPreset } = signatureData;

    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

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

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const response = await axios.post(cloudinaryUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      }
    });

    return {
      mediaUrl: response.data.secure_url || response.data.url,
      publicId: response.data.public_id,
      mediaType: resourceType
    };
  },

  // Save uploaded story metadata in MongoDB
  createStory: async (storyData) => {
    return await api.post('/stories', storyData);
  },

  // Fetch active stories grouped by user for the Stories Bar
  getStoriesFeed: async () => {
    return await api.get('/stories/feed');
  },

  // Fetch single active story with backend privacy enforcement
  getStoryById: async (storyId) => {
    return await api.get(`/stories/${encodeURIComponent(storyId)}`);
  },

  // Record a unique view on an active story when opened
  recordStoryView: async (storyId) => {
    return await api.post(`/stories/${encodeURIComponent(storyId)}/view`);
  },

  // Fetch story viewers list (owner only)
  getStoryViewers: async (storyId) => {
    return await api.get(`/stories/${encodeURIComponent(storyId)}/viewers`);
  },

  // Delete an owned story
  deleteStory: async (storyId) => {
    return await api.delete(`/stories/${encodeURIComponent(storyId)}`);
  }
};

export default storyService;
