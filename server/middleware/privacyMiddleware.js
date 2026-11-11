import User from '../models/User.js';
import Follow from '../models/Follow.js';

/**
 * Checks if a viewer has permission to view a target user's posts, stories, and details.
 * - If viewer is target user (owner): true
 * - If target user is public (!isPrivate): true
 * - If target user is private: true ONLY if viewer is an approved follower
 */
export const canViewUserContent = async (viewerId, targetUserId) => {
  if (!targetUserId) return false;

  // Owner always has access
  if (viewerId && viewerId.toString() === targetUserId.toString()) {
    return true;
  }

  const targetUser = await User.findById(targetUserId).select('isPrivate');
  if (!targetUser) {
    return false;
  }

  // Public accounts are viewable by anyone
  if (!targetUser.isPrivate) {
    return true;
  }

  // For private accounts, viewer must be authenticated and actively following
  if (!viewerId) {
    return false;
  }

  const isFollower = await Follow.exists({
    follower: viewerId,
    following: targetUserId
  });

  return Boolean(isFollower);
};

export default {
  canViewUserContent
};
