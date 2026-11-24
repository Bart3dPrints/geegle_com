// PBKDF2-SHA256 hashing for the site entry password, shared by the Edge Function.
// 600k iterations (OWASP guidance for PBKDF2), 32-byte output, per-deployment salt.

export const PBKDF2_ITERATIONS = 600_000;
export const KEY_LENGTH_BYTES = 32;

export async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH_BYTES * 8
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
