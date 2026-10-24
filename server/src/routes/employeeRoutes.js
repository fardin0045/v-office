const express = require('express');
const User = require('../models/User');
const Desk = require('../models/Desk');
const WorkSession = require('../models/WorkSession');
const { protect, adminOnly } = require('../middleware/auth');
const {
  ApiError,
  asyncHandler,
  isValidObjectId,
  cleanString,
  EMAIL_RE,
  EMPLOYEE_ID_RE,
  passwordProblem,
} = require('../utils/http');
const { defaultAvatar } = require('../utils/serializers');
const { assignDeskToEmployee, clearEmployeeDesk, requireDesk } = require('../services/deskService');
const { revokeUserSockets } = require('../presence');
const { completeSession } = require('../services/sessionService');
const { emitDeskUpdates, emitStatusChange } = require('../realtime');
const { parseTzOffset, localDateKey, sessionSeconds } = require('../utils/time');

const router = express.Router();
router.use(protect);

const ROLES = ['employee', 'admin'];
const WORK_MODES = ['office', 'remote'];

function requireObjectId(id) {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Invalid employee ID');
}

// @route   GET /api/employees
// @desc    Roster with desk assignment and live work status (admin)
router.get(
  '/',
  adminOnly,
  asyncHandler(async (_req, res) => {
    const [employees, activeSessions] = await Promise.all([
      User.find({}).select('-password -__v').sort({ name: 1 }).lean(),
      WorkSession.find({ status: 'working' }).select('employeeId deskId mode checkIn').lean(),
    ]);

    const activeByUser = new Map(activeSessions.map((s) => [s.employeeId.toString(), s]));

    res.json(
      employees.map((emp) => {
        const currentSession = activeByUser.get(emp._id.toString()) || null;
        return { ...emp, isWorking: Boolean(currentSession), currentSession };
      })
    );
  })
);

