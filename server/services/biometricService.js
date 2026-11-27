const { randomUUID, createHash } = require('node:crypto');
const BiometricEnrollment = require('../models/BiometricEnrollment');
const MemberProfile = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const User = require('../models/User');
const config = require('../config/env');
const engine = require('./identificationEngine');
const localIdentifier = require('./localMorFinIdentifier');
const { encrypt, decrypt, keyFor } = require('./biometricCrypto');
const { validateCapture, fail } = require('./biometricValidation');

const matcherMessage = 'Biometric attendance is unavailable: a documented backend matcher or authenticated trusted local agent is required. Browser match results are not accepted.';
const dto = e => e ? ({
  _id: e._id, member: e.member, trainer: e.trainer, user: e.user,
  personType: e.personType || 'member', personName: e.personName, personCode: e.personCode,
  enrollmentReference: e.enrollmentReference,
  fingerPosition: e.fingerPosition, enrollmentStatus: e.enrollmentStatus,
  isActive: e.isActive, enrollmentDate: e.enrollmentDate,
  lastVerificationDate: e.lastVerificationDate, verificationCount: e.verificationCount,
  deviceModel: e.deviceModel, deviceSerial: e.deviceSerial,
  templateFormat: e.templateFormat, imageFormat: e.imageFormat,
  quality: e.quality, nfiq: e.nfiq, schemaVersion: e.schemaVersion,
}) : null;

// Device discovery belongs to the capture workstation's browser, never backend localhost.
const capabilities = () => {
  let enrollmentStorage = false;
  try { keyFor(config.biometric.keyVersion); enrollmentStorage = true; } catch {}
  return { deviceType: 'Mantra MFS500', deviceAvailable: null, captureLocation: 'browser',
    enrollmentStorage, retainImages: config.biometric.retainImages,
    verificationAvailable: engine.available(), identificationAvailable: engine.available(),
    message: engine.available() ? 'Local development matching is available in the staff attendance screen.' : engine.status().reason };
};
const checkMorFinAuthAvailability = async () => capabilities();

function personQuery(person) {
  if (!person) return { member: null };
  if (typeof person === 'string' || person instanceof require('mongoose').Types.ObjectId) {
    return { member: person };
  }
  if (person.type === 'trainer') return { trainer: person.id };
  if (person.type === 'reception') return { user: person.id };
  return { member: person.id };
}

const initializeCapture = async person => {
  if (!capabilities().enrollmentStorage) fail('Backend biometric encryption keys are not configured', 503);
  const q = personQuery(person);
  const existing = await BiometricEnrollment.findOne(q);
  return { ...capabilities(), existingEnrollment: dto(existing) };
};

async function assertNoDuplicateFingerprint(person, template, templateHash) {
  const notSelf = {};
  const pId = person?.id || person;
  if (person?.type === 'trainer') notSelf.trainer = { $ne: pId };
  else if (person?.type === 'reception') notSelf.user = { $ne: pId };
  else notSelf.member = { $ne: pId };

  const hashDuplicate = await BiometricEnrollment.findOne({
    ...notSelf,
    isActive: true,
    enrollmentStatus: 'enrolled',
    templateHash,
  }).populate('member', 'fullName memberId').populate('trainer', 'fullName trainerId').populate('user', 'name email');

  if (hashDuplicate) {
    const owner = hashDuplicate.personName || hashDuplicate.member?.fullName || hashDuplicate.trainer?.fullName || hashDuplicate.user?.name || 'another user';
    const code = hashDuplicate.personCode || hashDuplicate.member?.memberId || hashDuplicate.trainer?.trainerId || '';
    fail(`Duplicate fingerprint detected: this fingerprint is already enrolled for ${owner}${code ? ` (${code})` : ''}.`, 409);
  }

  if (localIdentifier.available()) {
    const others = await BiometricEnrollment.find({
      ...notSelf,
      isActive: true,
      enrollmentStatus: 'enrolled',
      schemaVersion: 2,
      templateFormat: 'FMR_V2005',
    })
      .select('member trainer user personName personCode enrollmentReference +encryptedTemplate')
      .populate('member', 'fullName memberId')
      .populate('trainer', 'fullName trainerId')
      .populate('user', 'name email')
      .limit(config.biometric.searchMaxCandidates)
      .lean();

    const probeBase64 = template.toString('base64');
    for (const row of others) {
      const targetId = row.member?._id || row.trainer?._id || row.user?._id || row.member || row.trainer || row.user;
      if (!row.encryptedTemplate || !targetId) continue;
      let gallery;
      try {
        gallery = decrypt(row.encryptedTemplate, String(targetId) + ':' + row.enrollmentReference + ':template');
        const result = await localIdentifier.postVendor(
          config.biometric,
          'verify',
          { ProbTemplate: probeBase64, GalleryTemplate: gallery.toString('base64'), TmpFormat: 0 },
          2000
        );
        if (result?.Status === true) {
          const owner = row.personName || row.member?.fullName || row.trainer?.fullName || row.user?.name || 'another user';
          const code = row.personCode || row.member?.memberId || row.trainer?.trainerId || '';
          fail(`Duplicate fingerprint detected: this fingerprint is already enrolled for ${owner}${code ? ` (${code})` : ''}.`, 409);
        }
      } catch (err) {
        if (err.statusCode === 409) throw err;
      } finally {
        gallery?.fill(0);
      }
    }
  }
}

