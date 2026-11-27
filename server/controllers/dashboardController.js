const MemberProfile = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const MemberMembership = require('../models/MemberMembership');
const MemberAttendance = require('../models/MemberAttendance');
const Payment = require('../models/Payment');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const GymTimeSlot = require('../models/GymTimeSlot');
const TrainerAvailability = require('../models/TrainerAvailability');
const config = require('../config/env');
const { gymDayBounds } = require('../utils/gymDate');
const { calculateDailySpending } = require('../utils/gymSession');

// @desc    Get admin dashboard stats
// @route   GET /api/dashboard/admin
// @access  Private (Admin)
exports.getAdminDashboard = async (req, res, next) => {
  try {
    const totalMembers = await MemberProfile.countDocuments();
    const currentMemberIds = await MemberMembership.distinct('member', { status: 'active', paymentStatus: 'paid', startDate: { $lte: new Date() }, endDate: { $gt: new Date() } });
    const activeMembers = await MemberProfile.countDocuments({ _id: { $in: currentMemberIds }, registrationStatus: 'active' });
    const totalTrainers = await TrainerProfile.countDocuments();
    const activeTrainers = await TrainerProfile.countDocuments({ status: 'active' });

    // Today's check-ins
    const { start: today, end: tomorrow } = gymDayBounds();
    const todayCheckins = await MemberAttendance.countDocuments({
      attendanceDate: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // Currently checked-in members (check-in today but no check-out)
    const currentlyCheckedIn = await MemberAttendance.countDocuments({
      attendanceDate: {
        $gte: today,
        $lt: tomorrow,
      },
      checkOutTime: null,
    });

    // Monthly revenue (current month)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: currentMonth },
          paymentStatus: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Memberships expiring soon (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await MemberMembership.countDocuments({
      status: 'active',
      endDate: { $gte: new Date(), $lte: thirtyDaysFromNow },
    });

    // Pending dues
    const pendingDues = await MemberMembership.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['pending', 'partial', 'overdue'] },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pendingAmount' },
        },
      },
    ]);

    const attendanceSince = new Date(today);
    attendanceSince.setDate(attendanceSince.getDate() - 6);
    const revenueSince = new Date(currentMonth);
    revenueSince.setMonth(revenueSince.getMonth() - 5);
    const [attendanceTrend, revenueTrend, membershipDistribution, paymentMethodDistribution, slotUtilization] = await Promise.all([
      MemberAttendance.aggregate([
        { $match: { attendanceDate: { $gte: attendanceSince } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$attendanceDate', timezone: config.gym.timezone } }, checkIns: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { paymentStatus: 'completed', paymentDate: { $gte: revenueSince } } },
        { $group: { _id: { year: { $year: '$paymentDate' }, month: { $month: '$paymentDate' } }, revenue: { $sum: '$amount' }, payments: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      MemberMembership.aggregate([
        { $group: { _id: '$status', value: { $sum: 1 } } },
        { $sort: { value: -1 } },
      ]),
      Payment.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: '$paymentMethod', value: { $sum: '$amount' }, payments: { $sum: 1 } } },
        { $sort: { value: -1 } },
      ]),
      GymTimeSlot.find({ status: 'active', dayOfWeek: 'monday' }).select('name startTime endTime currentCapacity maxCapacity').sort({ startTime: 1 }).lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMembers,
        activeMembers,
        totalTrainers,
        activeTrainers,
        todayCheckins,
        currentlyCheckedIn,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        expiringSoon,
        pendingDues: pendingDues[0]?.total || 0,
        attendanceTrend: attendanceTrend.map(item => ({ date: item._id, checkIns: item.checkIns })),
        revenueTrend: revenueTrend.map(item => ({ year: item._id.year, month: item._id.month, revenue: item.revenue, payments: item.payments })),
        membershipDistribution: membershipDistribution.map(item => ({ name: item._id || 'unknown', value: item.value })),
        paymentMethodDistribution: paymentMethodDistribution.map(item => ({ name: item._id || 'unknown', value: item.value, payments: item.payments })),
        slotUtilization: slotUtilization.map(slot => ({
          name: slot.name,
          time: `${slot.startTime}-${slot.endTime}`,
          members: slot.currentCapacity,
          capacity: slot.maxCapacity,
          utilization: Math.round((slot.currentCapacity / slot.maxCapacity) * 100),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer dashboard stats
// @route   GET /api/dashboard/trainer
// @access  Private (Trainer)
exports.getTrainerDashboard = async (req, res, next) => {
  try {
    const trainerProfile = await TrainerProfile.findOne({ user: req.user.id });
    if (!trainerProfile) {
      return res.status(404).json({
        success: false,
        error: 'Trainer profile not found',
      });
    }

    const activeAllocations = await TrainerClientAllocation.find({
      trainer: trainerProfile._id,
      status: 'active',
    }).populate({
      path: 'member',
      select: 'fullName memberId mobileNumber fitnessGoal height weight profilePicture createdAt'
    });

    const memberIds = activeAllocations.map(a => a.member?._id || a.member).filter(Boolean);
    const assignedClients = memberIds.length;

    // Fetch latest memberships for assigned members to get plan names
    const memberships = memberIds.length
      ? await MemberMembership.find({ member: { $in: memberIds } })
          .populate('membershipPlan', 'name')
          .sort({ createdAt: -1 })
      : [];

    const latestPlanMap = new Map();
    for (const ms of memberships) {
      const mid = String(ms.member);
      if (!latestPlanMap.has(mid)) {
        latestPlanMap.set(mid, ms.membershipPlan?.name || 'Studio Member');
      }
    }

    // Today's sessions & currently checked-in
    const { start: today, end: tomorrow } = gymDayBounds();
    const todaySessions = memberIds.length
      ? await MemberAttendance.countDocuments({
          member: { $in: memberIds },
          attendanceDate: { $gte: today, $lt: tomorrow },
        })
      : 0;

    const currentlyCheckedIn = memberIds.length
      ? await MemberAttendance.countDocuments({
          member: { $in: memberIds },
          attendanceDate: { $gte: today, $lt: tomorrow },
          $or: [{ sessionOpen: true }, { checkOutTime: { $exists: false } }, { checkOutTime: null }]
        })
      : 0;

    // 7-day attendance trend of their assigned members
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const weeklyAttendances = memberIds.length
      ? await MemberAttendance.find({
          member: { $in: memberIds },
          attendanceDate: { $gte: sevenDaysAgo, $lt: tomorrow }
        }).select('attendanceDate checkInTime member')
      : [];

    const weeklyTrendMap = new Map();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      weeklyTrendMap.set(key, 0);
    }
    weeklyAttendances.forEach(a => {
      if (a.attendanceDate) {
        const key = a.attendanceDate.toISOString().split('T')[0];
        if (weeklyTrendMap.has(key)) {
          weeklyTrendMap.set(key, weeklyTrendMap.get(key) + 1);
        }
      }
    });
    const attendanceTrend = Array.from(weeklyTrendMap.entries()).map(([date, checkIns]) => ({
      date,
      checkIns
    }));

    // Fitness goals breakdown of assigned members
    const goalCounts = {};
    activeAllocations.forEach(a => {
      const goal = (a.member?.fitnessGoal || 'general_fitness').replace(/_/g, ' ');
      const titleGoal = goal.charAt(0).toUpperCase() + goal.slice(1);
      goalCounts[titleGoal] = (goalCounts[titleGoal] || 0) + 1;
    });
    const goalDistribution = Object.entries(goalCounts).map(([name, value]) => ({ name, value }));

    // Trainer's weekly availability schedule
    const availability = await TrainerAvailability.find({
      trainer: trainerProfile._id,
      isActive: true,
    }).sort({ dayOfWeek: 1 });

    // Recent active assigned members for interactive roster
    const assignedMembers = activeAllocations.slice(0, 8).map(a => ({
      _id: a.member?._id,
      fullName: a.member?.fullName || 'Client',
      memberId: a.member?.memberId || 'GYM',
      mobileNumber: a.member?.mobileNumber,
      fitnessGoal: a.member?.fitnessGoal,
      profilePicture: a.member?.profilePicture,
      startDate: a.startDate,
      planName: latestPlanMap.get(String(a.member?._id)) || 'Studio Member'
    }));

    res.status(200).json({
      success: true,
      data: {
        trainer: {
          fullName: trainerProfile.fullName,
          trainerId: trainerProfile.trainerId,
          specialization: trainerProfile.specialization,
          experience: trainerProfile.experience,
        },
        assignedClients,
        todaySessions,
        currentlyCheckedIn,
        weeklyWorkouts: weeklyAttendances.length,
        attendanceTrend,
        goalDistribution,
        availability,
        assignedMembers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member dashboard stats
// @route   GET /api/dashboard/member
// @access  Private (Member)
exports.getMemberDashboard = async (req, res, next) => {
  try {
    const memberProfile = await MemberProfile.findOne({ user: req.user.id });
    if (!memberProfile) {
      return res.status(404).json({
        success: false,
        error: 'Member profile not found',
      });
    }

    const membership = await MemberMembership.findOne({
      member: memberProfile._id,
      status: 'active',
      paymentStatus: 'paid',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).populate('membershipPlan');

    // Today's attendance
    const { start: today, end: tomorrow } = gymDayBounds();
    const todayAttendances = await MemberAttendance.find({
      member: memberProfile._id,
      attendanceDate: {
        $gte: today,
        $lt: tomorrow,
      },
    }).sort({ checkInTime: 1 });
    const todaySpending = calculateDailySpending(todayAttendances);
    const todayAttendance = todayAttendances[todayAttendances.length - 1] || null;

    // Calculate remaining days
    let remainingDays = 0;
    if (membership && membership.endDate) {
      const endDate = new Date(membership.endDate);
      const now = new Date();
      remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    }

    res.status(200).json({
      success: true,
      data: {
        member: memberProfile,
        membership,
        todayAttendance,
        todayAttendances,
        todaySpending,
        remainingDays,
      },
    });
  } catch (error) {
    next(error);
  }
};