// @route   GET /api/employees/:id
// @desc    Profile + work statistics. Admins can view anyone; employees only themselves.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    requireObjectId(req.params.id);
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      throw new ApiError(403, 'You can only view your own profile');
    }

    const employee = await User.findById(req.params.id).select('-password -__v').lean();
    if (!employee) throw new ApiError(404, 'Employee not found');

    const [currentSession, recentSessions, totals] = await Promise.all([
      WorkSession.findOne({ employeeId: employee._id, status: 'working' }).lean(),
      WorkSession.find({ employeeId: employee._id }).sort({ checkIn: -1 }).limit(10).lean(),
      WorkSession.aggregate([
        { $match: { employeeId: employee._id, status: 'completed' } },
        { $group: { _id: null, seconds: { $sum: '$duration' }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      employee,
      isWorking: Boolean(currentSession),
      currentSession,
      totalHours: ((totals[0]?.seconds || 0) / 3600).toFixed(1),
      totalSessions: totals[0]?.count || 0,
      recentSessions,
    });
  })
);

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad2 = (n) => String(n).padStart(2, '0');

// @route   GET /api/employees/:id/activity?month=YYYY-MM
// @desc    Day-by-day attendance for one calendar month (admin): every date 1..31 with its sessions,
//          or "absent" on a working day with no check-in. Days use the viewer's timezone (tzOffset).
router.get(
  '/:id/activity',
  adminOnly,
  asyncHandler(async (req, res) => {
    requireObjectId(req.params.id);
    const tzOffset = parseTzOffset(req.query.tzOffset);
    const now = new Date();
    const todayKey = localDateKey(now, tzOffset);

    const monthKey = typeof req.query.month === 'string' && MONTH_RE.test(req.query.month) ? req.query.month : todayKey.slice(0, 7);
    const [year, month] = monthKey.split('-').map(Number);
    if (year < 2000 || year > 2100) throw new ApiError(400, 'Invalid month');
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstKey = `${monthKey}-01`;
    const lastKey = `${monthKey}-${pad2(daysInMonth)}`;

    const employee = await User.findById(req.params.id)
      .select('name email employeeId title department avatar assignedDesk workMode role createdAt')
      .lean();
    if (!employee) throw new ApiError(404, 'Employee not found');

    // `date` is the local calendar day of the check-in, so a string range selects the month exactly.
    const [sessions, firstEver] = await Promise.all([
      WorkSession.find({ employeeId: employee._id, date: { $gte: firstKey, $lte: lastKey } })
        .sort({ checkIn: 1 })
        .select('date checkIn checkOut duration mode deskId status endReason')
        .lean(),
      WorkSession.findOne({ employeeId: employee._id }).sort({ checkIn: 1 }).select('date').lean(),
    ]);

    const byDate = new Map();
    for (const s of sessions) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(s);
    }

    // Days before someone started are not absences. Imported history can predate the account itself.
    const createdKey = localDateKey(new Date(employee.createdAt || 0), tzOffset);
    const joinedKey = firstEver?.date && firstEver.date < createdKey ? firstEver.date : createdKey;
    const nowMs = now.getTime();
    const summary = { presentDays: 0, absentDays: 0, workingDays: 0, totalSeconds: 0, officeDays: 0, remoteDays: 0, weekendDays: 0 };
    let presentOnWorkingDays = 0;

    const days = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = `${monthKey}-${pad2(d)}`;
      const weekday = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      const list = byDate.get(date) || [];

      let status;
      if (list.length) status = list.some((s) => s.status === 'working') ? 'working' : 'present';
      else if (date > todayKey) status = 'upcoming';
      else if (date < joinedKey) status = 'not-joined';
      else if (weekend) status = 'weekend';
      else if (date === todayKey) status = 'not-yet';
      else status = 'absent';

      const totalSeconds = list.reduce((sum, s) => sum + sessionSeconds(s, nowMs), 0);
      const modes = [...new Set(list.map((s) => s.mode))];
      const desks = [...new Set(list.map((s) => s.deskId).filter(Boolean))];
      const firstIn = list[0]?.checkIn || null;
      const last = list[list.length - 1];
      const lastOut = last ? (last.status === 'working' ? null : last.checkOut) : null;

      if (list.length) {
        summary.presentDays += 1;
        summary.totalSeconds += totalSeconds;
        if (modes.includes('office')) summary.officeDays += 1;
        if (modes.includes('remote')) summary.remoteDays += 1;
      }
      if (status === 'absent') summary.absentDays += 1;
      // Working days that have already happened since the employee joined (today only once they've checked in).
      if (!weekend && date >= joinedKey && (date < todayKey || (date === todayKey && list.length))) {
        summary.workingDays += 1;
        if (list.length) presentOnWorkingDays += 1;
      }
      if (weekend && list.length) summary.weekendDays += 1;

      days.push({
        date,
        weekday,
        weekend,
        status,
        totalSeconds,
        firstIn,
        lastOut,
        modes,
        desks,
        sessions: list.map((s) => ({
          _id: s._id,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          seconds: sessionSeconds(s, nowMs),
          mode: s.mode,
          deskId: s.deskId,
          status: s.status,
          endReason: s.endReason,
        })),
      });
    }

    summary.averageSeconds = summary.presentDays ? Math.round(summary.totalSeconds / summary.presentDays) : 0;
    summary.attendanceRate = summary.workingDays ? Math.round((presentOnWorkingDays / summary.workingDays) * 100) : null;

    res.json({ month: monthKey, today: todayKey, employee, days, summary });
  })
);

// @route   POST /api/employees
// @desc    Create an employee (admin)
router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const name = cleanString(req.body.name, 80);
    const email = cleanString(req.body.email, 254).toLowerCase();
    const employeeId = cleanString(req.body.employeeId, 20).toUpperCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = req.body.role || 'employee';
    const workMode = req.body.workMode || 'office';
    const assignedDesk = cleanString(req.body.assignedDesk, 20);

    if (!name || !email || !employeeId) throw new ApiError(400, 'Name, email and employee ID are required');
    if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please provide a valid email address');
    if (!EMPLOYEE_ID_RE.test(employeeId)) {
      throw new ApiError(400, 'Employee ID may only contain letters, numbers and dashes (e.g. EMP-015)');
    }
    const problem = passwordProblem(password);
    if (problem) throw new ApiError(400, problem);
    if (!ROLES.includes(role)) throw new ApiError(400, 'Invalid role');
    if (!WORK_MODES.includes(workMode)) throw new ApiError(400, 'Invalid work mode');

    const exists = await User.exists({ $or: [{ email }, { employeeId }] });
    if (exists) throw new ApiError(409, 'An employee with this email or ID already exists');
    // Validate the desk before creating the account, so a bad desk never leaves a half-created employee.
    if (assignedDesk) await requireDesk(assignedDesk);

    const employee = await User.create({
      name,
      email,
      password,
      employeeId,
      role,
      workMode,
      department: cleanString(req.body.department, 80) || 'Engineering',
      title: cleanString(req.body.title, 80) || 'Software Engineer',
      avatar: defaultAvatar(name),
    });

    if (assignedDesk) {
      const changed = await assignDeskToEmployee(assignedDesk, employee);
      await emitDeskUpdates(changed);
    }

    res.status(201).json(employee);
  })
);

