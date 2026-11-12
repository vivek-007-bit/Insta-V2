import User from '../models/User.js';
import Post from '../models/Post.js';
import Follow from '../models/Follow.js';
import { generateToken, clearTokenCookie } from '../utils/generateToken.js';

// Format user object with live database stats for frontend consumption
export const formatUserWithStats = async (user) => {
  const [postsCount, followersCount, followingCount] = await Promise.all([
    Post.countDocuments({ user: user._id }),
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id })
  ]);

  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio || '',
    website: user.website || '',
    isPrivate: Boolean(user.isPrivate),
    postsCount,
    followersCount,
    followingCount,
    isVerified: false,
    createdAt: user.createdAt
  };
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res, next) => {
  try {
    const { fullName, username, email, password } = req.body;

    // Validate inputs
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, username, email, and password'
      });
    }

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long'
      });
    }

    if (!/^[a-z0-9_.]+$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username can only contain letters, numbers, underscores, and periods'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check uniqueness
    const existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return res.status(400).json({
          success: false,
          message: "This username isn't available. Please choose another."
        });
      }
      if (existingUser.email === cleanEmail) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists.'
        });
      }
    }

    // Create user
    const user = await User.create({
      fullName: cleanFullName,
      username: cleanUsername,
      email: cleanEmail,
      password
    });

    // Generate JWT and set HTTP-only cookie
    generateToken(res, user._id, req);

    const userProfile = await formatUserWithStats(user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: userProfile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token in cookie
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username/email and password'
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // Find user by username OR email, including password field
    const user = await User.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Sorry, your username or password was incorrect. Please double-check your credentials.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Sorry, your username or password was incorrect. Please double-check your credentials.'
      });
    }

    // Generate JWT and set cookie
    generateToken(res, user._id, req);

    const userProfile = await formatUserWithStats(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, @${user.username}!`,
      user: userProfile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log out user & clear cookie
// @route   POST /api/auth/logout
// @access  Public
export const logout = async (req, res, next) => {
  try {
    clearTokenCookie(res, req);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    const userProfile = await formatUserWithStats(user);
    return res.status(200).json({
      success: true,
      user: userProfile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if a username is valid and available for signup
// @route   GET /api/auth/check-username?username=...
// @access  Public
export const checkUsernameAvailability = async (req, res, next) => {
  try {
    const raw = String(req.query.username || '').trim().toLowerCase();

    if (raw.length < 3) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Username must be at least 3 characters.'
      });
    }

    if (!/^[a-z0-9_.]+$/.test(raw)) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Only letters, numbers, periods, and underscores allowed.'
      });
    }

    const exists = await User.exists({ username: raw });
    return res.status(200).json({
      success: true,
      available: !exists,
      message: exists ? 'This username is already taken.' : 'Username is available.'
    });
  } catch (error) {
    next(error);
  }
};
