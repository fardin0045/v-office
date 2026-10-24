const Desk = require('../models/Desk');
const User = require('../models/User');
const { ApiError } = require('../utils/http');

// Desk data is visible to anyone viewing the office, so only non-sensitive fields are exposed (no emails).
const DESK_EMPLOYEE_FIELDS = 'name employeeId avatar role department title workMode';
// The running session includes who is sitting there, which may differ from the assignee
// (e.g. a remote worker using a free desk).
const SESSION_POPULATE = {
  path: 'currentSessionId',
  select: 'checkIn mode status deskId employeeId lastSeenAt',
  populate: { path: 'employeeId', select: DESK_EMPLOYEE_FIELDS },
};

function findDesks(filter = {}) {
  return Desk.find(filter)
    .populate('employeeId', DESK_EMPLOYEE_FIELDS)
    .populate(SESSION_POPULATE)
    .sort({ deskId: 1 })
    .lean();
}

function findDesk(deskId) {
  return Desk.findOne({ deskId }).populate('employeeId', DESK_EMPLOYEE_FIELDS).populate(SESSION_POPULATE).lean();
}

async function requireDesk(deskId) {
  if (typeof deskId !== 'string' || !deskId.trim()) {
    throw new ApiError(400, 'A valid desk ID is required');
  }
  const desk = await Desk.findOne({ deskId: deskId.trim() });
  if (!desk) throw new ApiError(404, 'Desk not found');
  return desk;
}

/**
 * Assigns `deskId` to `employee`, keeping both sides of the relationship consistent:
 * the employee's previous desk is freed and the desk's previous owner is unassigned.
 * Mutates `employee.assignedDesk` in memory as well. Returns every desk ID that changed.
 */
async function assignDeskToEmployee(deskId, employee) {
  const desk = await requireDesk(deskId);
  const changed = new Set([desk.deskId]);

  if (employee.assignedDesk && employee.assignedDesk !== desk.deskId) {
    await Desk.updateOne(
      { deskId: employee.assignedDesk, employeeId: employee._id },
      { employeeId: null, assignedEmployeeName: '' }
    );
    changed.add(employee.assignedDesk);
  }

  if (desk.employeeId && !desk.employeeId.equals(employee._id)) {
    await User.updateOne({ _id: desk.employeeId }, { assignedDesk: null });
  }

  desk.employeeId = employee._id;
  desk.assignedEmployeeName = employee.name;
  await desk.save();

  await User.updateOne({ _id: employee._id }, { assignedDesk: desk.deskId });
  employee.assignedDesk = desk.deskId;

  return [...changed];
}

// Frees the employee's desk (if any). Mutates `employee.assignedDesk`. Returns the freed desk ID or null.
async function clearEmployeeDesk(employee) {
  const previous = employee.assignedDesk;
  if (!previous) return null;

  await Desk.updateOne({ deskId: previous, employeeId: employee._id }, { employeeId: null, assignedEmployeeName: '' });
  await User.updateOne({ _id: employee._id }, { assignedDesk: null });
  employee.assignedDesk = null;
  return previous;
}

module.exports = {
  DESK_EMPLOYEE_FIELDS,
  findDesks,
  findDesk,
  requireDesk,
  assignDeskToEmployee,
  clearEmployeeDesk,
};