async function processEnrollment(person, captureData, { fingerPosition, operatorId, replaceEnrollmentReference } = {}) {
  const { template, image, deviceSerial } = validateCapture(captureData, fingerPosition);
  try {
    if (!capabilities().enrollmentStorage) fail('Backend biometric encryption keys are not configured', 503);
    const pId = person?.id || person;
    const pType = person?.type || 'member';
    const pName = person?.name || '';
    const pCode = person?.code || '';

    const templateHash = createHash('sha256').update(template).digest('hex');
    await assertNoDuplicateFingerprint(person, template, templateHash);
    const reference = randomUUID();
    const context = String(pId) + ':' + reference;
    const values = {
      enrollmentReference: reference, deviceId: deviceSerial,
      encryptedTemplate: encrypt(template, context + ':template'),
      templateHash,
      fingerPosition, templateFormat: captureData.templateFormat,
      quality: captureData.quality, nfiq: captureData.nfiq,
      deviceModel: captureData.deviceModel, deviceSerial,
      imageWidth: captureData.imageWidth, imageHeight: captureData.imageHeight,
      capturedAt: new Date(captureData.capturedAt), enrolledBy: operatorId,
      enrollmentDate: new Date(), enrollmentStatus: 'enrolled', isActive: true,
      verificationCount: 0, schemaVersion: 2,
      personType: pType, personName: pName, personCode: pCode,
    };
    if (pType === 'trainer') values.trainer = pId;
    else if (pType === 'reception') values.user = pId;
    else values.member = pId;

    if (image && config.biometric.retainImages) {
      values.encryptedImage = encrypt(image, context + ':image');
      values.imageFormat = captureData.imageFormat;
    }

    const q = personQuery(person);
    let enrollment;
    if (replaceEnrollmentReference !== undefined) {
      if (typeof replaceEnrollmentReference !== 'string' || !replaceEnrollmentReference) fail('The existing enrollment reference is required for replacement');
      enrollment = await BiometricEnrollment.findOneAndUpdate(
        { ...q, enrollmentReference: replaceEnrollmentReference },
        { $set: values, $unset: { enrollmentData: 1, ...(!values.encryptedImage ? { encryptedImage: 1, imageFormat: 1 } : {}), lastVerificationDate: 1 }, $inc: { revision: 1 } },
        { returnDocument: 'after', runValidators: true });
      if (!enrollment) fail('Enrollment changed; reload before replacing it', 409);
    } else {
      if (await BiometricEnrollment.exists(q)) fail('This account already has an enrollment; explicitly replace the current reference', 409);
      enrollment = await BiometricEnrollment.create(values);
    }
    return dto(enrollment);
  } finally { template.fill(0); image?.fill(0); }
}

// No matcher credentials, thresholds, endpoints or success path are invented.
const verifyFingerprint = async () => ({ success: false, unavailable: true, code: 'MATCHER_UNAVAILABLE', message: matcherMessage });

async function getMemberByEnrollment(enrollmentReference) {
  const enrollment = await BiometricEnrollment.findOne({ enrollmentReference, enrollmentStatus: 'enrolled', isActive: true }).populate('member');
  if (!enrollment?.member) fail('No active enrollment found', 404);
  return enrollment.member;
}

async function deleteEnrollment(person) {
  const q = personQuery(person);
  const enrollment = await BiometricEnrollment.findOneAndDelete(q);
  if (!enrollment) fail('No enrollment found for this user', 404);
  return { success: true, message: 'Enrollment and retained biometric material deleted' };
}
module.exports = { capabilities, dto, checkMorFinAuthAvailability,
  initializeCapture, processEnrollment, verifyFingerprint, getMemberByEnrollment, deleteEnrollment };
