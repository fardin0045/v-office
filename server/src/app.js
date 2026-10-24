const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const config = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Allowed: same-origin / non-browser requests, configured CLIENT_URL origins, and any localhost port in development.
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.clientOrigins.includes(origin)) return true;
  return !config.isProduction && LOCALHOST_RE.test(origin);
}

const corsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // blob: is required by the 3D text renderer, which spins up a Web Worker from generated code.
          'script-src': ["'self'", 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          // Three.js text rendering uses blob workers; the realtime socket uses ws(s).
          'worker-src': ["'self'", 'blob:'],
          'connect-src': ["'self'", 'ws:', 'wss:', 'https:', 'data:', 'blob:'],
          // HSTS handles HTTPS upgrades; this directive would break plain-HTTP intranet deployments.
          'upgrade-insecure-requests': null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(compression());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));

  if (!config.isProduction) {
    app.use('/api', (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
      next();
    });
  }

  app.get('/api/health', (_req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? 'online' : 'degraded',
      database: dbConnected ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/desks', require('./routes/deskRoutes'));
  app.use('/api/work', require('./routes/workRoutes'));
  app.use('/api/employees', require('./routes/employeeRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api/meetings', require('./routes/meetingRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/chat', require('./routes/chatRoutes'));
  app.use('/api', notFound);

  // Single-service deployment: serve the built React app and let the client router handle deep links.
  const indexHtml = path.join(config.clientDistPath, 'index.html');
  if (config.serveClient && fs.existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(path.join(config.clientDistPath, 'assets'), { immutable: true, maxAge: '1y', index: false })
    );
    app.use(express.static(config.clientDistPath, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
    console.log(`[App] Serving client build from ${config.clientDistPath}`);
  } else if (config.serveClient) {
    console.warn('[App] SERVE_CLIENT is enabled but no client build was found. Run `npm run build` first.');
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp, isAllowedOrigin };
