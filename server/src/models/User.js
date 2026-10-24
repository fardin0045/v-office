const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    role: {
      type: String,
      enum: ['employee', 'admin'],
      default: 'employee',
      index: true,
    },
    assignedDesk: {
      type: String,
      default: null, // e.g. "DESK-12"
    },
    workMode: {
      type: String,
      enum: ['office', 'remote'],
      default: 'office',
    },
    avatar: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: 'Software Engineer',
      trim: true,
      maxlength: 80,
    },
    department: {
      type: String,
      default: 'Engineering',
      trim: true,
      maxlength: 80,
    },
    // Everything in the notification feed newer than this is unread (set when the bell is opened).
    notificationsReadAt: {
      type: Date,
      default: null,
    },
    // Team chat messages newer than this are unread (set while the chat is open).
    chatReadAt: {
      type: Date,
      default: null,
    },
    // Login tokens issued before this moment are rejected (set when the password changes).
    passwordChangedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // Revoke tokens issued before the change. One second of slack: JWT `iat` has second precision,
  // and the fresh token handed back after a password change must stay valid.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  return next();
});

// True if a token issued at `iatSeconds` predates the last password change.
userSchema.statics.isTokenRevoked = function isTokenRevoked(user, iatSeconds) {
  return Boolean(user?.passwordChangedAt && iatSeconds * 1000 < new Date(user.passwordChangedAt).getTime());
};

userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
