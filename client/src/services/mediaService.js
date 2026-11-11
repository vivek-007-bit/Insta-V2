import axios from 'axios';
import api from './api';

export const mediaService = {
  // Request upload signature from server
  getUploadSignature: async ({ folder = 'insta_v2', resourceType = 'auto' } = {}) => {
    return await api.post('/media/signature', { folder, resourceType });
  },

  // Upload file directly to Cloudinary using signed upload parameters
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
      mediaType: resourceType,
      format: response.data.format,
      width: response.data.width,
      height: response.data.height
    };
  },

  // Save post metadata to backend database
  createPost: async (postData) => {
    return await api.post('/media/posts', postData);
  },

  // Save story metadata to backend database
  createStory: async (storyData) => {
    return await api.post('/media/stories', storyData);
  }
};

export default mediaService;
