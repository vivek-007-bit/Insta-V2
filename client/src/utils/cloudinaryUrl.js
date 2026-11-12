/**
 * Normalizes and optimizes Cloudinary delivery URLs with HTTPS, f_auto, q_auto,
 * and optional responsive sizing without breaking non-Cloudinary URLs.
 */
export function optimizeMediaUrl(url, { width = null, crop = 'limit', isAvatar = false } = {}) {
  if (!url || typeof url !== 'string') return '';

  // Leave blob/data URLs untouched
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  let secureUrl = url.trim();
  if (secureUrl.startsWith('http://res.cloudinary.com/')) {
    secureUrl = secureUrl.replace('http://', 'https://');
  }

  if (!secureUrl.includes('res.cloudinary.com/')) {
    return secureUrl;
  }

  const transforms = ['f_auto', 'q_auto'];
  if (width) {
    transforms.push(`w_${width}`, `c_${isAvatar ? 'fill' : crop}`);
    if (isAvatar) transforms.push('g_face');
  }
  const transformStr = transforms.join(',');

  // Inject into /image/upload/ or /video/upload/ if not already transformed
  if (secureUrl.includes('/image/upload/') && !secureUrl.includes('/image/upload/f_auto')) {
    return secureUrl.replace('/image/upload/', `/image/upload/${transformStr}/`);
  }
  if (secureUrl.includes('/video/upload/') && !secureUrl.includes('/video/upload/f_auto')) {
    return secureUrl.replace('/video/upload/', '/video/upload/f_auto,q_auto/');
  }

  return secureUrl;
}

export function isVideoMedia(url, mediaType) {
  if (mediaType === 'video') return true;
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogg)$/.test(clean) || url.includes('/video/upload/');
}

export function getAvatarFallbackUrl(username = 'user') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=262626&color=ffffff&size=150`;
}

export default {
  optimizeMediaUrl,
  isVideoMedia,
  getAvatarFallbackUrl
};
