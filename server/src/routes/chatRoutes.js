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

// Simple per-user flood protection
const RATE_MAX = 8;
const RATE_WINDOW_MS = 10 * 1000;

const recentPosts = new Map();

function assertNotFlooding(userId) {
  const now = Date.now();

  const list = (recentPosts.get(userId) || []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );

  if (list.length >= RATE_MAX) {
    throw new ApiError(
      429,
      'You are sending messages too quickly. Please wait a moment.',
    );
  }

  list.push(now);
  recentPosts.set(userId, list);
}

// Clean idle entries
setInterval(() => {
  const now = Date.now();

  for (const [userId, list] of recentPosts) {
    if (!list.some((t) => now - t < RATE_WINDOW_MS)) {
      recentPosts.delete(userId);
    }
  }
}, 60 * 1000).unref();

// Serialize message
function serialize(m) {
  const a = m.author;

  const author =
    a && typeof a === 'object' && a.name
      ? {
          _id: a._id,
          name: a.name,
          avatar: a.avatar,
          title: a.title,
          role: a.role,
          employeeId: a.employeeId,
        }
      : {
          _id: a,
          name: 'Former employee',
          avatar: '',
          title: '',
          role: 'employee',
        };

  return {
    _id: m._id,
    kind: m.kind || 'message',
    text: m.deleted ? '' : m.text,
    absenceDate: m.deleted ? null : m.absenceDate,
    deleted: !!m.deleted,
    createdAt: m.createdAt,
    author,
  };
}

// ==========================================
// GET TEAM CHAT MESSAGES
// ==========================================
// GET /api/chat/messages?kind=message
// GET /api/chat/messages?kind=announcement
// GET /api/chat/messages?kind=absence
// GET /api/chat/messages?before=<ISO date>

router.get(
  '/messages',
  asyncHandler(async (req, res) => {
    // Get selected tab
    const requestedKind = req.query.kind || 'message';

    // Support All tab as an alias for message
    const selectedKind = requestedKind === 'all' ? 'message' : requestedKind;

    if (!KINDS.includes(selectedKind)) {
      throw new ApiError(400, 'Invalid chat message filter');
    }
    // Only admins can view employee absence notes
    if (selectedKind === 'absence' && req.user.role !== 'admin') {
      throw new ApiError(403, 'Only admins can view absence notes');
    }

    // Pagination
    const before = req.query.before ? new Date(req.query.before) : null;

    // Build query according to selected tab
    const query =
      selectedKind === 'message'
        ? {
            $or: [{ kind: 'message' }, { kind: { $exists: false } }],
          }
        : { kind: selectedKind };

    if (selectedKind === 'message') {
      query.$or = [{ kind: 'message' }, { kind: { $exists: false } }];
    } else {
      query.kind = selectedKind;
    }

    if (before && !Number.isNaN(before.getTime())) {
      query.createdAt = { $lt: before };
    }

    // Pinned announcement is only returned in Announcements tab
    const pinnedPromise =
      selectedKind === 'announcement'
        ? ChatMessage.findOne({
            kind: 'announcement',
            deleted: false,
            createdAt: {
              $gte: new Date(Date.now() - PIN_WINDOW_MS),
            },
          })
            .sort({ createdAt: -1 })
            .populate('author', AUTHOR_FIELDS)
            .lean()
        : Promise.resolve(null);

    const [page, pinned, me] = await Promise.all([
      ChatMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE + 1)
        .populate('author', AUTHOR_FIELDS)
        .lean(),

      pinnedPromise,

      User.findById(req.user._id).select('chatReadAt').lean(),
    ]);

    const hasMore = page.length > PAGE_SIZE;

    const messages = page.slice(0, PAGE_SIZE).reverse().map(serialize);

    res.json({
      messages,
      hasMore,
      pinned: pinned ? serialize(pinned) : null,
      readAt: me?.chatReadAt || null,
    });
  }),
);

// ==========================================
// GET UNREAD NORMAL MESSAGE COUNT
// ==========================================
// GET /api/chat/unread

router.get(
  '/unread',
  asyncHandler(async (req, res) => {
    const me = await User.findById(req.user._id).select('chatReadAt').lean();

    const since = me?.chatReadAt || new Date(Date.now() - UNREAD_WINDOW_MS);

    const count = await ChatMessage.countDocuments({
      createdAt: { $gt: since },
      author: { $ne: req.user._id },

      $and: [
        {
          $or: [{ kind: 'message' }, { kind: { $exists: false } }],
        },
        {
          $or: [{ deleted: false }, { deleted: { $exists: false } }],
        },
      ],
    });

    res.json({
      count,
      readAt: me?.chatReadAt || null,
    });
  }),
);

// ==========================================
// MARK CHAT AS READ
// ==========================================
// POST /api/chat/read

router.post(
  '/read',
  asyncHandler(async (req, res) => {
    const readAt = new Date();

    await User.updateOne({ _id: req.user._id }, { chatReadAt: readAt });

    res.json({ readAt });
  }),
);

// ==========================================
// POST CHAT MESSAGE
// ==========================================
// POST /api/chat/messages
// Everyone can post messages and absence notes.
// Only admins can post announcements.

router.post(
  '/messages',
  asyncHandler(async (req, res) => {
    const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'message';

    const text =
      typeof req.body.text === 'string'
        ? req.body.text.replace(/\r\n/g, '\n').trim()
        : '';

    if (!text) {
      throw new ApiError(400, 'Write a message first');
    }

    if (text.length > MAX_LENGTH) {
      throw new ApiError(
        400,
        `Messages can be at most ${MAX_LENGTH} characters`,
      );
    }

    if (kind === 'announcement' && req.user.role !== 'admin') {
      throw new ApiError(403, 'Only admins can post announcements');
    }

    let absenceDate = null;

    if (kind === 'absence') {
      absenceDate =
        typeof req.body.absenceDate === 'string' &&
        DATE_RE.test(req.body.absenceDate)
          ? req.body.absenceDate
          : null;

      if (!absenceDate) {
        throw new ApiError(400, 'Choose the day you will be away');
      }
    }

    assertNotFlooding(String(req.user._id));

    const created = await ChatMessage.create({
      author: req.user._id,
      kind,
      text,
      absenceDate,
    });

    const message = serialize({
      ...created.toObject(),
      author: req.user,
    });

    // Notify all signed-in users
    emitToSignedIn('chat:message', message);

    res.status(201).json(message);
  }),
);

// ==========================================
// DELETE CHAT MESSAGE
// ==========================================
// DELETE /api/chat/messages/:id
// Author or admin can delete.

router.delete(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw new ApiError(400, 'Invalid message ID');
    }

    const message = await ChatMessage.findById(req.params.id);

    if (!message || message.deleted) {
      throw new ApiError(404, 'Message not found');
    }

    if (
      String(message.author) !== String(req.user._id) &&
      req.user.role !== 'admin'
    ) {
      throw new ApiError(403, 'You can only delete your own messages');
    }

    message.deleted = true;
    message.text = '';
    message.absenceDate = null;

    await message.save();

    emitToSignedIn('chat:deleted', {
      _id: message._id,
    });

    res.json({
      _id: message._id,
      deleted: true,
    });
  }),
);

module.exports = router;
