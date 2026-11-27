const TrainerAvailability = require('../models/TrainerAvailability');
const TrainerProfile = require('../models/TrainerProfile');
const TrainerScheduleRequest = require('../models/TrainerScheduleRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');

const AVAILABILITY_FIELDS = [
  'dayOfWeek',
  'startTime',
  'endTime',
  'breakStartTime',
  'breakEndTime',
  'maxClients',
  'isActive',
];

// @desc    Get all trainer availabilities
// @route   GET /api/trainer-availabilities
// @access  Private (Admin)
exports.getAvailabilities = async (req, res, next) => {
  try {
    const availabilities = await TrainerAvailability.find()
      .populate('trainer', 'trainerId fullName')
      .sort({ dayOfWeek: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: availabilities.length,
      data: availabilities,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer's availability
// @route   GET /api/trainer-availabilities/trainer/:trainerId
// @access  Private
exports.getTrainerAvailability = async (req, res, next) => {
  try {
    const trainer = await TrainerProfile.findById(req.params.trainerId).select('status');
    if (!trainer) {
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }
    if (trainer.status !== 'active') {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    const availabilities = await TrainerAvailability.find({
      trainer: req.params.trainerId,
      isActive: true,
    })
      .sort({ dayOfWeek: 1, startTime: 1 });

    const pendingRequests = await TrainerScheduleRequest.find({
      trainer: req.params.trainerId,
      status: 'pending',
    });

    const pendingMap = new Map();
    for (const req of pendingRequests) {
      if (req.availability) pendingMap.set(String(req.availability), req);
      else if (req.dayOfWeek) pendingMap.set(req.dayOfWeek, req);
    }

    const enriched = availabilities.map(a => {
      const obj = a.toObject();
      const p = pendingMap.get(String(a._id)) || pendingMap.get(a.dayOfWeek);
      obj.pendingRequest = p || null;
      obj.requestStatus = p ? 'pending' : 'none';
      return obj;
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create trainer availability
// @route   POST /api/trainer-availabilities
// @access  Private (Admin)
exports.createAvailability = async (req, res, next) => {
  try {
    const { trainerId, dayOfWeek, startTime, endTime, breakStartTime, breakEndTime, maxClients } = req.body;

    // Validate trainer
    const trainer = await TrainerProfile.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }
    if (trainer.status !== 'active') {
      return res.status(409).json({ success: false, error: 'Availability cannot be added to an inactive or absent trainer' });
    }

    // Check for overlapping availability
    const overlapping = await TrainerAvailability.findOne({
      trainer: trainerId,
      dayOfWeek,
      isActive: true,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime },
        },
      ],
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: 'Trainer already has availability during this time slot',
      });
    }

    const availability = await TrainerAvailability.create({
      trainer: trainerId,
      dayOfWeek,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      maxClients: maxClients === undefined ? 10 : maxClients,
    });

    res.status(201).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update trainer availability
// @route   PUT /api/trainer-availabilities/:id
// @access  Private (Admin)
exports.updateAvailability = async (req, res, next) => {
  try {
    const availability = await TrainerAvailability.findById(req.params.id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
      });
    }
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => AVAILABILITY_FIELDS.includes(key)));
    Object.assign(availability, changes);
    if (changes.trainer || changes.dayOfWeek || changes.startTime || changes.endTime || changes.isActive !== false) {
      const overlapping = await TrainerAvailability.findOne({
        _id: { $ne: availability._id },
        trainer: availability.trainer,
        dayOfWeek: availability.dayOfWeek,
        isActive: true,
        startTime: { $lt: availability.endTime },
        endTime: { $gt: availability.startTime },
      });
      if (overlapping && availability.isActive) {
        return res.status(409).json({ success: false, error: 'Trainer already has overlapping active availability' });
      }
    }
    const allocations = await require('../models/TrainerClientAllocation').find({ trainer: availability.trainer, status: 'active' }).select('member');
    if (allocations.length) {
      const otherSchedules = await TrainerAvailability.find({ trainer: availability.trainer, _id: { $ne: availability._id }, isActive: true });
      const schedules = [...otherSchedules, ...(availability.isActive ? [availability] : [])];
      const bookings = await require('../models/MemberSlotAllocation').find({ member: { $in: allocations.map(item => item.member) }, status: 'active' }).populate('timeSlot');
      if (bookings.some(booking => !schedules.some(schedule => require('../utils/schedule').coversSlot(schedule, booking.timeSlot) && schedule.maxClients >= allocations.length))) {
        return res.status(409).json({ success: false, error: 'Reassign clients before changing a schedule or reducing capacity below current bookings' });
      }
    }
    await availability.save();

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete trainer availability
// @route   DELETE /api/trainer-availabilities/:id
// @access  Private (Admin)
exports.deleteAvailability = async (req, res, next) => {
  try {
    const availability = await TrainerAvailability.findById(req.params.id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
      });
    }
    availability.isActive = false;
    const allocations = await require('../models/TrainerClientAllocation').find({ trainer: availability.trainer, status: 'active' }).select('member');
    if (allocations.length) {
      const otherSchedules = await TrainerAvailability.find({ trainer: availability.trainer, _id: { $ne: availability._id }, isActive: true });
      const schedules = [...otherSchedules, ...(availability.isActive ? [availability] : [])];
      const bookings = await require('../models/MemberSlotAllocation').find({ member: { $in: allocations.map(item => item.member) }, status: 'active' }).populate('timeSlot');
      if (bookings.some(booking => !schedules.some(schedule => require('../utils/schedule').coversSlot(schedule, booking.timeSlot) && schedule.maxClients >= allocations.length))) {
        return res.status(409).json({ success: false, error: 'Reassign clients before changing a schedule or reducing capacity below current bookings' });
      }
    }
    await availability.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer leave information
// @route   GET /api/trainer-availabilities/leave/:trainerId
// @access  Private (Admin)
exports.getTrainerLeave = async (req, res, next) => {
  try {
    const trainer = await TrainerProfile.findById(req.params.trainerId);
    
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }

    const isOnLeave = trainer.status === 'on_leave';

    res.status(200).json({
      success: true,
      data: {
        trainerId: trainer._id,
        trainerName: trainer.fullName,
        status: trainer.status,
        isOnLeave,
        leaveReason: trainer.leaveReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set trainer on leave
// @route   POST /api/trainer-availabilities/leave/:trainerId
// @access  Private (Admin)
exports.setTrainerOnLeave = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (req.body.startDate !== undefined || req.body.endDate !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled leave ranges are not supported; this action records an open-ended leave until manually reactivated.',
      });
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
      return res.status(400).json({ success: false, error: 'Leave reason must be 500 characters or fewer' });
    }

    const trainer = await TrainerProfile.findById(req.params.trainerId);
    
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }
    if (trainer.status !== 'active') {
      return res.status(409).json({ success: false, error: 'Only an active trainer can be placed on leave' });
    }

    trainer.status = 'on_leave';
    trainer.leaveReason = reason?.trim() || undefined;
    await trainer.save();

    res.status(200).json({
      success: true,
      data: trainer,
      message: 'Trainer marked as on leave',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reactivate trainer from leave
// @route   POST /api/trainer-availabilities/reactivate/:trainerId
// @access  Private (Admin)
exports.reactivateTrainer = async (req, res, next) => {
  try {
    const trainer = await TrainerProfile.findById(req.params.trainerId);
    
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }
    if (trainer.status !== 'on_leave') {
      return res.status(409).json({ success: false, error: 'Trainer is not currently on leave' });
    }

    trainer.status = 'active';
    trainer.leaveReason = undefined;
    await trainer.save();

    res.status(200).json({
      success: true,
      data: trainer,
      message: 'Trainer reactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit trainer schedule change request
// @route   POST /api/trainer-availabilities/request-change
// @access  Private (Trainer, Admin)
exports.submitScheduleRequest = async (req, res, next) => {
  try {
    let trainerId = req.body.trainerId;
    if (req.user.role === 'trainer') {
      const userId = req.user.id || req.user._id;
      let profile = null;
      if (userId) {
        profile = await TrainerProfile.findOne({ user: userId });
      }
      if (!profile && req.body.trainerId) {
        profile = await TrainerProfile.findById(req.body.trainerId);
      }
      if (!profile) {
        return res.status(404).json({ success: false, error: 'Trainer profile not found' });
      }
      trainerId = profile._id;
    }

    const { availabilityId, dayOfWeek, startTime, endTime, breakStartTime, breakEndTime, maxClients, isActive, reason } = req.body;

    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Day, start time, and end time are required' });
    }
    if (!timePattern.test(startTime) || !timePattern.test(endTime) || startTime >= endTime) {
      return res.status(400).json({ success: false, error: 'Valid 24-hour start and end times are required (end time must be after start time)' });
    }
    if (breakStartTime || breakEndTime) {
      if (!breakStartTime || !breakEndTime || !timePattern.test(breakStartTime) || !timePattern.test(breakEndTime) || breakStartTime >= breakEndTime || breakStartTime < startTime || breakEndTime > endTime) {
        return res.status(400).json({ success: false, error: 'Break time must be within working hours' });
      }
    }

    const trainer = await TrainerProfile.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }

    // Cancel or supersede any existing pending request for this day/availability
    await TrainerScheduleRequest.deleteMany({
      trainer: trainerId,
      $or: [
        { availability: availabilityId },
        { dayOfWeek: dayOfWeek },
      ],
      status: 'pending',
    });

    const request = await TrainerScheduleRequest.create({
      trainer: trainerId,
      availability: availabilityId || null,
      requestType: availabilityId ? 'update' : 'create',
      dayOfWeek,
      startTime,
      endTime,
      breakStartTime: breakStartTime || undefined,
      breakEndTime: breakEndTime || undefined,
      maxClients: maxClients ? Number(maxClients) : 10,
      isActive: isActive !== false,
      reason: reason || '',
      status: 'pending',
    });

    // Notify all active Admin users about this schedule request
    const admins = await User.find({ role: 'admin', isActive: true });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        type: 'admin_announcement',
        title: 'Trainer Schedule Change Request',
        message: `Coach ${trainer.fullName} requested schedule update for ${dayOfWeek.toUpperCase()} (${startTime} – ${endTime}): "${reason || 'Pending approval'}"`,
        relatedData: {
          requestId: request._id,
          trainerId: trainer._id,
          dayOfWeek,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Schedule change request submitted to Admin for approval.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get schedule change requests
// @route   GET /api/trainer-availabilities/requests
// @access  Private (Admin, Trainer)
exports.getScheduleRequests = async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === 'trainer') {
      const userId = req.user.id || req.user._id;
      const profile = await TrainerProfile.findOne({ user: userId });
      if (!profile) return res.status(200).json({ success: true, count: 0, data: [] });
      query.trainer = profile._id;
    }
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    const requests = await TrainerScheduleRequest.find(query)
      .populate('trainer', 'trainerId fullName specialization mobileNumber')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve trainer schedule change request
// @route   POST /api/trainer-availabilities/requests/:id/approve
// @access  Private (Admin)
exports.approveScheduleRequest = async (req, res, next) => {
  try {
    const request = await TrainerScheduleRequest.findById(req.params.id)
      .populate('trainer');

    if (!request) {
      return res.status(404).json({ success: false, error: 'Schedule request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Request has already been ${request.status}` });
    }

    let availability = null;
    if (request.availability) {
      availability = await TrainerAvailability.findById(request.availability);
    }
    if (!availability) {
      availability = await TrainerAvailability.findOne({
        trainer: request.trainer._id,
        dayOfWeek: request.dayOfWeek,
      });
    }

    if (availability) {
      availability.startTime = request.startTime;
      availability.endTime = request.endTime;
      availability.breakStartTime = request.breakStartTime || undefined;
      availability.breakEndTime = request.breakEndTime || undefined;
      availability.maxClients = request.maxClients;
      availability.isActive = request.isActive;
      availability.updatedAt = new Date();
      await availability.save();
    } else {
      availability = await TrainerAvailability.create({
        trainer: request.trainer._id,
        dayOfWeek: request.dayOfWeek,
        startTime: request.startTime,
        endTime: request.endTime,
        breakStartTime: request.breakStartTime,
        breakEndTime: request.breakEndTime,
        maxClients: request.maxClients,
        isActive: request.isActive,
      });
      request.availability = availability._id;
    }

    request.status = 'approved';
    request.reviewedBy = req.user?.id || req.user?._id;
    request.reviewedAt = new Date();
    const approveBody = req.body || {};
    request.adminComment = approveBody.adminComment || 'Approved by Admin';
    await request.save();

    // Notify the trainer
    if (request.trainer?.user) {
      await Notification.create({
        recipient: request.trainer.user,
        type: 'trainer_assignment',
        title: 'Schedule Change Approved',
        message: `Your availability schedule for ${request.dayOfWeek.toUpperCase()} (${request.startTime} – ${request.endTime}) was approved by Admin and is now live.`,
        relatedData: {
          requestId: request._id,
          dayOfWeek: request.dayOfWeek,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Schedule request approved and applied successfully.',
      data: {
        request,
        availability,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject trainer schedule change request
// @route   POST /api/trainer-availabilities/requests/:id/reject
// @access  Private (Admin)
exports.rejectScheduleRequest = async (req, res, next) => {
  try {
    const request = await TrainerScheduleRequest.findById(req.params.id)
      .populate('trainer');

    if (!request) {
      return res.status(404).json({ success: false, error: 'Schedule request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Request has already been ${request.status}` });
    }

    request.status = 'rejected';
    request.reviewedBy = req.user?.id || req.user?._id;
    request.reviewedAt = new Date();
    const rejectBody = req.body || {};
    request.adminComment = rejectBody.adminComment || 'Declined by Admin';
    await request.save();

    // Notify the trainer
    if (request.trainer?.user) {
      await Notification.create({
        recipient: request.trainer.user,
        type: 'trainer_assignment',
        title: 'Schedule Change Declined',
        message: `Your availability change request for ${request.dayOfWeek.toUpperCase()} was declined by Admin. Note: ${request.adminComment}`,
        relatedData: {
          requestId: request._id,
          dayOfWeek: request.dayOfWeek,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Schedule request declined.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};
