const { findDesks } = require('../services/deskService');
const { attachPresence } = require('../presence');

// Minimum interval between client-requested snapshots, so a misbehaving client can't hammer the DB.
const REFRESH_COOLDOWN_MS = 1000;

function setupOfficeSocket(io) {
  io.on('connection', (socket) => {
    let lastSnapshotAt = 0;

    const sendSnapshot = async () => {
      const now = Date.now();
      if (now - lastSnapshotAt < REFRESH_COOLDOWN_MS) return;
      lastSnapshotAt = now;

      try {
        socket.emit('office:snapshot', await findDesks());
      } catch (err) {
        console.error('[Socket.IO] Failed to send desk snapshot:', err.message);
      }
    };

    sendSnapshot();
    socket.on('desk:request_refresh', sendSnapshot);
    attachPresence(socket);
  });
}

module.exports = setupOfficeSocket;
