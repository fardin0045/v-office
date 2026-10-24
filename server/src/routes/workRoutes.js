const express = require('express');
const WorkSession = require('../models/WorkSession');
const Desk = require('../models/Desk');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { ApiError, asyncHandler, isValidObjectId, parsePagination, escapeRegex } = require('../utils/http');
const {
  parseTzOffset,
  localDateKey,
  startOfLocalDay,
  startOfLocalMonth,
  addDays,
  formatLocalDate,
  sessionSeconds,
} = require('../utils/time');
const { findDesk, requireDesk } = require('../services/deskService');
const { completeSession } = require('../services/sessionService');
const { emitDeskUpdates, emitStatusChange } = require('../realtime');

const router = express.Router();
router.use(protect);

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// @route   POST /api/work/start
// @desc    Start a work session (check-in)
router.post(
  '/start',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const mode = req.body.mode ?? 'office';
    if (!['office', 'remote'].includes(mode)) throw new ApiError(400, 'Invalid work mode');

    const existing = await WorkSession.exists({ employeeId: user._id, status: 'working' });
    if (existing) {
      throw new ApiError(409, 'You already have an active work session. Please end it before starting a new one.');
    }

    // Office sessions always happen at a desk. Remote sessions may optionally take a virtual desk,
    // so remote teammates are visible in the 3D office too.
    let desk = null;
    if (mode === 'office' || req.body.deskId) {
      desk = await requireDesk(req.body.deskId);

      if (desk.locked) throw new ApiError(403, 'This workstation is currently locked by an administrator');

      const isOwnDesk = user.assignedDesk === desk.deskId;
      if (user.role !== 'admin' && !isOwnDesk) {
        if (mode === 'office') {
          // In-office check-ins are restricted to the employee's own assigned chair.
          throw new ApiError(403, 'This workstation is assigned to another employee. Please use your assigned desk.');
        }
        // Remote workers may use any unassigned desk, but never someone else's assigned seat.
        if (desk.employeeId) {
          throw new ApiError(403, 'This desk is assigned to another employee. Choose your own desk or a free, unassigned one.');
        }
      }

      if (desk.currentSessionId) throw new ApiError(409, 'This workstation is currently occupied');
    }

    const now = new Date();
    let session;
    try {
      session = await WorkSession.create({
        employeeId: user._id,
        deskId: desk ? desk.deskId : null,
        mode,
        checkIn: now,
        lastSeenAt: now,
        status: 'working',
        date: localDateKey(now, parseTzOffset(req.body.tzOffset)),
      });
    } catch (err) {
      // The partial unique index rejects a second concurrent check-in for the same employee.
      if (err.code === 11000) throw new ApiError(409, 'You already have an active work session');
      throw err;
    }

    if (desk) {
      // Atomic claim: only succeeds if nobody else took the desk (or locked it) in the meantime.
      const claimed = await Desk.findOneAndUpdate(
        { _id: desk._id, locked: false, currentSessionId: null },
        { status: 'working', currentSessionId: session._id },
        { new: true }
      );
      if (!claimed) {
        await WorkSession.deleteOne({ _id: session._id });
        throw new ApiError(409, 'This workstation was just taken. Please refresh and try again.');
      }
      await emitDeskUpdates([desk.deskId]);
    }

    emitStatusChange({
      sessionId: session._id,
      employeeId: user._id,
      employeeName: user.name,
      status: 'working',
      mode,
      deskId: desk ? desk.deskId : null,
      checkIn: session.checkIn,
    });

    res.status(201).json({
      message: 'Work session started successfully',
      session,
      desk: desk ? await findDesk(desk.deskId) : null,
    });
  })
);

// @route   POST /api/work/end
// @desc    End a work session (check-out). Admins may end any employee's session by ID.
router.post(
  '/end',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { sessionId } = req.body;
    const query = { status: 'working' };

    if (sessionId) {
      if (!isValidObjectId(sessionId)) throw new ApiError(400, 'Invalid session ID');
      query._id = sessionId;
      if (user.role !== 'admin') query.employeeId = user._id;
    } else {
      query.employeeId = user._id;
    }

    const session = await WorkSession.findOne(query);
    if (!session) throw new ApiError(404, 'No active work session found to end');

    const isOwnSession = session.employeeId.equals(user._id);
    const { ended, deskId: releasedDeskId } = await completeSession(session, new Date(), isOwnSession ? 'manual' : 'admin');
    if (!ended) throw new ApiError(409, 'This work session has already ended');
    await emitDeskUpdates([releasedDeskId || session.deskId]);

    const owner = isOwnSession ? user : await User.findById(session.employeeId).select('name').lean();

    emitStatusChange({
      sessionId: session._id,
      employeeId: session.employeeId,
      employeeName: owner?.name || 'An employee',
      status: 'available',
      reason: session.endReason,
      mode: session.mode,
      deskId: session.deskId,
      checkOut: session.checkOut,
      duration: session.duration,
    });

    res.json({
      message: 'Work session ended successfully',
      session,
      desk: session.deskId ? await findDesk(session.deskId) : null,
    });
  })
);

