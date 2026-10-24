const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { ApiError, asyncHandler, isValidObjectId } = require('../utils/http');
const { emitToSignedIn } = require('../realtime');

const router = express.Router();
router.use(protect);

const KINDS = ['message', 'absence', 'announcement'];
const MAX_LENGTH = 2000;
const PAGE_SIZE = 40;
const PIN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const UNREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AUTHOR_FIELDS = 'name avatar title role employeeId';

// Simple per-user flood protection: at most RATE_MAX messages per RATE_WINDOW_MS.
// State is per process; running several instances would need a shared store.
const RATE_MAX = 8;
const RATE_WINDOW_MS = 10 * 1000;
const recentPosts = new Map(); // userId -> timestamps
function assertNotFlooding(userId) {
  const now = Date.now();
  const list = (recentPosts.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) throw new ApiError(429, 'You are sending messages too quickly. Please wait a moment.');
  list.push(now);
  recentPosts.set(userId, list);
}
// Drop idle entries so the map never grows with the number of people who ever posted.
setInterval(() => {
  const now = Date.now();
  for (const [userId, list] of recentPosts) {
    if (!list.some((t) => now - t < RATE_WINDOW_MS)) recentPosts.delete(userId);
  }
}, 60 * 1000).unref();

function serialize(m) {
  const a = m.author;
  const author =
    a && typeof a === 'object' && a.name
      ? { _id: a._id, name: a.name, avatar: a.avatar, title: a.title, role: a.role, employeeId: a.employeeId }
      : { _id: a, name: 'Former employee', avatar: '', title: '', role: 'employee' };
  return {
    _id: m._id,
    kind: m.kind,
    text: m.deleted ? '' : m.text,
    absenceDate: m.deleted ? null : m.absenceDate,
    deleted: m.deleted,
    createdAt: m.createdAt,
    author,
  };
}

// @route   GET /api/chat/messages?before=<ISO date>
// @desc    A page of the team chat (oldest first), the pinned announcement and when I last read it
router.get(
  '/messages',
  asyncHandler(async (req, res) => {
    const before = req.query.before ? new Date(req.query.before) : null;
    const query = before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {};

    const [page, pinned, me] = await Promise.all([
      ChatMessage.find(query).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1).populate('author', AUTHOR_FIELDS).lean(),
      ChatMessage.findOne({ kind: 'announcement', deleted: false, createdAt: { $gte: new Date(Date.now() - PIN_WINDOW_MS) } })
        .sort({ createdAt: -1 })
        .populate('author', AUTHOR_FIELDS)
        .lean(),
      User.findById(req.user._id).select('chatReadAt').lean(),
    ]);

    const hasMore = page.length > PAGE_SIZE;
    const messages = page.slice(0, PAGE_SIZE).reverse().map(serialize);
    res.json({ messages, hasMore, pinned: pinned ? serialize(pinned) : null, readAt: me?.chatReadAt || null });
  })
);

// @route   GET /api/chat/unread
// @desc    Messages from others since I last opened the chat (for the navbar badge)
router.get(
  '/unread',
  asyncHandler(async (req, res) => {
    const me = await User.findById(req.user._id).select('chatReadAt').lean();
    const since = me?.chatReadAt || new Date(Date.now() - UNREAD_WINDOW_MS);
    const count = await ChatMessage.countDocuments({ createdAt: { $gt: since }, author: { $ne: req.user._id }, deleted: false });
    res.json({ count, readAt: me?.chatReadAt || null });
  })
);

// @route   POST /api/chat/read
// @desc    Mark the chat as read up to now
router.post(
  '/read',
  asyncHandler(async (req, res) => {
    const readAt = new Date();
    await User.updateOne({ _id: req.user._id }, { chatReadAt: readAt });
    res.json({ readAt });
  })
);

// @route   POST /api/chat/messages
// @desc    Post to the team chat. Everyone can post messages and absence notes; only admins announce.
router.post(
  '/messages',
  asyncHandler(async (req, res) => {
    const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'message';
    const text = typeof req.body.text === 'string' ? req.body.text.replace(/\r\n/g, '\n').trim() : '';
    if (!text) throw new ApiError(400, 'Write a message first');
    if (text.length > MAX_LENGTH) throw new ApiError(400, `Messages can be at most ${MAX_LENGTH} characters`);
    if (kind === 'announcement' && req.user.role !== 'admin') throw new ApiError(403, 'Only admins can post announcements');

    let absenceDate = null;
    if (kind === 'absence') {
      absenceDate = typeof req.body.absenceDate === 'string' && DATE_RE.test(req.body.absenceDate) ? req.body.absenceDate : null;
      if (!absenceDate) throw new ApiError(400, 'Choose the day you will be away');
    }

    assertNotFlooding(String(req.user._id));
    const created = await ChatMessage.create({ author: req.user._id, kind, text, absenceDate });
    const message = serialize({ ...created.toObject(), author: req.user });
    emitToSignedIn('chat:message', message);
    res.status(201).json(message);
  })
);

// @route   DELETE /api/chat/messages/:id
// @desc    Delete a message (its author, or any admin)
router.delete(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid message ID');
    const message = await ChatMessage.findById(req.params.id);
    if (!message || message.deleted) throw new ApiError(404, 'Message not found');
    if (String(message.author) !== String(req.user._id) && req.user.role !== 'admin') {
      throw new ApiError(403, 'You can only delete your own messages');
    }
    message.deleted = true;
    message.text = '';
    message.absenceDate = null;
    await message.save();
    emitToSignedIn('chat:deleted', { _id: message._id });
    res.json({ _id: message._id, deleted: true });
  })
);

module.exports = router;
