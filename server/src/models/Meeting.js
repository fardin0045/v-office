const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
  },
  { _id: false }
);

// A meeting in the virtual office's meeting room. The room holds one meeting at a time.
const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    // Online meeting URL (Google Meet, Zoom, Teams, Jitsi…) opened when an employee joins.
    link: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cancelled: { type: Boolean, default: false },
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true }
);

// Upcoming / live lookups and overlap checks.
meetingSchema.index({ cancelled: 1, endsAt: 1, startsAt: 1 });
meetingSchema.index({ 'participants.user': 1, 'participants.leftAt': 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
