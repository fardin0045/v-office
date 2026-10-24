const mongoose = require('mongoose');

const workSessionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deskId: {
      type: String,
      default: null, // null if remote
    },
    mode: {
      type: String,
      enum: ['office', 'remote'],
      default: 'office',
    },
    checkIn: {
      type: Date,
      default: Date.now,
      required: true,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // duration in seconds
      default: 0,
    },
    date: {
      type: String, // YYYY-MM-DD in the employee's timezone at check-in
      required: true,
    },
    status: {
      type: String,
      enum: ['working', 'completed'],
      default: 'working',
    },
    notes: {
      type: String,
      default: '',
    },
    // Last moment the employee was known to have V-Office open (used for automatic check-out).
    lastSeenAt: {
      type: Date,
      default: null,
    },
    // Why the session ended: the employee, an admin, or an automatic rule.
    endReason: {
      type: String,
      enum: ['manual', 'admin', 'auto-offline', 'auto-max-duration', 'desk-unassigned', 'employee-removed', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Per-employee history, stats and "active session" lookups.
workSessionSchema.index({ employeeId: 1, checkIn: -1 });
// Company-wide logs, analytics windows and live counts.
workSessionSchema.index({ checkIn: -1 });
// Per-employee day ranges (work history filters, monthly activity report).
workSessionSchema.index({ employeeId: 1, date: 1 });
// Recent check-outs for the notification feed.
workSessionSchema.index({ checkOut: -1 });
workSessionSchema.index({ status: 1, mode: 1 });
// Database-level guarantee: an employee can have at most one active session,
// even if two check-in requests race each other.
workSessionSchema.index(
  { employeeId: 1 },
  { unique: true, partialFilterExpression: { status: 'working' }, name: 'one_active_session_per_employee' }
);

module.exports = mongoose.model('WorkSession', workSessionSchema);
