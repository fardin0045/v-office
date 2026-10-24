const mongoose = require('mongoose');
const config = require('../config/env');

const notFound = (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    message = field ? `A record with this ${field} already exists` : 'Duplicate record';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON request body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  }

  if (status >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
    // Internal details are never leaked to clients in production.
    if (config.isProduction) message = 'Internal server error';
  }

  const body = { message };
  if (err.details) body.details = err.details;
  if (!config.isProduction && status >= 500) body.stack = err.stack;

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
