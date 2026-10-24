const config = require('./config/env');
const WorkSession = require('./models/WorkSession');
const { userFromToken } = require('./middleware/auth');

/**
 * Tracks which employees currently have V-Office open (in any tab), so the office can show
 * "Away" when someone closes the app and idle sessions can be checked out automatically.
 *
 * A user stays "online" for a short grace period after their last tab disconnects, so page
 * refreshes and brief network drops don't flicker their status. State is per process; running
 * several instances requires a shared store (e.g. the Socket.IO Redis adapter).
 */
// Sockets of signed-in users join this room, so private data (e.g. meetings) is only sent to them.
const AUTH_ROOM = 'authenticated';
const socketsByUser = new Map(); // userId -> Set<socketId>
const offlineHandlers = [];

// Lets other modules react when a user has closed V-Office everywhere (e.g. leave meetings).
const onUserOffline = (handler) => offlineHandlers.push(handler);
const offlineTimers = new Map(); // userId -> Timeout
const IDENTIFY_MAX = 5;
const IDENTIFY_WINDOW_MS = 10 * 1000;
let io = null;

const setPresenceIO = (instance) => {
  io = instance;
};

const isOnline = (userId) => socketsByUser.has(String(userId));
const onlineUserIds = () => [...socketsByUser.keys()];

function broadcast(userId, online) {
  if (io) io.emit('presence:update', { employeeId: userId, online });
}

function markOnline(userId, socket) {
  const id = String(userId);
  const pendingOffline = offlineTimers.get(id);
  if (pendingOffline) {
    clearTimeout(pendingOffline);
    offlineTimers.delete(id);
  }

  let sockets = socketsByUser.get(id);
  const wasOnline = Boolean(sockets);
  if (!sockets) {
    sockets = new Set();
    socketsByUser.set(id, sockets);
  }
  sockets.add(socket.id);
  socket.data.userId = id;
  socket.join(AUTH_ROOM);

  if (!wasOnline) broadcast(id, true);
}

function goOffline(userId, leftAt) {
  socketsByUser.delete(userId);
  offlineTimers.delete(userId);
  broadcast(userId, false);
  // Remember when they actually left: an automatic check-out ends the session at this time.
  WorkSession.updateOne({ employeeId: userId, status: 'working' }, { lastSeenAt: leftAt }).catch((err) =>
    console.error('[Presence] Failed to record last seen:', err.message)
  );
  offlineHandlers.forEach((handler) =>
    Promise.resolve(handler(userId, leftAt)).catch((err) => console.error('[Presence] Offline handler failed:', err.message))
  );
}

function release(socket, { immediate = false } = {}) {
  const id = socket.data.userId;
  if (!id) return;
  delete socket.data.userId;
  socket.leave(AUTH_ROOM);

  const sockets = socketsByUser.get(id);
  if (!sockets) return;
  sockets.delete(socket.id);
  if (sockets.size > 0) return; // still open in another tab

  const leftAt = new Date();
  if (immediate || config.presenceGraceSeconds === 0) {
    goOffline(id, leftAt);
    return;
  }

  const timer = setTimeout(() => {
    if (socketsByUser.get(id)?.size === 0) goOffline(id, leftAt);
  }, config.presenceGraceSeconds * 1000);
  timer.unref();
  offlineTimers.set(id, timer);
}

function attachPresence(socket) {
  socket.emit('presence:snapshot', onlineUserIds());

  // The client identifies with its login token after connecting (and again after reconnects).
  // The token is fully verified (signature, expiry, revocation, user still exists) before the socket
  // may join the signed-in room. Attempts are throttled per socket.
  let attempts = [];
  socket.on('presence:identify', async (token) => {
    if (typeof token !== 'string' || token.length > 2048) return;
    const now = Date.now();
    attempts = attempts.filter((t) => now - t < IDENTIFY_WINDOW_MS);
    if (attempts.length >= IDENTIFY_MAX) return;
    attempts.push(now);

    let user;
    try {
      user = await userFromToken(token);
    } catch (err) {
      console.error('[Presence] Token check failed:', err.message);
      return;
    }
    if (!socket.connected) return;
    if (!user) {
      if (socket.data.userId) release(socket, { immediate: true });
      socket.emit('presence:rejected');
      return;
    }
    const id = String(user._id);
    if (socket.data.userId && socket.data.userId !== id) release(socket, { immediate: true });
    if (socket.data.userId !== id) markOnline(id, socket);
  });

  // Explicit sign-out: no grace period.
  socket.on('presence:leave', () => release(socket, { immediate: true }));
  socket.on('disconnect', () => release(socket));
}

// Immediately removes every socket of a user from the signed-in room (account deleted or password
// changed). Their clients are told to re-authenticate; a still-valid token simply identifies again.
function revokeUserSockets(userId) {
  const id = String(userId);
  const sockets = socketsByUser.get(id);
  if (!io || !sockets) return;
  for (const socketId of [...sockets]) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    release(socket, { immediate: true });
    socket.emit('presence:rejected');
  }
}

module.exports = { setPresenceIO, attachPresence, isOnline, onlineUserIds, onUserOffline, revokeUserSockets, AUTH_ROOM };
