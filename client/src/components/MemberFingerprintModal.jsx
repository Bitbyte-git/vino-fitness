import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2, CheckCircle2, X, Trash2, ShieldCheck, AlertTriangle, Scan } from 'lucide-react';
import api from '../services/api';
import { getInitials } from '../utils/avatar';
import { createMorFinAuth } from '../services/morfinAuth.mjs';
import { assertNoDuplicateCapture } from '../utils/biometricDuplicateCheck';

const fingers = [
  'right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little',
  'left_thumb', 'left_index', 'left_middle', 'left_ring', 'left_little'
];

const errorText = e => e.response?.data?.error || e.message || 'Biometric operation failed';
const personLabel = type => type === 'trainer' ? 'trainer' : type === 'reception' ? 'staff member' : 'member';

export default function MemberFingerprintModal({ member, user, onClose, onUpdated }) {
  const [finger, setFinger] = useState('right_index');
  const [capture, setCapture] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [capability, setCapability] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const operation = useRef(null);
  const alive = useRef(true);
  const adapter = useRef(null);

  const personType = member.role === 'reception'
    ? 'reception'
    : (member.trainerId || member.specialization)
    ? 'trainer'
    : 'member';

  const personParams = {
    personType,
    ...(personType === 'trainer' ? { trainerId: member._id } : personType === 'reception' ? { userId: member._id } : { memberId: member._id }),
  };

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; operation.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingStatus(true);
    Promise.all([
      api.get('/biometrics/status', { signal: controller.signal }),
      api.get('/biometrics/enrollment', { params: personParams, signal: controller.signal }),
    ])
      .then(([capRes, enrRes]) => {
        if (!alive.current) return;
        setCapability(capRes.data.data);
        const enr = enrRes.data.data?.enrollment || null;
        setEnrollment(enr);
        if (enr?.fingerPosition) setFinger(enr.fingerPosition);
      })
      .catch(e => { if (!controller.signal.aborted && alive.current) setError(errorText(e)); })
      .finally(() => { if (alive.current) setLoadingStatus(false); });
    return () => controller.abort();
  }, [member._id]);

  function localAdapter() {
    if (!adapter.current) {
      adapter.current = createMorFinAuth({
        baseUrl: import.meta.env.VITE_MANTRA_SERVICE_URL || 'https://localhost:8030/morfinauth',
      });
    }
    return adapter.current;
  }

  async function run(task) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await task(controller.signal);
    } catch (e) {
      if (alive.current && !controller.signal.aborted) setError(errorText(e));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (alive.current) setBusy(false);
    }
  }

  const scan = () => run(async signal => {
    setCapture(null);
    await api.post('/biometrics/enroll/initialize', personParams, { signal });
    const data = await localAdapter().capture({ signal });
    if (signal.aborted || !alive.current) return;
    setMessage('Checking for duplicate fingerprints across profiles...');
    await assertNoDuplicateCapture({ adapter: localAdapter(), captureData: data, targetMemberId: member._id, signal });
    if (!signal.aborted && alive.current) {
      setCapture(data);
      setMessage('Capture verified (unique fingerprint). Review scan quality and click "Save fingerprint".');
    }
  });

  const save = () => run(async signal => {
    const result = await api.post('/biometrics/enroll/process', {
      ...personParams,
      fingerPosition: finger,
      captureData: capture,
      ...(enrollment ? { replaceEnrollmentReference: enrollment.enrollmentReference } : {}),
    }, { signal });
    if (!signal.aborted && alive.current) {
      setEnrollment(result.data.data);
      setCapture(null);
      setMessage(enrollment ? 'Fingerprint updated successfully.' : 'Fingerprint enrolled successfully.');
      onUpdated?.();
    }
  });

  const remove = () => run(async signal => {
    await api.delete('/biometrics/enrollment', { data: personParams, signal });
    if (!signal.aborted && alive.current) {
      setEnrollment(null);
      setCapture(null);
      setDeleteConfirm(false);
      setMessage('Fingerprint enrollment deleted.');
      onUpdated?.();
    }
  });

  const displayName = member.fullName || member.name || member.email || 'User';
  const displayCode = member.memberId || member.trainerId || (personType === 'reception' ? 'STAFF' : '');
  const initials = displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const roleBadgeClass = personType === 'trainer' ? 'role-badge-trainer' : personType === 'reception' ? 'role-badge-staff' : 'role-badge-member';
  const roleBadgeText = personType === 'trainer' ? 'TRAINER' : personType === 'reception' ? 'STAFF' : 'MEMBER';

  return (
    <div className="operation-modal" role="dialog" aria-modal="true" aria-label={`Manage fingerprint for ${displayName}`}>
      <div className="fp-modal-card">
        {/* Close button */}
        <button type="button" className="operation-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {/* Header */}
        <div className="fp-modal-header">
          <div className="fp-modal-person-row">
            <div className={`fp-modal-avatar ${personType === 'trainer' ? 'trainer-avatar' : personType === 'reception' ? 'staff-avatar' : ''}`}>
              {member.profilePicture ? (
                <img
                  src={member.profilePicture}
                  alt={displayName}
                  onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex'; }}
                />
              ) : (
                <span>{getInitials(displayName, initials)}</span>
              )}
            </div>
            <div className="fp-modal-person-info">
              <div className="fp-modal-tag-row">
                <span className={`attendee-role-badge ${roleBadgeClass}`}>{roleBadgeText}</span>
                {displayCode && <span className="member-id-capsule">{displayCode}</span>}
              </div>
              <h2 className="fp-modal-person-name">{displayName}</h2>
            </div>
          </div>
          <div className="fp-modal-title-row">
            <Fingerprint size={20} className="fp-modal-title-icon" />
            <div>
              <h3 className="fp-modal-title">{enrollment ? 'Replace Fingerprint' : 'Enroll Fingerprint'}</h3>
              <p className="fp-modal-subtitle">
                {enrollment
                  ? `Scan a new fingerprint to replace the existing enrollment for this ${personLabel(personType)}.`
                  : `Capture and save a biometric fingerprint for this ${personLabel(personType)}.`}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="fp-modal-body">
          {loadingStatus ? (
            <div className="fp-modal-loading">
              <Loader2 size={20} className="animate-spin" />
              <span>Checking biometric enrollment status…</span>
            </div>
          ) : (
            <>
              {/* Current enrollment status card */}
              {enrollment ? (
                <div className="fp-modal-status-card enrolled">
                  <div className="fp-status-icon-row">
                    <CheckCircle2 size={16} />
                    <strong>Active Fingerprint Enrolled</strong>
                  </div>
                  <p className="fp-status-meta">
                    Position: <strong>{enrollment.fingerPosition?.replaceAll('_', ' ').toUpperCase() || 'RIGHT INDEX'}</strong>
                    <span className="fp-status-sep">•</span>
                    Enrolled: <strong>{new Date(enrollment.enrollmentDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  </p>
                </div>
              ) : (
                <div className="fp-modal-status-card not-enrolled">
                  <div className="fp-status-icon-row">
                    <ShieldCheck size={16} />
                    <strong>No fingerprint enrolled yet</strong>
                  </div>
                  <p className="fp-status-meta">
                    Select a finger position and capture a live scan to enable biometric attendance for this {personLabel(personType)}.
                  </p>
                </div>
              )}

              {/* Finger position selector */}
              <div className="fp-modal-field">
                <label className="fp-field-label">FINGER POSITION</label>
                <select
                  value={finger}
                  disabled={busy}
                  onChange={e => { setFinger(e.target.value); setCapture(null); }}
                  className="fp-field-select"
                >
                  {fingers.map(f => (
                    <option key={f} value={f}>
                      {f.replaceAll('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Storage warning */}
              {capability && !capability.enrollmentStorage && (
                <div className="fp-modal-alert warning">
                  <AlertTriangle size={15} />
                  <span>Enrollment storage needs a backend encryption key before captures can be saved.</span>
                </div>
              )}

              {/* Capture button */}
              <div className="fp-modal-actions-row">
                <button
                  type="button"
                  className="lime-btn fp-capture-btn"
                  disabled={busy || !capability?.enrollmentStorage}
                  onClick={scan}
                >
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <Scan size={16} />}
                  <span>{capture ? 'Scan Again' : enrollment ? 'Scan New Fingerprint' : 'Capture Fingerprint'}</span>
                </button>
                {capture && (
                  <button
                    type="button"
                    className="ghost-btn fp-clear-btn"
                    disabled={busy}
                    onClick={() => { setCapture(null); setMessage(''); }}
                  >
                    Clear capture
                  </button>
                )}
              </div>

              {/* Capture preview */}
              {capture && (
                <div className="fp-modal-preview-card">
                  <div className="fp-preview-image-wrap">
                    <img src={'data:image/bmp;base64,' + capture.imageBase64} alt="Captured fingerprint" />
                  </div>
                  <div className="fp-preview-details">
                    <div className="fp-preview-quality">
                      <span className="fp-quality-label">Scan Quality</span>
                      <span className="fp-quality-value">{capture.quality}<small>/100</small></span>
                    </div>
                    <p className="fp-preview-device">
                      Device: {capture.deviceModel || 'MFS500'} • Template verified unique
                    </p>
                    <button type="button" className="lime-btn fp-save-btn" disabled={busy} onClick={save}>
                      <CheckCircle2 size={15} />
                      <span>{enrollment ? 'Replace & Save' : 'Save Fingerprint'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Delete section (admin only) */}
              {enrollment && user?.role === 'admin' && (
                <div className="fp-modal-danger-zone">
                  {deleteConfirm ? (
                    <div className="fp-delete-confirm">
                      <span className="fp-delete-warning">Permanently delete this fingerprint enrollment?</span>
                      <div className="fp-delete-btns">
                        <button type="button" className="outline-btn btn-destructive" disabled={busy} onClick={remove}>
                          <Trash2 size={13} /> Confirm Delete
                        </button>
                        <button type="button" className="ghost-btn" disabled={busy} onClick={() => setDeleteConfirm(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="outline-btn btn-destructive fp-delete-trigger" disabled={busy} onClick={() => setDeleteConfirm(true)}>
                      <Trash2 size={14} /> Delete Fingerprint
                    </button>
                  )}
                </div>
              )}

              {/* Feedback messages */}
              {message && <div className="fp-modal-alert success"><CheckCircle2 size={15} /><span>{message}</span></div>}
              {error && <div className="fp-modal-alert error"><AlertTriangle size={15} /><span>{error}</span></div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
