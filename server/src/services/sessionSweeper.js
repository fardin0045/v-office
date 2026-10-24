const config = require('../config/env');
const WorkSession = require('../models/WorkSession');
const User = require('../models/User');
const { completeSession } = require('./sessionService');
const { onlineUserIds } = require('../presence');
const { emitDeskUpdates, emitStatusChange } = require('../realtime');

const SWEEP_INTERVAL_MS = (Number(process.env.SESSION_SWEEP_SECONDS) || 60) * 1000;
const MINUTE_MS = 60 * 1000;

let timer = null;
let running = false;

async function autoClose(session, checkOut, reason) {
  const { ended, deskId: releasedDeskId } = await completeSession(session, checkOut, reason);
  if (!ended) return; // someone checked out at the same moment
  await emitDeskUpdates([releasedDeskId || session.deskId]);
  const owner = await User.findById(session.employeeId).select('name').lean();
  emitStatusChange({
    sessionId: session._id,
    mode: session.mode,
    deskId: session.deskId,
    employeeId: session.employeeId,
    employeeName: owner?.name || 'An employee',
    status: 'available',
    reason,
    checkOut: session.checkOut,
    duration: session.duration,
  });
}

/**
 * 1. Refresh `lastSeenAt` for everyone who is online.
 * 2. Close sessions whose owner has been offline longer than AUTO_CHECKOUT_AFTER_MINUTES,
 *    ending them when the person left (so no phantom hours are logged).
 * 3. Close sessions longer than MAX_SESSION_HOURS, ending them at the cap.
 */
async function sweep() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const online = onlineUserIds();

    if (online.length) {
      await WorkSession.updateMany({ status: 'working', employeeId: { $in: online } }, { lastSeenAt: now });
    }

    if (config.autoCheckoutAfterMinutes > 0) {
      const cutoff = new Date(now.getTime() - config.autoCheckoutAfterMinutes * MINUTE_MS);
      const stale = await WorkSession.find({
        status: 'working',
        employeeId: { $nin: online },
        $or: [{ lastSeenAt: { $lt: cutoff } }, { lastSeenAt: null, checkIn: { $lt: cutoff } }],
      });
      for (const session of stale) {
        await autoClose(session, session.lastSeenAt || session.checkIn, 'auto-offline').catch((err) =>
          console.error(`[Sweeper] Could not close session ${session._id}:`, err.message)
        );
      }
    }

    if (config.maxSessionHours > 0) {
      const maxMs = config.maxSessionHours * 60 * MINUTE_MS;
      const tooLong = await WorkSession.find({ status: 'working', checkIn: { $lt: new Date(now.getTime() - maxMs) } });
      for (const session of tooLong) {
        await autoClose(session, new Date(new Date(session.checkIn).getTime() + maxMs), 'auto-max-duration').catch((err) =>
          console.error(`[Sweeper] Could not close session ${session._id}:`, err.message)
        );
      }
    }
  } catch (err) {
    console.error('[Sweeper] Automatic check-out pass failed:', err.message);
  } finally {
    running = false;
  }
}

function startSessionSweeper() {
  if (timer) return;
  timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  timer.unref();
}

function stopSessionSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startSessionSweeper, stopSessionSweeper, sweep };
