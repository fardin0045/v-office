const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Desk = require('../models/Desk');
const config = require('../config/env');
const { emitDeskUpdates } = require('../realtime');
const { protect, signToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const {
  ApiError,
  asyncHandler,
  cleanString,
  EMAIL_RE,
  EMPLOYEE_ID_RE,
  passwordProblem,
  isHttpUrl,
} = require('../utils/http');
const { toPublicUser, defaultAvatar } = require('../utils/serializers');
const { revokeUserSockets } = require('../presence');

const router = express.Router();

const withToken = (user) => ({ ...toPublicUser(user), token: signToken(user._id) });

// Compared against when the email is unknown, so failed logins take the same time either way
// (response timing must not reveal which emails have accounts).
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 10);

// @route   POST /api/auth/register
// @desc    Self-service registration. Always creates a regular employee; admins are created by admins.
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    if (!config.allowRegistration) {
      throw new ApiError(403, 'Self-registration is disabled. Please contact your administrator.');
    }

    const name = cleanString(req.body.name, 80);
    const email = cleanString(req.body.email, 254).toLowerCase();
    const employeeId = cleanString(req.body.employeeId, 20).toUpperCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!name || !email || !password || !employeeId) {
      throw new ApiError(400, 'Please provide name, email, password and employee ID');
    }
    if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please provide a valid email address');
    if (!EMPLOYEE_ID_RE.test(employeeId)) {
      throw new ApiError(400, 'Employee ID may only contain letters, numbers and dashes (e.g. EMP-015)');
    }
    const problem = passwordProblem(password);
    if (problem) throw new ApiError(400, problem);

    const exists = await User.exists({ $or: [{ email }, { employeeId }] });
    if (exists) throw new ApiError(409, 'A user with this email or employee ID already exists');

    const user = await User.create({
      name,
      email,
      password,
      employeeId,
      role: 'employee',
      department: cleanString(req.body.department, 80) || 'Engineering',
      title: cleanString(req.body.title, 80) || 'Software Engineer',
      avatar: defaultAvatar(name),
    });

    res.status(201).json(withToken(user));
  })
);

// @route   POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = cleanString(req.body.email, 254).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) throw new ApiError(400, 'Please provide email and password');

    if (password.length > 1024) throw new ApiError(401, 'Invalid email or password');

    const user = await User.findOne({ email }).select('+password');
    const valid = user ? await user.matchPassword(password) : await bcrypt.compare(password, DUMMY_HASH).then(() => false);
    if (!valid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    res.json(withToken(user));
  })
);

// @route   GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json(toPublicUser(req.user));
});

// @route   PUT /api/auth/profile
// @desc    Update the signed-in user's own profile
router.put(
  '/profile',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) throw new ApiError(404, 'User not found');

    const { avatar, workMode, password, currentPassword } = req.body;
    const name = cleanString(req.body.name, 80);
    const department = cleanString(req.body.department, 80);
    const title = cleanString(req.body.title, 80);

    if (name) user.name = name;
    if (department) user.department = department;
    if (title) user.title = title;

    if (avatar !== undefined) {
      if (avatar !== '' && !isHttpUrl(avatar)) throw new ApiError(400, 'Avatar must be a valid http(s) URL');
      user.avatar = avatar || defaultAvatar(user.name);
    }

    if (workMode !== undefined) {
      if (!['office', 'remote'].includes(workMode)) throw new ApiError(400, 'Invalid work mode');
      user.workMode = workMode;
    }

    let passwordChanged = false;
    if (typeof password === 'string' && password.trim() !== '') {
      const problem = passwordProblem(password);
      if (problem) throw new ApiError(400, problem);
      // A stolen token alone must not be enough to take over the account.
      if (typeof currentPassword !== 'string' || !currentPassword || !(await user.matchPassword(currentPassword))) {
        throw new ApiError(400, 'Your current password is incorrect');
      }
      user.password = password;
      passwordChanged = true;
    }

    await user.save();
    // Other devices signed in with the old password lose access (the fresh token below stays valid).
    if (passwordChanged) revokeUserSockets(user._id);

    // Keep the denormalized name on the desk in sync.
    if (name && user.assignedDesk) {
      await Desk.updateOne({ deskId: user.assignedDesk, employeeId: user._id }, { assignedEmployeeName: user.name });
      await emitDeskUpdates([user.assignedDesk]);
    }

    res.json(withToken(user));
  })
);

module.exports = router;
