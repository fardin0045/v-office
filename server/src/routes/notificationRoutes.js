const express = require('express');
const WorkSession = require('../models/WorkSession');
const Meeting = require('../models/Meeting');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

const router = express.Router();
router.use(protect);

const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MEETING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 30;

// @route   GET /api/notifications
// @desc    The shared feed (team check-ins/outs from the last 24h; meetings, announcements and absence notes from the last 7 days)
//          plus when the signed-in user last opened it, so unread items survive reloads and sign-ins.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const since = new Date(now - ACTIVITY_WINDOW_MS);
    const [sessions, meetings, posts, me] = await Promise.all([
      WorkSession.find({ $or: [{ checkIn: { $gte: since } }, { checkOut: { $gte: since } }] })
        .sort({ updatedAt: -1 })
        .limit(LIMIT * 2)
        .populate('employeeId', 'name')
        .select('employeeId mode deskId checkIn checkOut status endReason')
        .lean(),
      Meeting.find({ cancelled: false, createdAt: { $gte: new Date(now - MEETING_WINDOW_MS) } })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .populate('createdBy', 'name')
        .select('title startsAt createdAt createdBy')
        .lean(),
      ChatMessage.find({
        kind: { $in: ['announcement', 'absence'] },
        deleted: false,
        createdAt: { $gte: new Date(now - MEETING_WINDOW_MS) },
      })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .populate('author', 'name')
        .select('kind text absenceDate author createdAt')
        .lean(),
      User.findById(req.user._id).select('notificationsReadAt').lean(),
    ]);

    const items = [];
    for (const s of sessions) {
      const base = {
        kind: 'presence',
        sessionId: s._id,
        employeeId: s.employeeId?._id,
        employeeName: s.employeeId?.name || 'Former employee',
        mode: s.mode,
        deskId: s.deskId,
      };
      if (s.checkIn >= since) items.push({ ...base, status: 'working', time: s.checkIn });
      if (s.checkOut && s.checkOut >= since) {
        items.push({ ...base, status: 'available', reason: s.endReason, time: s.checkOut });
      }
    }
    for (const m of meetings) {
      items.push({
        kind: 'meeting',
        meetingId: m._id,
        title: m.title,
        startsAt: m.startsAt,
        createdBy: m.createdBy?.name || '',
        time: m.createdAt,
      });
    }
    for (const post of posts) {
      items.push({
        kind: post.kind,
        messageId: post._id,
        text: post.text,
        absenceDate: post.absenceDate,
        authorName: post.author?.name || 'Former employee',
        time: post.createdAt,
      });
    }
    items.sort((a, b) => new Date(b.time) - new Date(a.time));
    res.json({ items: items.slice(0, LIMIT), readAt: me?.notificationsReadAt || null });
  })
);

// @route   POST /api/notifications/read
// @desc    Mark everything up to now as seen (called when the user opens the notification bell)
router.post(
  '/read',
  asyncHandler(async (req, res) => {
    const readAt = new Date();
    await User.updateOne({ _id: req.user._id }, { notificationsReadAt: readAt });
    res.json({ readAt });
  })
);

module.exports = router;
