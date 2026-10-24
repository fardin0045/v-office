const { findDesks } = require('./services/deskService');

// Holds the Socket.IO server so routes and services can broadcast without reaching into `req.app`.
let io = null;

const setIO = (instance) => {
  io = instance;
};

// Broadcasts the fresh, fully populated state of the given desks. Never throws: a failed
// broadcast must not fail the HTTP request that triggered it.
async function emitDeskUpdates(deskIds) {
  const ids = [...new Set((deskIds || []).filter(Boolean))];
  if (!io || ids.length === 0) return;

  try {
    const desks = await findDesks({ deskId: { $in: ids } });
    desks.forEach((desk) => io.emit('desk:update', desk));
  } catch (err) {
    console.error('[Realtime] Failed to broadcast desk updates:', err.message);
  }
}

// Check-in/out events carry names and work details, so only signed-in users receive them.
// (Anonymous office viewers still see desks change through `desk:update`.)
function emitStatusChange(payload) {
  if (io) io.to('authenticated').emit('employee:status_change', payload);
}

// Events with private details are delivered only to signed-in sockets.
function emitToSignedIn(event, payload) {
  if (io) io.to('authenticated').emit(event, payload);
}

module.exports = { setIO, emitDeskUpdates, emitStatusChange, emitToSignedIn };
