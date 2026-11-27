const mongoose = require('mongoose');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const config = require('../config/env');
const Station = require('../models/BiometricStationSession');
const Verification = require('../models/BiometricVerificationSession');
const Member = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const User = require('../models/User');
const Enrollment = require('../models/BiometricEnrollment');
const Attendance = require('../models/MemberAttendance');
const MemberMembership = require('../models/MemberMembership');
const Audit = require('../models/AuditLog');
const engine = require('./identificationEngine');
const { decodeBase64 } = require('./biometricValidation');
const { decrypt } = require('./biometricCrypto');
const { validateAttendanceAccess } = require('./attendanceAccess');
const { gymDayBounds } = require('../utils/gymDate');
const { getSessionName, getSessionEndTime, isSessionExpired, calculateAutoCheckout, formatDuration, calculateDailySpending } = require('../utils/gymSession');
const { autoCloseExpiredAttendance } = require('./attendanceAutoCheckout');
const error = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
const hash = token => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw error('INVALID_SESSION', 'Invalid biometric session', 400);
  return createHash('sha256').update(token).digest('hex');
};
const retention = now => new Date(now.getTime() + 24 * 3600000);
const actor = async (userId, session = null) => {
  const query = { _id: userId, isActive: true, role: { $in: ['admin', 'reception', 'kiosk'] } };
  const user = session
    ? await User.findOneAndUpdate(query, { $inc: { biometricVersion: 1 } }, { session, returnDocument: 'after' })
    : await User.findOne(query);
  if (!user) throw error('NOT_AUTHORIZED', 'Reception, kiosk, or administrator access is required', 403);
};
const capabilities = () => ({
  identificationAvailable: engine.available(),
  reason: engine.status().reason,
  mode: config.biometric.identificationMode,
  developmentOnly: config.biometric.identificationMode === 'morfin-local-development',
  cooldownSeconds: config.biometric.cooldownSeconds,
  rearmSeconds: config.biometric.rearmSeconds,
  staleHours: config.biometric.staleHours,
  stalePolicy: config.biometric.stalePolicy,
  timeZone: config.gym.timezone,
  branch: config.gym.branchId,
  removalDetectionAvailable: false,
  rearmStrategy: 'delay_and_same_member_latch',
});
async function stationFor(token, operator, session = null, { lock = false, active = true, now = new Date() } = {}) {
  const query = { tokenHash: hash(token), operator, branch: config.gym.branchId,
    ...(active ? { active: true, expiresAt: { $gt: now } } : {}) };
  const station = lock
    ? await Station.findOneAndUpdate(query, { $inc: { revision: 1 } }, { session, returnDocument: 'after' }).select('+lastRecordedMember +sameMemberArmed')
    : await Station.findOne(query).select('+lastRecordedMember +sameMemberArmed').session(session);
  if (!station) throw error('STATION_INACTIVE', 'Scanner session is paused or expired. Resume to create a new session.', 409);
  return station;
}
async function openStation(operator) {
  await actor(operator);
  const now = new Date(), token = randomBytes(32).toString('base64url');
  const station = await Station.create({
    tokenHash: hash(token), operator, contextId: randomUUID(), branch: config.gym.branchId,
    expiresAt: new Date(now.getTime() + 15 * 60000), purgeAt: retention(now),
  });
  return { stationToken: token, contextId: station.contextId, expiresAt: station.expiresAt };
}
async function closeStation(stationToken, operator) {
  // Serialize with recording transactions by writing the same station document.
  await Station.updateOne({ tokenHash: hash(stationToken), operator }, { $set: { active: false }, $inc: { revision: 1 } });
  await Verification.updateMany({ operator, station: { $in: await Station.find({ tokenHash: hash(stationToken), operator }).distinct('_id') }, state: { $in: ['issued', 'verified'] } }, { $set: { state: 'cancelled' } });
}
async function closeOperatorStations(operator) {
  await Station.updateMany({ operator, active: true }, { $set: { active: false }, $inc: { revision: 1 } });
  await Verification.updateMany({ operator, state: { $in: ['issued', 'verified'] } }, { $set: { state: 'cancelled' } });
}
async function confirmRemoval(stationToken, operator) {
  await actor(operator);
  await mongoose.connection.transaction(async session => {
    const station = await stationFor(stationToken, operator, session, { lock: true });
    await Station.updateOne({ _id: station._id }, { $set: { sameMemberArmed: true } }, { session });
  });
  return { rearmed: true, message: 'Operator confirmed finger removal. Server cooldown still applies.' };
}
async function issueVerification(stationToken, operator) {
  await actor(operator);
  // Challenges may be issued while identification is unavailable; they confer no identity.
  return mongoose.connection.transaction(async session => {
    const now = new Date();
    const station = await stationFor(stationToken, operator, session, { lock: true, now });
    await Verification.updateMany({ station: station._id, state: { $in: ['issued', 'verified'] } }, { $set: { state: 'cancelled' } }, { session });
    const token = randomBytes(32).toString('base64url'), challenge = randomBytes(32).toString('base64url'), eventId = randomUUID();
    const expiresAt = new Date(Math.min(now.getTime() + 45000, station.expiresAt.getTime()));
    await Verification.create([{ tokenHash: hash(token), challenge, eventId, operator, station: station._id,
      branch: config.gym.branchId, expiresAt, purgeAt: retention(now) }], { session });
    return { verificationToken: token, eventId, challenge, expiresAt };
  });
}
async function verificationFor(token, station, operator, session = null) {
  const verification = await Verification.findOne({ tokenHash: hash(token), station: station._id, operator, branch: config.gym.branchId })
    .select('+challenge +member +enrollmentReference +result').session(session);
  if (!verification) throw error('INVALID_VERIFICATION', 'Verification does not belong to this scanner session', 403);
  return verification;
}
async function getCandidates(operator) {
  await actor(operator);
  const rows = await Enrollment.find({ isActive: true, enrollmentStatus: 'enrolled' })
    .select('_id member trainer user personType personName personCode enrollmentReference schemaVersion templateFormat +encryptedTemplate')
    .populate('member', 'memberId fullName avatarInitials profilePicture')
    .populate('trainer', 'trainerId fullName avatarInitials')
    .populate('user', 'name email role')
    .sort({ _id: 1 })
    .limit(config.biometric.searchMaxCandidates)
    .lean();

  const candidates = [];
  for (const row of rows) {
    if (row.user?.role === 'admin') continue; // Always exclude admin accounts!
    const targetObjId = row.member?._id || row.trainer?._id || row.user?._id || row.member || row.trainer || row.user;
    const pType = row.personType || (row.trainer ? 'trainer' : row.user?.role === 'reception' ? 'reception' : 'member');
    const name = row.member?.fullName || row.trainer?.fullName || row.user?.name || row.personName || 'Gym User';
    const code = row.member?.memberId || row.trainer?.trainerId || (pType === 'reception' ? 'STAFF' : '') || row.personCode || '';

    if (row.schemaVersion === 2 && row.templateFormat === 'FMR_V2005' && row.encryptedTemplate && targetObjId) {
      try {
        const decrypted = decrypt(row.encryptedTemplate, String(targetObjId) + ':' + row.enrollmentReference + ':template');
        candidates.push({
          memberId: String(targetObjId),
          memberCode: code,
          fullName: name,
          personType: pType,
          enrollmentReference: row.enrollmentReference,
          galleryTemplate: decrypted.toString('base64'),
          templateFormat: 'FMR_V2005',
        });
      } catch (err) {}
    }
  }
  return candidates;
}

