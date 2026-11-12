import express from 'express';
import {
  globalSearch,
  searchUsersEndpoint,
  searchHashtagsEndpoint,
  searchPostsEndpoint,
  searchReelsEndpoint,
  searchPlacesEndpoint,
  getSearchSuggestions,
  getRecentSearches,
  addRecentSearch,
  deleteRecentSearchById,
  clearRecentSearches
} from '../controllers/searchController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, globalSearch);
router.get('/users', protect, searchUsersEndpoint);
router.get('/hashtags', protect, searchHashtagsEndpoint);
router.get('/posts', protect, searchPostsEndpoint);
router.get('/reels', protect, searchReelsEndpoint);
router.get('/places', protect, searchPlacesEndpoint);
router.get('/suggestions', protect, getSearchSuggestions);
router.get('/recent', protect, getRecentSearches);
router.post('/recent', protect, addRecentSearch);
router.delete('/recent/:id', protect, deleteRecentSearchById);
router.delete('/recent', protect, clearRecentSearches);

export default router;
