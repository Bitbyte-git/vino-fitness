/**
 * Hashes a plaintext password using browser-native SHA-256 before network transmission.
 * Ensures plaintext passwords are never visible in DevTools Network tab payloads or request traces.
 */
export async function hashPassword(plain) {
  if (!plain) return '';
  if (typeof plain !== 'string') return '';
  // If already a 64-character hex string (SHA-256), return as is
  if (/^[a-f0-9]{64}$/i.test(plain)) {
    return plain.toLowerCase();
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
