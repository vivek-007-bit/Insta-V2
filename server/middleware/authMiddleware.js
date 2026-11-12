import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { getJwtSecret, clearTokenCookie } from '../utils/generateToken.js';

export const protect = async (req, res, next) => {
  let token = req.cookies?.token;

  // Also check Bearer header as fallback
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token.trim(), getJwtSecret());
  } catch (error) {
    clearTokenCookie(res, req);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token'
    });
  }

  if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
    clearTokenCookie(res, req);
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token'
    });
  }

  try {
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.isDisabled || user.isActive === false) {
      clearTokenCookie(res, req);
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists'
      });
    }

    req.user = user;
    next();
  } catch (dbError) {
    console.error('[Auth Middleware] Database lookup error:', dbError.message);
    next(dbError);
  }
};
