const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const config = require('./config/env');
const connectDB = require('./config/db');
const { createApp, isAllowedOrigin } = require('./app');
const setupOfficeSocket = require('./sockets/officeSocket');
const { setIO } = require('./realtime');
const { setPresenceIO } = require('./presence');
const Desk = require('./models/Desk');
const { startSessionSweeper, stopSessionSweeper } = require('./services/sessionSweeper');

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST'],
  },
});

setIO(io);
setPresenceIO(io);
setupOfficeSocket(io);

let shuttingDown = false;

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] ${signal} received, shutting down gracefully...`);

  // Force-exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 10000).unref();

  stopSessionSweeper();
  io.close();
  server.close(async () => {
    await mongoose.connection.close(false).catch(() => {});
    console.log('[Server] Closed cleanly.');
    process.exit(exitCode);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', reason);
});
// State may be corrupt after an uncaught exception: log it and exit so the host restarts a clean process.
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception, shutting down:', err);
  shutdown('uncaughtException', 1);
});

// One-off rename for databases seeded before desks 8–11 became the Business Team (no-op afterwards).
const renameBusinessZone = () =>
  Desk.updateMany({ zone: 'ZONE_B', zoneName: 'Guest Lounge Area' }, { zoneName: 'Business Team' }).catch((err) =>
    console.error('[Server] Zone rename failed:', err.message)
  );

connectDB()
  .then(() => {
    renameBusinessZone();
    startSessionSweeper();
    server.listen(config.port, () => {
      console.log('===============================================');
      console.log(`  V-Office server running on port ${config.port} (${config.env})`);
      console.log(`  Health check: http://localhost:${config.port}/api/health`);
      console.log('===============================================');
    });
  })
  .catch((err) => {
    console.error('Failed to start server due to database connection error:', err.message);
    process.exit(1);
  });
