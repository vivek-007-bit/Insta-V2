import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parses JWT_EXPIRES_IN (e.g. '7d', '24h', '30m', '3600s', or numeric seconds)
 * into milliseconds so cookie maxAge always matches JWT expiration.
 */
export const parseDurationToMs = (expiresIn) => {
  if (!expiresIn) return DEFAULT_EXPIRES_MS;
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
    return expiresIn * 1000;
  }
  const str = String(expiresIn).trim();
  const match = str.match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return DEFAULT_EXPIRES_MS;

  const value = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return value * (multipliers[unit] || 1000);
};

export const getJwtSecret = () =>
  process.env.JWT_SECRET || process.env.SECRET_KEY || 'default_jwt_secret_insta_v2';

/**
 * Builds consistent HTTP-only cookie options for development vs production
 * (supporting both same-site rewrites and cross-site Vercel deployments).
 */
export const getCookieOptions = (req = null) => {
  const isProduction = process.env.NODE_ENV === 'production';

  let sameSite = isProduction ? 'none' : 'lax';
  if (process.env.COOKIE_SAME_SITE) {
    sameSite = process.env.COOKIE_SAME_SITE.trim().toLowerCase();
  } else if (isProduction && req?.headers?.origin && req?.headers?.host) {
    try {
      const originHost = new URL(req.headers.origin).host;
      const serverHost = req.headers['x-forwarded-host'] || req.headers.host;
      if (originHost && serverHost && originHost === serverHost) {
        sameSite = 'lax';
      }
    } catch {
      // Keep default cross-site 'none'
    }
  }

  // Browsers reject SameSite=None without Secure=true; over HTTP localhost force lax/false
  const isSecure = isProduction || sameSite === 'none';

  const options = {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/'
  };

  if (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN.trim()) {
    options.domain = process.env.COOKIE_DOMAIN.trim();
  }

  return options;
};

export const generateToken = (res, userId, req = null) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const token = jwt.sign({ id: userId.toString() }, secret, {
    expiresIn
  });

  const maxAge = parseDurationToMs(expiresIn);

  res.cookie('token', token, {
    ...getCookieOptions(req),
    maxAge
  });

  return token;
};

export const clearTokenCookie = (res, req = null) => {
  const baseOptions = getCookieOptions(req);
  res.clearCookie('token', baseOptions);
};
