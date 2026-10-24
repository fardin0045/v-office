const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const { ApiError, asyncHandler } = require('../utils/http');

const JWT_ALGORITHM = 'HS256';

const signToken = (userId) =>
  jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn, algorithm: JWT_ALGORITHM });

// Verifies a token and loads its user. Returns null for any invalid, expired, revoked or orphaned token.
async function userFromToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  } catch {
    return null;
  }
  if (!decoded?.id) return null;
  const user = await User.findById(decoded.id).select('-password +passwordChangedAt').lean();
  if (!user || User.isTokenRevoked(user, decoded.iat)) return null;
  delete user.passwordChangedAt;
  return user;
}

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  } catch (error) {
    throw new ApiError(401, error.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Not authorized, token failed');
  }

  const user = await User.findById(decoded.id).select('-password +passwordChangedAt').lean();
  if (!user) {
    throw new ApiError(401, 'User not found or token invalid');
  }
  if (User.isTokenRevoked(user, decoded.iat)) {
    throw new ApiError(401, 'Your password was changed. Please sign in again.');
  }
  delete user.passwordChangedAt;

  req.user = user;
  next();
});

const adminOnly = (req, _res, next) => {
  if (req.user?.role === 'admin') return next();
  return next(new ApiError(403, 'Access denied: administrator privileges required'));
};

module.exports = { protect, adminOnly, signToken, userFromToken };
