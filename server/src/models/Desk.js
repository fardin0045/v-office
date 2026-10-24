const mongoose = require('mongoose');

const deskSchema = new mongoose.Schema(
  {
    deskId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    chairId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedEmployeeName: {
      type: String,
      default: '',
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
      rotation: { type: Number, default: 0 },
    },
    zone: {
      type: String,
      enum: ['ZONE_A', 'ZONE_B', 'ZONE_C', 'ZONE_D', 'ZONE_E'],
      required: true,
    },
    zoneName: {
      type: String,
      default: 'Open Office',
    },
    status: {
      type: String,
      enum: ['available', 'working', 'occupied', 'locked'],
      default: 'available',
      index: true,
    },
    locked: {
      type: Boolean,
      default: false,
    },
    currentSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkSession',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Desk', deskSchema);
