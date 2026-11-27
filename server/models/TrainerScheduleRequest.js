const mongoose = require('mongoose');

const trainerScheduleRequestSchema = new mongoose.Schema({
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainerProfile',
    required: true,
  },
  availability: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainerAvailability',
  },
  requestType: {
    type: String,
    enum: ['create', 'update', 'delete'],
    default: 'update',
  },
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  breakStartTime: {
    type: String,
  },
  breakEndTime: {
    type: String,
  },
  maxClients: {
    type: Number,
    default: 10,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  reason: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  adminComment: {
    type: String,
    default: '',
    trim: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('TrainerScheduleRequest', trainerScheduleRequestSchema);