async function identify({ stationToken, verificationToken, probeTemplate, templateFormat, matchedMemberId, matchedEnrollmentReference, diagnostics }, operator) {
  await actor(operator);
  const station = await stationFor(stationToken, operator);
  const verification = await verificationFor(verificationToken, station, operator);
  if (verification.state !== 'issued' || verification.expiresAt <= new Date()) throw error('VERIFICATION_EXPIRED', 'Verification is expired or no longer usable');
  if (!engine.available()) return engine.identify();

  if (matchedMemberId && matchedEnrollmentReference) {
    const result = await engine.identify({
      memberId: matchedMemberId,
      enrollmentReference: matchedEnrollmentReference,
      challenge: verification.challenge,
      eventId: verification.eventId,
      stationContext: station.contextId,
      operator: String(operator),
      expiresAt: verification.expiresAt,
      diagnostics,
    });
    if (result.outcome !== 'identified') {
      await Verification.updateOne({ _id: verification._id, state: 'issued' }, { $set: { state: 'rejected' } });
      throw error('UNKNOWN_FINGERPRINT', 'Fingerprint is not recognized. No attendance recorded.', 422);
    }
    await mongoose.connection.transaction(async session => {
      await actor(operator, session);
      await stationFor(stationToken, operator, session, { lock: true });
      const enrollment = await Enrollment.findOne({
        $or: [
          { member: result.memberId },
          { trainer: result.memberId },
          { user: result.memberId },
        ],
        enrollmentReference: result.enrollmentReference,
        isActive: true,
        enrollmentStatus: 'enrolled',
        schemaVersion: 2,
      }).session(session);
      if (!enrollment) throw error('ENROLLMENT_INACTIVE', 'The identified enrollment is no longer active', 403);
      const updated = await Verification.updateOne({ _id: verification._id, state: 'issued', expiresAt: { $gt: new Date() } },
        { $set: { state: 'verified', member: result.memberId, enrollmentReference: result.enrollmentReference } }, { session });
      if (!updated.modifiedCount) throw error('VERIFICATION_EXPIRED', 'Verification expired, was cancelled, or has already been used');
    });
    return { verified: true, eventId: verification.eventId, ...(result.diagnostics ? { search: { comparisons: result.diagnostics.comparisons, elapsedMs: result.diagnostics.elapsedMs } } : {}) };
  }

  if (templateFormat !== 'FMR_V2005') throw error('INVALID_TEMPLATE', 'Only FMR_V2005 is enabled', 400);
  const probe = decodeBase64(probeTemplate, 64 * 1024, 'Probe template');
  try {
    if (probe.subarray(0, 4).toString('ascii') !== 'FMR\0') throw error('INVALID_TEMPLATE', 'Invalid FMR template', 400);
    const result = await engine.identify({
      probe, templateFormat, challenge: verification.challenge, eventId: verification.eventId,
      stationContext: station.contextId, operator: String(operator), expiresAt: verification.expiresAt,
    });
    if (!result || !['identified', 'unknown', 'ambiguous'].includes(result.outcome)) throw error('INVALID_ENGINE_RESULT', 'Identification provider returned an invalid result', 503);
    if (result.outcome !== 'identified') {
      await Verification.updateOne({ _id: verification._id, state: 'issued' }, { $set: { state: 'rejected' } });
      throw error(result.outcome === 'ambiguous' ? 'AMBIGUOUS_FINGERPRINT' : 'UNKNOWN_FINGERPRINT',
        result.outcome === 'ambiguous' ? 'Fingerprint is ambiguous. No attendance recorded.' : 'Fingerprint is not recognized. No attendance recorded.', 422);
    }
    if (result.challenge !== verification.challenge || result.eventId !== verification.eventId ||
        result.stationContext !== station.contextId || !mongoose.isObjectIdOrHexString(result.memberId) ||
        typeof result.enrollmentReference !== 'string') throw error('INVALID_ENGINE_RESULT', 'Identification result is not bound to this challenge', 403);
    await mongoose.connection.transaction(async session => {
      await actor(operator, session);
      await stationFor(stationToken, operator, session, { lock: true });
      const enrollment = await Enrollment.findOne({
        $or: [
          { member: result.memberId },
          { trainer: result.memberId },
          { user: result.memberId },
        ],
        enrollmentReference: result.enrollmentReference,
        isActive: true,
        enrollmentStatus: 'enrolled',
        schemaVersion: 2,
      }).session(session);
      if (!enrollment) throw error('ENROLLMENT_INACTIVE', 'The identified enrollment is no longer active', 403);
      const updated = await Verification.updateOne({ _id: verification._id, state: 'issued', expiresAt: { $gt: new Date() } },
        { $set: { state: 'verified', member: result.memberId, enrollmentReference: result.enrollmentReference } }, { session });
      if (!updated.modifiedCount) throw error('VERIFICATION_EXPIRED', 'Verification expired, was cancelled, or has already been used');
    });
    return { verified: true, eventId: verification.eventId, ...(result.diagnostics ? { search: { comparisons: result.diagnostics.comparisons, elapsedMs: result.diagnostics.elapsedMs } } : {}) };
  } finally { probe.fill(0); }
}

