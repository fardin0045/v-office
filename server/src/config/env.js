const path = require('path');
const dotenv = require('dotenv');
const dns = require('node:dns');
// Load server/.env regardless of the working directory (root `npm run dev` runs from the repo root),
// then let a cwd-level .env or real environment variables fill anything that is still missing.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Optional: resolve DNS through specific servers (e.g. DNS_SERVERS=1.1.1.1,8.8.8.8) when the local resolver
// cannot look up MongoDB Atlas SRV records. Off by default, because overriding DNS globally breaks
// internal hostnames in Docker/Kubernetes (e.g. a `mongo` service name).
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const DEV_JWT_SECRET = 'voffice-development-only-secret-do-not-use-in-production';
const DEV_MONGO_URI = 'mongodb://127.0.0.1:27017/voffice';

function fail(message) {
  console.error(`[Config] ${message}`);
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET || (isProduction ? null : DEV_JWT_SECRET);
if (!jwtSecret) fail('JWT_SECRET must be set in production.');
if (isProduction && jwtSecret.length < 32) {
  console.warn('[Config] JWT_SECRET is shorter than 32 characters. Use a long random value in production.');
}

const mongoUri = process.env.MONGO_URI || (isProduction ? null : DEV_MONGO_URI);
if (!mongoUri) fail('MONGO_URI must be set in production.');

const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const parseBool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const nonNegative = (value, fallback) => {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const config = Object.freeze({
  env: NODE_ENV,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins,
  // In production the API also serves the built React app, so one service is enough to deploy.
  serveClient: parseBool(process.env.SERVE_CLIENT, isProduction),
  clientDistPath: path.resolve(__dirname, '../../../client/dist'),
  // Number of reverse proxies in front of the app (Render, Railway, Nginx...). Needed for correct client IPs.
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
  allowRegistration: parseBool(process.env.ALLOW_REGISTRATION, true),
  // Close a session automatically once its owner has had V-Office closed for this long (0 = never).
  autoCheckoutAfterMinutes: nonNegative(process.env.AUTO_CHECKOUT_AFTER_MINUTES, 15),
  // Hard cap on a single session, for people who forget to check out (0 = no cap).
  maxSessionHours: nonNegative(process.env.MAX_SESSION_HOURS, 12),
  // How long a disconnected browser may take to reconnect (page refresh, network blip) before "Away".
  presenceGraceSeconds: nonNegative(process.env.PRESENCE_GRACE_SECONDS, 20),
  autoStartLocalMongo: !isProduction && parseBool(process.env.AUTO_START_MONGO, true),
});

module.exports = config;
