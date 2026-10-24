const Desk = require('../models/Desk');
const WorkSession = require('../models/WorkSession');

/**
 * Closes a working session and releases its desk, atomically: if two callers race (e.g. the automatic
 * check-out sweeper and a manual check-out), exactly one wins and the other gets `{ ended: false }`.
 * `checkOut` may be in the past (an automatic check-out records when the employee left).
 * On success the passed `session` object is updated in place.
 * Returns `{ ended, deskId }` where `deskId` is the desk that was released (or null).
 */
async function completeSession(session, checkOut = new Date(), endReason = 'manual') {
  const checkInMs = new Date(session.checkIn).getTime();
  const end = new Date(Math.max(checkInMs, checkOut.getTime()));
  const duration = Math.max(0, Math.round((end.getTime() - checkInMs) / 1000));

  const updated = await WorkSession.findOneAndUpdate(
    { _id: session._id, status: 'working' },
    { checkOut: end, duration, status: 'completed', endReason },
    { new: true }
  ).lean();
  if (!updated) return { ended: false, deskId: null };

  session.checkOut = updated.checkOut;
  session.duration = updated.duration;
  session.status = updated.status;
  session.endReason = updated.endReason;

  if (!session.deskId) return { ended: true, deskId: null };

  // Release the desk only if it is still held by this session; keep it locked if an admin locked it.
  const desk = await Desk.findOneAndUpdate(
    { deskId: session.deskId, currentSessionId: session._id },
    [{ $set: { currentSessionId: null, status: { $cond: ['$locked', 'locked', 'available'] } } }],
    { new: true }
  ).lean();
  return { ended: true, deskId: desk ? desk.deskId : null };
}

module.exports = { completeSession };
