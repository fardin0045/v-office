const express = require('express');
const User = require('../models/User');
const Desk = require('../models/Desk');
const WorkSession = require('../models/WorkSession');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler, parsePagination, escapeRegex } = require('../utils/http');
const {
  parseTzOffset,
  localDateKey,
  startOfLocalDay,
  addDays,
  formatLocalDate,
  toMongoTimezone,
} = require('../utils/time');

const router = express.Router();
router.use(protect, adminOnly);

const TREND_DAYS = 14;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Seconds for a session inside an aggregation: stored duration, or elapsed time if still running.
const liveSecondsExpr = (now) => ({
  $cond: [
    { $eq: ['$status', 'working'] },
    { $divide: [{ $subtract: [now, '$checkIn'] }, 1000] },
    '$duration',
  ],
});

// @route   GET /api/admin/stats
// @desc    Headline KPIs for the admin overview
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfToday = startOfLocalDay(now, parseTzOffset(req.query.tzOffset));

    const [totalEmployees, totalDesks, lockedDesks, availableDesks, activeByMode, todayTotals] = await Promise.all([
      User.countDocuments({ role: 'employee' }),
      Desk.countDocuments(),
      Desk.countDocuments({ locked: true }),
      Desk.countDocuments({ locked: false, currentSessionId: null }),
      WorkSession.aggregate([{ $match: { status: 'working' } }, { $group: { _id: '$mode', count: { $sum: 1 } } }]),
      WorkSession.aggregate([
        { $match: { checkIn: { $gte: startOfToday } } },
        { $group: { _id: null, seconds: { $sum: liveSecondsExpr(now) } } },
      ]),
    ]);

    const officeWorking = activeByMode.find((m) => m._id === 'office')?.count || 0;
    const remoteWorking = activeByMode.find((m) => m._id === 'remote')?.count || 0;
    const totalSecondsToday = todayTotals[0]?.seconds || 0;

    res.json({
      totalEmployees,
      totalDesks,
      currentlyWorking: officeWorking + remoteWorking,
      officeWorking,
      remoteWorking,
      availableDesks,
      lockedDesks,
      totalHoursToday: (totalSecondsToday / 3600).toFixed(1),
    });
  })
);

// @route   GET /api/admin/analytics
// @desc    14-day attendance trend, department headcount and 30-day work-mode split
router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const tz = parseTzOffset(req.query.tzOffset);
    const now = new Date();
    const startOfToday = startOfLocalDay(now, tz);
    const rangeStart = addDays(startOfToday, -(TREND_DAYS - 1));
    const thirtyDaysAgo = addDays(startOfToday, -29);

    const [daily, departments, modes] = await Promise.all([
      WorkSession.aggregate([
        { $match: { checkIn: { $gte: rangeStart } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$checkIn', timezone: toMongoTimezone(tz) } },
              mode: '$mode',
            },
            count: { $sum: 1 },
            seconds: { $sum: liveSecondsExpr(now) },
          },
        },
      ]),
      User.aggregate([
        { $match: { role: 'employee' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      WorkSession.aggregate([
        { $match: { checkIn: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$mode', count: { $sum: 1 } } },
      ]),
    ]);

    const byDay = new Map();
    for (const row of daily) {
      const entry = byDay.get(row._id.day) || { office: 0, remote: 0, seconds: 0 };
      entry[row._id.mode] = (entry[row._id.mode] || 0) + row.count;
      entry.seconds += row.seconds;
      byDay.set(row._id.day, entry);
    }

    const trendData = Array.from({ length: TREND_DAYS }, (_, i) => {
      const day = addDays(rangeStart, i);
      const date = localDateKey(day, tz);
      const entry = byDay.get(date) || { office: 0, remote: 0, seconds: 0 };
      return {
        date,
        day: formatLocalDate(day, tz, { month: 'short', day: 'numeric' }),
        office: entry.office,
        remote: entry.remote,
        total: entry.office + entry.remote,
        hours: Number((entry.seconds / 3600).toFixed(1)),
      };
    });

    res.json({
      trendData,
      departmentBreakdown: departments.map((d) => ({ name: d._id || 'General', value: d.count })),
      modeBreakdown: [
        { name: 'Office Work', value: modes.find((m) => m._id === 'office')?.count || 0 },
        { name: 'Remote Work', value: modes.find((m) => m._id === 'remote')?.count || 0 },
      ],
    });
  })
);

// @route   GET /api/admin/sessions
// @desc    Company-wide paginated session log (filters: q, mode, startDate, endDate)
router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15, maxLimit: 100 });
    const { mode, startDate, endDate } = req.query;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 50) : '';

    const query = {};
    if (['office', 'remote'].includes(mode)) query.mode = mode;
    if (DATE_KEY_RE.test(startDate || '') || DATE_KEY_RE.test(endDate || '')) {
      query.date = {};
      if (DATE_KEY_RE.test(startDate || '')) query.date.$gte = startDate;
      if (DATE_KEY_RE.test(endDate || '')) query.date.$lte = endDate;
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      const matchingUsers = await User.find({ $or: [{ name: regex }, { employeeId: regex }] })
        .select('_id')
        .limit(500)
        .lean();
      query.$or = [{ employeeId: { $in: matchingUsers.map((u) => u._id) } }, { deskId: regex }];
    }

    const [total, sessions] = await Promise.all([
      WorkSession.countDocuments(query),
      WorkSession.find(query)
        .populate('employeeId', 'name email employeeId avatar department')
        .sort({ checkIn: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({ sessions, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

module.exports = router;