// @route   PUT /api/employees/:id
// @desc    Update an employee, including desk assignment (admin)
router.put(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    requireObjectId(req.params.id);
    const employee = await User.findById(req.params.id);
    if (!employee) throw new ApiError(404, 'Employee not found');

    const { role, workMode, assignedDesk } = req.body;
    const name = cleanString(req.body.name, 80);
    const email = cleanString(req.body.email, 254).toLowerCase();
    const department = cleanString(req.body.department, 80);
    const title = cleanString(req.body.title, 80);

    if (email && email !== employee.email) {
      if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please provide a valid email address');
      if (await User.exists({ email, _id: { $ne: employee._id } })) {
        throw new ApiError(409, 'Another employee already uses this email');
      }
      employee.email = email;
    }

    if (role !== undefined) {
      if (!ROLES.includes(role)) throw new ApiError(400, 'Invalid role');
      if (employee._id.equals(req.user._id) && role !== 'admin') {
        throw new ApiError(400, 'You cannot remove your own administrator role');
      }
      employee.role = role;
    }

    if (workMode !== undefined) {
      if (!WORK_MODES.includes(workMode)) throw new ApiError(400, 'Invalid work mode');
      employee.workMode = workMode;
    }

    const nameChanged = Boolean(name) && name !== employee.name;
    if (name) employee.name = name;
    if (department) employee.department = department;
    if (title) employee.title = title;

    const changedDesks = [];
    if (assignedDesk !== undefined) {
      const nextDesk = cleanString(assignedDesk || '', 20);
      if (nextDesk && nextDesk !== employee.assignedDesk) {
        changedDesks.push(...(await assignDeskToEmployee(nextDesk, employee)));
      } else if (!nextDesk && employee.assignedDesk) {
        changedDesks.push(await clearEmployeeDesk(employee));
      }
    }

    await employee.save();

    if (nameChanged && employee.assignedDesk) {
      await Desk.updateOne({ deskId: employee.assignedDesk, employeeId: employee._id }, { assignedEmployeeName: employee.name });
      changedDesks.push(employee.assignedDesk);
    }

    await emitDeskUpdates(changedDesks);
    res.json(employee);
  })
);

// @route   DELETE /api/employees/:id
// @desc    Remove an employee (admin). Closes any running session and frees their desk.
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    requireObjectId(req.params.id);
    if (req.user._id.toString() === req.params.id) {
      throw new ApiError(400, 'You cannot delete your own account');
    }

    const employee = await User.findById(req.params.id);
    if (!employee) throw new ApiError(404, 'Employee not found');

    const changedDesks = [];
    const activeSession = await WorkSession.findOne({ employeeId: employee._id, status: 'working' });
    const ended = activeSession ? await completeSession(activeSession, new Date(), 'employee-removed') : null;
    if (ended?.ended) {
      changedDesks.push(ended.deskId);
      emitStatusChange({
        sessionId: activeSession._id,
        reason: 'employee-removed',
        employeeId: employee._id,
        employeeName: employee.name,
        status: 'available',
        duration: activeSession.duration,
      });
    }

    changedDesks.push(await clearEmployeeDesk(employee));
    await User.deleteOne({ _id: employee._id });
    // Their open browsers stop receiving private realtime data immediately.
    revokeUserSockets(employee._id);

    await emitDeskUpdates(changedDesks);
    res.json({ message: 'Employee removed successfully' });
  })
);

module.exports = router;
