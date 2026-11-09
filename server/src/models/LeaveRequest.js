const mongoose = require('mongoose');

const LEAVE_TYPES = ['sick', 'casual', 'annual', 'emergency', 'unpaid'];

const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];

// Validate YYYY-MM-DD without timezone conversion.
function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const leaveRequestSchema = new mongoose.Schema(
  {
    // Employee who submitted the request
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Type of leave
    leaveType: {
      type: String,
      enum: LEAVE_TYPES,
      required: true,
    },

    // Calendar dates stored without timezone conversion
    startDate: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateOnly,
        message: 'Invalid leave start date.',
      },
    },

    endDate: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateOnly,
        message: 'Invalid leave end date.',
      },
    },

    // Employee's explanation
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000,
    },

    // Admin approval status
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      default: 'pending',
      index: true,
    },

    // Admin who reviewed the application
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    // Admin's explanation for approval/rejection
    adminComment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Ensure end date is not before start date.
leaveRequestSchema.pre('validate', function () {
  if (
    isValidDateOnly(this.startDate) &&
    isValidDateOnly(this.endDate) &&
    this.endDate < this.startDate
  ) {
    this.invalidate(
      'endDate',
      'Leave end date cannot be before the start date.',
    );
  }
});

// Efficient employee history and admin dashboard queries.
leaveRequestSchema.index({
  employee: 1,
  createdAt: -1,
});

leaveRequestSchema.index({
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
