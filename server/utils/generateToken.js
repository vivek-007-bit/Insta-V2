import jwt from 'jsonwebtoken';

export const generateToken = (res, userId) => {
  const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'default_jwt_secret_insta_v2';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const token = jwt.sign({ id: userId }, secret, {
    expiresIn
  });

  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  });

  return token;
};

export const clearTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    expires: new Date(0)
  });
};