// @route   GET /api/work/active
// @desc    The signed-in user's active session, if any
router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const activeSession = await WorkSession.findOne({ employeeId: req.user._id, status: 'working' }).lean();
    const desk = activeSession?.deskId ? await findDesk(activeSession.deskId) : null;
    res.json({ activeSession, desk });
  })
);

// @route   GET /api/work/history
// @desc    Paginated session history for the signed-in user (filters: mode, startDate, endDate, q)
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const { mode, startDate, endDate } = req.query;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 50) : '';

    const query = { employeeId: req.user._id };
    if (['office', 'remote'].includes(mode)) query.mode = mode;

    // `date` holds the local calendar day of the check-in, so plain string ranges are timezone-correct.
    if (DATE_KEY_RE.test(startDate || '') || DATE_KEY_RE.test(endDate || '')) {
      query.date = {};
      if (DATE_KEY_RE.test(startDate || '')) query.date.$gte = startDate;
      if (DATE_KEY_RE.test(endDate || '')) query.date.$lte = endDate;
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      query.$or = [{ deskId: regex }, { date: regex }];
      if ('remote'.includes(q.toLowerCase())) query.$or.push({ mode: 'remote' });
    }

    const [total, sessions] = await Promise.all([
      WorkSession.countDocuments(query),
      WorkSession.find(query).sort({ checkIn: -1 }).skip(skip).limit(limit).lean(),
    ]);

    res.json({ sessions, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

// @route   GET /api/work/stats
// @desc    Today / 7-day / month totals, 7-day chart and 30-day mode split for the signed-in user
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const tz = parseTzOffset(req.query.tzOffset);
    const now = new Date();
    const nowMs = now.getTime();

    const startOfToday = startOfLocalDay(now, tz);
    const startOfWeek = addDays(startOfToday, -6); // last 7 days, including today
    const startOfMonth = startOfLocalMonth(now, tz);
    const thirtyDaysAgo = addDays(startOfToday, -29);
    const windowStart = new Date(Math.min(startOfMonth.getTime(), thirtyDaysAgo.getTime()));

    // One query covers every window; the per-user result set is small.
    const sessions = await WorkSession.find({ employeeId: req.user._id, checkIn: { $gte: windowStart } })
      .select('checkIn status duration mode')
      .lean();

    let todaySeconds = 0;
    let weeklySeconds = 0;
    let monthlySeconds = 0;
    let officeCount = 0;
    let remoteCount = 0;
    const secondsByDay = new Map();

    for (const s of sessions) {
      const checkIn = new Date(s.checkIn);
      const seconds = sessionSeconds(s, nowMs);

      if (checkIn >= startOfToday) todaySeconds += seconds;
      if (checkIn >= startOfWeek) {
        weeklySeconds += seconds;
        const key = localDateKey(checkIn, tz);
        secondsByDay.set(key, (secondsByDay.get(key) || 0) + seconds);
      }
      if (checkIn >= startOfMonth) monthlySeconds += seconds;
      if (checkIn >= thirtyDaysAgo) {
        if (s.mode === 'office') officeCount += 1;
        else remoteCount += 1;
      }
    }

    const weeklyChartData = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(startOfWeek, i);
      const date = localDateKey(day, tz);
      return {
        day: formatLocalDate(day, tz, { weekday: 'short' }),
        date,
        hours: Number(((secondsByDay.get(date) || 0) / 3600).toFixed(1)),
      };
    });

    res.json({
      todayHours: (todaySeconds / 3600).toFixed(1),
      weeklyHours: (weeklySeconds / 3600).toFixed(1),
      monthlyHours: (monthlySeconds / 3600).toFixed(1),
      todaySeconds,
      weeklySeconds,
      monthlySeconds,
      officeCount,
      remoteCount,
      weeklyChartData,
    });
  })
);

module.exports = router;
