const mongoose = require('mongoose');
const MemberProfile = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const User = require('../models/User');
const BiometricEnrollment = require('../models/BiometricEnrollment');
const service = require('../services/biometricService');
const { fail } = require('../services/biometricValidation');

// Resolve person: Member, Trainer, or Receptionist (Admin explicitly excluded)
async function resolvePerson(req) {
  const { memberId, trainerId, userId, personType } = { ...req.query, ...req.body };

  // 1. Trainer
  if (personType === 'trainer' || trainerId || (req.user.role === 'trainer' && !memberId)) {
    const tId = trainerId || req.body?.id || req.query?.id;
    let trainer = null;
    if (tId && mongoose.isObjectIdOrHexString(tId)) {
      trainer = await TrainerProfile.findById(tId);
      if (!trainer) trainer = await TrainerProfile.findOne({ user: tId });
    }
    if (!trainer && req.user.role === 'trainer') {
      trainer = await TrainerProfile.findOne({ user: req.user.id || req.user._id });
    }
    if (!trainer) fail('Trainer profile not found', 404);
    return {
      type: 'trainer',
      id: trainer._id,
      doc: trainer,
      name: trainer.fullName,
      code: trainer.trainerId,
    };
  }

  // 2. Staff / Reception (Admin explicitly excluded)
  if (personType === 'reception' || userId) {
    const uId = userId || req.body?.id || req.query?.id || (req.user.role === 'reception' ? req.user.id : null);
    if (!uId || !mongoose.isObjectIdOrHexString(uId)) fail('A valid user ID is required', 400);
    const user = await User.findById(uId);
    if (!user) fail('Staff user account not found', 404);
    if (user.role === 'admin') {
      fail('Admin accounts are excluded from biometric attendance tracking', 400);
    }
    return {
      type: 'reception',
      id: user._id,
      doc: user,
      name: user.name || user.email.split('@')[0],
      code: 'REC-' + (user.name || user.email.split('@')[0]).toUpperCase().slice(0, 8),
    };
  }

  // 3. Member
  const requested = memberId || req.body?.id || req.query?.id;
  const own = req.user.role === 'member';
  let member = null;
  if (own) {
    member = await MemberProfile.findOne({ user: req.user.id || req.user._id });
  } else if (requested && mongoose.isObjectIdOrHexString(requested)) {
    member = await MemberProfile.findById(requested);
  }
  if (!member) fail('Member profile not found', 404);
  return {
    type: 'member',
    id: member._id,
    doc: member,
    name: member.fullName,
    code: member.memberId,
  };
}

exports.checkDeviceStatus = async (req, res) => res.json({ success: true, data: service.capabilities() });

exports.initializeEnrollment = async (req, res, next) => {
  try {
    const person = await resolvePerson(req);
    res.json({ success: true, data: await service.initializeCapture(person) });
  } catch (e) { next(e); }
};

exports.processEnrollment = async (req, res, next) => {
  try {
    const person = await resolvePerson(req);
    const data = await service.processEnrollment(person, req.body.captureData, {
      fingerPosition: req.body.fingerPosition,
      operatorId: req.user.id || req.user._id,
      replaceEnrollmentReference: req.body.replaceEnrollmentReference,
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.verifyFingerprint = async (req, res, next) => {
  try {
    await resolvePerson(req);
    const result = await service.verifyFingerprint();
    res.status(503).json({ success: false, code: result.code, error: result.message });
  } catch (e) { next(e); }
};

exports.getEnrollmentStatus = async (req, res, next) => {
  try {
    const person = await resolvePerson(req);
    const query = {};
    if (person.type === 'trainer') query.trainer = person.id;
    else if (person.type === 'reception') query.user = person.id;
    else query.member = person.id;

    const enrollment = await BiometricEnrollment.findOne(query);
    res.json({
      success: true,
      data: {
        isEnrolled: enrollment?.isActive === true && enrollment?.enrollmentStatus === 'enrolled',
        enrollment: service.dto(enrollment),
        person: {
          type: person.type,
          id: person.id,
          name: person.name,
          code: person.code,
        },
      },
    });
  } catch (e) { next(e); }
};

exports.deleteEnrollment = async (req, res, next) => {
  try {
    const person = await resolvePerson(req);
    res.json({ success: true, data: await service.deleteEnrollment(person) });
  } catch (e) { next(e); }
};

exports.getAllEnrollments = async (req, res, next) => {
  try {
    const enrollments = await BiometricEnrollment.find()
      .populate('member', 'memberId fullName')
      .populate('trainer', 'trainerId fullName')
      .populate('user', 'name email role')
      .sort({ enrollmentDate: -1 })
      .limit(500);
    res.json({ success: true, count: enrollments.length, data: enrollments.map(service.dto) });
  } catch (e) { next(e); }
};