async function record({ stationToken, verificationToken, eventId }, operator) {
  await actor(operator);
  if (typeof eventId !== 'string' || !/^[0-9a-f-]{36}$/.test(eventId)) throw error('INVALID_EVENT', 'Use the server-issued event ID', 400);
  return mongoose.connection.transaction(async session => {
    await actor(operator, session);
    const now = new Date();
    const priorStation = await stationFor(stationToken, operator, session, { active: false, now });
    const verification = await verificationFor(verificationToken, priorStation, operator, session);
    if (verification.eventId !== eventId) throw error('EVENT_MISMATCH', 'Idempotency key does not match the verification', 409);
    if (verification.state === 'consumed') return verification.result;
    const station = await stationFor(stationToken, operator, session, { lock: true, now });
    if (verification.state !== 'verified' || verification.expiresAt <= now) throw error('UNTRUSTED_VERIFICATION', 'A fresh trusted identification is required', 403);

    // Resolve target person (Member, Trainer, or Reception user)
    let personType = 'member';
    let member = await Member.findOneAndUpdate({ _id: verification.member }, { $inc: { attendanceVersion: 1 } },
      { session, returnDocument: 'after' }).select('+lastBiometricPunchAt');
    let trainer = null;
    let userStaff = null;

    if (!member) {
      trainer = await TrainerProfile.findById(verification.member).session(session);
      if (trainer) {
        personType = 'trainer';
      } else {
        userStaff = await User.findById(verification.member).session(session);
        if (userStaff && userStaff.role !== 'admin') {
          personType = 'reception';
        }
      }
    }

    if (!member && !trainer && !userStaff) throw error('PERSON_NOT_FOUND', 'User record no longer exists', 404);

    const enrollment = await Enrollment.findOne({
      $or: [
        ...(member ? [{ member: member._id }] : []),
        ...(trainer ? [{ trainer: trainer._id }] : []),
        ...(userStaff ? [{ user: userStaff._id }] : []),
      ],
      enrollmentReference: verification.enrollmentReference,
      isActive: true,
      enrollmentStatus: 'enrolled',
      schemaVersion: 2,
    }).session(session);

    if (!enrollment) throw error('ENROLLMENT_INACTIVE', 'Enrollment is inactive or has changed', 403);

    const targetPersonId = member?._id || trainer?._id || userStaff?._id;
    const queryAttendance = {};
    if (personType === 'trainer') queryAttendance.trainer = targetPersonId;
    else if (personType === 'reception') queryAttendance.user = targetPersonId;
    else queryAttendance.member = targetPersonId;

    const latest = await Attendance.findOne(queryAttendance).sort({ checkInTime: -1 }).session(session);
    const lastAt = Math.max(
      member?.lastBiometricPunchAt?.getTime() || 0,
      latest?.checkInTime?.getTime() || 0,
      latest?.checkOutTime?.getTime() || 0
    );
    const remaining = Math.max(0, Math.ceil((lastAt + config.biometric.cooldownSeconds * 1000 - now.getTime()) / 1000));
    const latched = String(station.lastRecordedMember || '') === String(targetPersonId) && !station.sameMemberArmed;

    const fullName = member?.fullName || trainer?.fullName || userStaff?.name || 'Staff User';
    const personCode = member?.memberId || trainer?.trainerId || (personType === 'reception' ? 'STAFF' : '') || '';
    const avatarInitials = member?.avatarInitials || trainer?.avatarInitials || fullName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

    let result = {
      eventId, recorded: false, action: 'duplicate', timestamp: now.toISOString(),
      member: {
        id: String(targetPersonId),
        memberId: personCode,
        fullName: fullName,
        avatarInitials: avatarInitials,
        profilePicture: member?.profilePicture || null,
        personType: personType,
      },
      timeZone: config.gym.timezone,
    };

    if (remaining || latched) {
      result = { ...result, code: 'DUPLICATE_SCAN', retryAfterSeconds: remaining, requiresRemovalConfirmation: latched,
        message: 'Attendance already recorded - please remove your finger' };
    } else {
      const currentSession = getSessionName(now, config.gym.timezone);
      const dayBounds = gymDayBounds(now);

      let attendance = null;
      let openSession = await Attendance.findOne({ ...queryAttendance, sessionOpen: true }).session(session);

      if (openSession?.branch && openSession.branch !== config.gym.branchId) {
        throw error('BRANCH_MISMATCH', 'This open visit belongs to another branch and requires staff review', 403);
      }

      if (openSession && (openSession.attendanceDate < dayBounds.start || isSessionExpired(openSession, now, config.gym.timezone))) {
        const autoData = calculateAutoCheckout(openSession, now, config.gym.timezone);
        const autoPunch = {
          punchTime: autoData.checkOutTime,
          punchType: 'checkout',
          deviceId: 'AUTO_SESSION_END',
        };
        await Attendance.updateOne({ _id: openSession._id }, {
          $set: {
            checkOutTime: autoData.checkOutTime,
            sessionOpen: false,
            duration: autoData.duration,
            notes: [openSession.notes, autoData.notes].filter(Boolean).join('\n'),
            updatedAt: now,
          },
          $push: { punches: autoPunch },
        }, { session });
        openSession = null;
      }

      const stale = openSession && now.getTime() - openSession.checkInTime.getTime() >= config.biometric.staleHours * 3600000;
      if (stale && config.biometric.stalePolicy === 'review') {
        result = { ...result, action: 'review', code: 'STALE_SESSION', message: 'An old open visit needs receptionist review. Use the authorized manual checkout after review.' };
      } else {
        const punchRecord = {
          punchTime: now,
          punchType: 'punch',
          deviceId: 'MFS500',
          verificationReference: eventId,
          workstation: station.contextId,
          receptionist: operator,
        };

        const CHECKIN_GRACE_PERIOD_MS = 5 * 60 * 1000;

        if (openSession) {
          const elapsedMs = now.getTime() - new Date(openSession.checkInTime).getTime();

          if (elapsedMs < CHECKIN_GRACE_PERIOD_MS) {
            const remainingMinutes = Math.max(1, Math.ceil((CHECKIN_GRACE_PERIOD_MS - elapsedMs) / 60000));
            result = {
              ...result,
              recorded: false,
              action: 'duplicate',
              code: 'ALREADY_CHECKED_IN',
              sessionName: openSession.sessionName || currentSession,
              retryAfterSeconds: Math.max(1, Math.ceil((CHECKIN_GRACE_PERIOD_MS - elapsedMs) / 1000)),
              message: `Attendance already registered at ${new Date(openSession.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Check-out available in ${remainingMinutes} min.`,
            };
          } else {
            const duration = Math.max(1, Math.round(elapsedMs / 60000));
            punchRecord.punchType = 'checkout';
            const updated = await Attendance.findOneAndUpdate(
              { _id: openSession._id },
              {
                $set: {
                  checkOutTime: now,
                  sessionOpen: false,
                  duration,
                  checkOutVerificationReference: eventId,
                  checkOutWorkstation: station.contextId,
                  checkOutReceptionist: operator,
                  updatedAt: now,
                  ...(stale ? { staleSessionReviewedByPolicy: true } : {}),
                },
                $push: { punches: punchRecord },
              },
              { session, returnDocument: 'after' }
            );
            if (!updated) throw error('SESSION_CHANGED', 'Attendance changed. No biometric action was recorded.');
            attendance = updated;
            result.action = 'checkout';
            if (openSession.notes?.includes('Special opening')) {
              result.isSpecialHours = true;
            }
          }
        } else {
          // No currently open session.
          // Check if this person already attended and completed this session today (1 visit per session rule)
          const sessionRecord = await Attendance.findOne({
            ...queryAttendance,
            attendanceDate: dayBounds.start,
            sessionName: currentSession,
          }).session(session);

          if (sessionRecord) {
            // Already attended 1 time in this session today!
            const sessionLabel = currentSession.charAt(0).toUpperCase() + currentSession.slice(1);
            const checkOutStr = sessionRecord.checkOutTime 
              ? new Date(sessionRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            result = {
              ...result,
              recorded: false,
              action: 'duplicate',
              code: 'SESSION_ALREADY_COMPLETED',
              sessionName: currentSession,
              message: `Already attended the ${sessionLabel} session today${checkOutStr ? ` (completed at ${checkOutStr})` : ''}. 1 visit allowed per session (up to 3 sessions per day). Next session will be available soon!`,
            };
          } else {
            // First punch of this session today -> Check-in!
            let slotAllocation;
            let validatedMembership;
            let isSpecialHours = false;

            if (personType === 'member') {
              try {
                ({ slotAllocation, membership: validatedMembership, isSpecialHours } = await validateAttendanceAccess(member, now, session));
                if (validatedMembership) {
                  result.membership = {
                    planName: validatedMembership.membershipPlan?.name || 'Membership Plan',
                    startDate: validatedMembership.startDate,
                    endDate: validatedMembership.endDate,
                    status: validatedMembership.status,
                  };
                }
              } catch (failure) {
                if (!failure.member) {
                  failure.member = {
                    id: member._id,
                    memberId: member.memberId,
                    fullName: member.fullName,
                    profilePicture: member.profilePicture || null,
                    avatarInitials: member.avatarInitials || member.fullName?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'VF',
                  };
                }
                if (!failure.membership) {
                  const latestM = await MemberMembership.findOne({ member: member._id })
                    .populate('membershipPlan', 'name price duration')
                    .sort({ endDate: -1, createdAt: -1 })
                    .session(session);
                  if (latestM) {
                    failure.membership = {
                      planName: latestM.membershipPlan?.name || 'Membership Plan',
                      startDate: latestM.startDate,
                      endDate: latestM.endDate,
                      status: latestM.status,
                    };
                  }
                }
                throw Object.assign(failure, { code: failure.code || 'MEMBERSHIP_INELIGIBLE' });
              }
            }

            punchRecord.punchType = 'checkin';
            const checkInNotes = isSpecialHours ? 'Special opening time attendance' : undefined;
            const createDoc = {
              branch: config.gym.branchId,
              attendanceDate: dayBounds.start,
              checkInTime: now,
              checkOutTime: null,
              sessionOpen: true,
              sessionName: currentSession,
              duration: 0,
              punches: [punchRecord],
              verificationReference: eventId,
              checkInWorkstation: station.contextId,
              checkInReceptionist: operator,
              deviceId: 'MFS500',
              personType: personType,
              personName: fullName,
              personCode: personCode,
              notes: checkInNotes,
            };
            if (personType === 'trainer') createDoc.trainer = trainer._id;
            else if (personType === 'reception') createDoc.user = userStaff._id;
            else {
              createDoc.member = member._id;
              createDoc.slotAllocation = slotAllocation?._id;
            }

            [attendance] = await Attendance.create([createDoc], { session });
            result.action = 'checkin';
            result.isSpecialHours = Boolean(isSpecialHours);
          }
        }

        if (attendance) {
          const todayRecords = await Attendance.find({
            ...queryAttendance,
            attendanceDate: dayBounds.start,
          }).session(session);
          const dailySpending = calculateDailySpending(todayRecords);

          result.recorded = true;
          result.attendanceId = String(attendance._id);
          result.sessionName = attendance.sessionName || currentSession;
          result.durationMinutes = attendance.duration || 0;
          result.durationFormatted = formatDuration(attendance.duration || 0);
          result.punchesCount = attendance.punches?.length || 1;
          result.dailySpending = dailySpending;

          const sessionLabel = (attendance.sessionName || currentSession).charAt(0).toUpperCase() +
            (attendance.sessionName || currentSession).slice(1);
          if (result.action === 'checkin') {
            result.message = personType === 'trainer'
              ? `Trainer Check-in recorded. Welcome Coach ${fullName}!`
              : personType === 'reception'
              ? `Staff Check-in recorded. Welcome ${fullName}!`
              : result.isSpecialHours
              ? `Checked in (${sessionLabel} session - Special Opening Time)`
              : `Checked in (${sessionLabel} session)`;
          } else {
            const rolePrefix = personType === 'trainer' ? 'Trainer ' : personType === 'reception' ? 'Staff ' : '';
            result.message = `${rolePrefix}${result.updatedCheckout ? 'Check-out updated' : 'Check-out recorded'}: ${formatDuration(attendance.duration)} (${dailySpending.totalHoursFormatted} total today)`;
          }

          if (stale) result.staleSession = true;
          if (member?._id) {
            await Member.updateOne({ _id: member._id }, { $set: { lastBiometricPunchAt: now } }, { session });
          }
          await Station.updateOne({ _id: station._id }, { $set: { lastRecordedMember: targetPersonId, sameMemberArmed: false } }, { session });
          const counted = await Enrollment.updateOne({ _id: enrollment._id, enrollmentReference: verification.enrollmentReference },
            { $inc: { verificationCount: 1 }, $set: { lastVerificationDate: now } }, { session });
          if (!counted.modifiedCount) throw error('ENROLLMENT_CHANGED', 'Enrollment changed during recording');
        } else {
          await Station.updateOne({ _id: station._id }, { $set: { lastRecordedMember: targetPersonId, sameMemberArmed: false } }, { session });
        }
      }
    }
    await Verification.updateOne({ _id: verification._id, state: 'verified' }, { $set: { state: 'consumed', result } }, { session });
    await Audit.create([{ user: operator, action: 'biometric_' + result.action, entityType: 'attendance', entityId: targetPersonId,
      changes: { eventId, station: station.contextId, branch: config.gym.branchId, recorded: result.recorded, personType }, timestamp: now }], { session });
    return result;
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
}
async function overview() {
  const now = new Date(), cutoff = new Date(now.getTime() - config.biometric.staleHours * 3600000);
  await autoCloseExpiredAttendance(now);
  const [count, rows, stale] = await Promise.all([
    Attendance.countDocuments({ sessionOpen: true }),
    Attendance.find()
      .select('member trainer user personType personName personCode checkInTime checkOutTime')
      .populate('member', 'fullName memberId avatarInitials profilePicture')
      .populate('trainer', 'fullName trainerId avatarInitials')
      .populate('user', 'name email role')
      .sort({ updatedAt: -1 })
      .limit(20),
    Attendance.find({ sessionOpen: true, checkInTime: { $lte: cutoff } })
      .select('member trainer user personType personName personCode checkInTime')
      .populate('member', 'fullName memberId')
      .populate('trainer', 'fullName trainerId')
      .populate('user', 'name email')
      .sort({ checkInTime: 1 })
      .limit(20),
  ]);
  const events = rows.flatMap(row => {
    const pType = row.personType || (row.trainer ? 'trainer' : row.user ? 'reception' : 'member');
    const person = row.member || (row.trainer ? {
      fullName: row.trainer.fullName,
      memberId: row.trainer.trainerId,
      personType: 'trainer',
      avatarInitials: row.trainer.avatarInitials || row.trainer.fullName?.slice(0, 2).toUpperCase(),
    } : row.user ? {
      fullName: row.user.name || row.user.email,
      memberId: 'STAFF',
      personType: 'reception',
      avatarInitials: (row.user.name || row.user.email)?.slice(0, 2).toUpperCase(),
    } : { fullName: row.personName || 'User', memberId: row.personCode || '', personType: pType });

    return [
      { id: row.id + ':in', member: person, action: 'checkin', timestamp: row.checkInTime },
      ...(row.checkOutTime ? [{ id: row.id + ':out', member: person, action: 'checkout', timestamp: row.checkOutTime }] : []),
    ];
  }).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  return { currentlyPresent: count, events, staleSessions: stale, ...capabilities() };
}
module.exports = { capabilities, openStation, closeStation, closeOperatorStations, confirmRemoval, issueVerification, identify, record, overview, getCandidates };
