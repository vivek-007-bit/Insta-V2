import express from 'express';
import {
  searchUsers,
  getSuggestedUsers,
  updatePrivacy,
  updateMyProfile,
  getUserProfile,
  getUserPosts,
  getUserReels,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/search', protect, searchUsers);
router.get('/suggestions', protect, getSuggestedUsers);
router.patch('/me/privacy', protect, updatePrivacy);
router.patch('/me/profile', protect, updateMyProfile);
router.get('/:userId/profile', protect, getUserProfile);
router.get('/:userId/posts', protect, getUserPosts);
router.get('/:userId/reels', protect, getUserReels);
router.post('/:userId/follow', protect, followUser);
router.delete('/:userId/follow', protect, unfollowUser);
router.get('/:userId/followers', protect, getFollowers);
router.get('/:userId/following', protect, getFollowing);
router.get('/:userId/follow-status', protect, getFollowStatus);

export default router;
