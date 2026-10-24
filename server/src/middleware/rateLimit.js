const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
};

// Brute-force protection for credential endpoints.
const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 30,
  message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

// Generous ceiling for the rest of the API to absorb abuse without affecting normal use.
const apiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT) || 600,
});

module.exports = { authLimiter, apiLimiter };
