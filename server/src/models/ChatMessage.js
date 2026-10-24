const mongoose = require('mongoose');

// One company-wide team chat. `kind` marks absence notes and (admin-only) announcements.
const chatMessageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['message', 'absence', 'announcement'], default: 'message' },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    // Absence notes: the local day (YYYY-MM-DD) the person will be away.
    absenceDate: { type: String, default: null },
    // Soft delete keeps the timeline stable for everyone who already saw the message.
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chatMessageSchema.index({ createdAt: -1 });
chatMessageSchema.index({ kind: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
