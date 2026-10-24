const mongoose = require('mongoose');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }
}

// Forwards rejected promises from async route handlers to the central error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isValidObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Clamps page/limit so a client can never request an unbounded result set.
function parsePagination(query, { defaultLimit = 10, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

const cleanString = (value, maxLength = 120) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPLOYEE_ID_RE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes; a sane upper bound also avoids hashing huge inputs.
const MAX_PASSWORD_LENGTH = 128;

// Returns a user-facing message if the password is unacceptable, otherwise null.
const passwordProblem = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  return null;
};

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

module.exports = {
  ApiError,
  asyncHandler,
  isValidObjectId,
  escapeRegex,
  parsePagination,
  cleanString,
  EMAIL_RE,
  EMPLOYEE_ID_RE,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  passwordProblem,
  isHttpUrl,
};
