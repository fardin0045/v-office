const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');
const meetings = require('../services/meetingService');

const router = express.Router();
router.use(protect);

// @route   GET /api/meetings
// @desc    Live, upcoming and recently ended meetings in the meeting room
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await meetings.listMeetings());
  })
);

// @route   POST /api/meetings
// @desc    Schedule a meeting (admin). Body: title, description?, startsAt, durationMinutes, link?
router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    res.status(201).json(await meetings.createMeeting(req.body, req.user));
  })
);

// @route   PUT /api/meetings/:id
// @desc    Edit a scheduled or running meeting (admin)
router.put(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    res.json(await meetings.updateMeeting(req.params.id, req.body));
  })
);

// @route   DELETE /api/meetings/:id
// @desc    Cancel a meeting (admin)
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    res.json(await meetings.cancelMeeting(req.params.id));
  })
);

// @route   POST /api/meetings/:id/end
// @desc    End a running meeting now (admin)
router.post(
  '/:id/end',
  adminOnly,
  asyncHandler(async (req, res) => {
    res.json(await meetings.endMeeting(req.params.id));
  })
);

// @route   POST /api/meetings/:id/join
// @desc    Join a meeting (from 10 minutes before it starts until it ends)
router.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    res.json(await meetings.joinMeeting(req.params.id, req.user));
  })
);

// @route   POST /api/meetings/:id/leave
router.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    res.json(await meetings.leaveMeeting(req.params.id, req.user));
  })
);

module.exports = router;
