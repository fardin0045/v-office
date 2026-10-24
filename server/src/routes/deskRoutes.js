const express = require('express');
const Desk = require('../models/Desk');
const User = require('../models/User');
const WorkSession = require('../models/WorkSession');
const { protect, adminOnly } = require('../middleware/auth');
const { ApiError, asyncHandler, isValidObjectId } = require('../utils/http');
const { findDesks, findDesk, requireDesk, assignDeskToEmployee } = require('../services/deskService');
const { completeSession } = require('../services/sessionService');
const { emitDeskUpdates, emitStatusChange } = require('../realtime');

const router = express.Router();

// @route   GET /api/desks
// @desc    All desks with their (public) assignee info and live status. Public: powers the office view.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await findDesks());
  })
);

// @route   GET /api/desks/:deskId
router.get(
  '/:deskId',
  asyncHandler(async (req, res) => {
    const desk = await findDesk(req.params.deskId);
    if (!desk) throw new ApiError(404, 'Desk not found');
    res.json(desk);
  })
);

// @route   POST /api/desks/assign
// @desc    Assign an employee to a desk (admin)
router.post(
  '/assign',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { deskId, employeeId } = req.body;
    if (!isValidObjectId(employeeId)) throw new ApiError(400, 'A valid employee is required');

    const employee = await User.findById(employeeId);
    if (!employee) throw new ApiError(404, 'Employee not found');

    const changed = await assignDeskToEmployee(deskId, employee);
    await emitDeskUpdates(changed);

    res.json(await findDesk(employee.assignedDesk));
  })
);

// @route   POST /api/desks/unassign
// @desc    Remove the assignee from a desk (admin). Any session running at the desk is closed.
router.post(
  '/unassign',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const desk = await requireDesk(req.body.deskId);

    if (desk.currentSessionId) {
      const session = await WorkSession.findOne({ _id: desk.currentSessionId, status: 'working' });
      if (session && (await completeSession(session, new Date(), 'desk-unassigned')).ended) {
        emitStatusChange({
          sessionId: session._id,
          reason: 'desk-unassigned',
          employeeId: session.employeeId,
          employeeName: desk.assignedEmployeeName || 'An employee',
          status: 'available',
          duration: session.duration,
        });
      }
    }

    if (desk.employeeId) {
      await User.updateOne({ _id: desk.employeeId, assignedDesk: desk.deskId }, { assignedDesk: null });
    }

    await Desk.updateOne(
      { _id: desk._id },
      {
        employeeId: null,
        assignedEmployeeName: '',
        currentSessionId: null,
        status: desk.locked ? 'locked' : 'available',
      }
    );

    await emitDeskUpdates([desk.deskId]);
    res.json(await findDesk(desk.deskId));
  })
);

// @route   POST /api/desks/lock
// @desc    Lock / unlock a desk (admin). Omit `locked` to toggle.
router.post(
  '/lock',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const desk = await requireDesk(req.body.deskId);

    desk.locked = typeof req.body.locked === 'boolean' ? req.body.locked : !desk.locked;
    if (desk.locked) {
      desk.status = 'locked';
    } else {
      desk.status = desk.currentSessionId ? 'working' : 'available';
    }
    await desk.save();

    await emitDeskUpdates([desk.deskId]);
    res.json(await findDesk(desk.deskId));
  })
);

module.exports = router;
