// All day-based reporting is done in the viewer's timezone. Clients send `tzOffset`
// (minutes, as returned by Date#getTimezoneOffset); the server's own offset is the fallback.

const MAX_OFFSET_MINUTES = 14 * 60;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function parseTzOffset(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || Math.abs(parsed) > MAX_OFFSET_MINUTES) {
    return new Date().getTimezoneOffset();
  }
  return parsed;
}

// Shift a UTC instant so its UTC fields read as the viewer's wall-clock time.
const toLocalShifted = (date, tzOffset) => new Date(date.getTime() - tzOffset * MINUTE_MS);

// YYYY-MM-DD in the viewer's timezone.
const localDateKey = (date, tzOffset) => toLocalShifted(date, tzOffset).toISOString().slice(0, 10);

// UTC instant of local midnight for the given date.
function startOfLocalDay(date, tzOffset) {
  const shifted = toLocalShifted(date, tzOffset);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() + tzOffset * MINUTE_MS);
}

function startOfLocalMonth(date, tzOffset) {
  const shifted = toLocalShifted(date, tzOffset);
  shifted.setUTCDate(1);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() + tzOffset * MINUTE_MS);
}

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

// Human label (e.g. "Mon", "Sep 23") for a date in the viewer's timezone.
const formatLocalDate = (date, tzOffset, options) =>
  toLocalShifted(date, tzOffset).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });

// Converts a getTimezoneOffset value to the "+HH:MM" form MongoDB date operators expect.
function toMongoTimezone(tzOffset) {
  const total = -tzOffset;
  const sign = total >= 0 ? '+' : '-';
  const abs = Math.abs(total);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

// Seconds worked by a session, counting live sessions up to `now`.
function sessionSeconds(session, now = Date.now()) {
  if (session.status === 'completed') return session.duration || 0;
  return Math.max(0, Math.round((now - new Date(session.checkIn).getTime()) / 1000));
}

const toHours = (seconds) => Number((seconds / 3600).toFixed(1));

module.exports = {
  parseTzOffset,
  localDateKey,
  startOfLocalDay,
  startOfLocalMonth,
  addDays,
  formatLocalDate,
  toMongoTimezone,
  sessionSeconds,
  toHours,
  DAY_MS,
};
