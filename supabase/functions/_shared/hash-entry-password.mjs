#!/usr/bin/env node
// Generates the PBKDF2 hash for the site entry password.
//
// Usage:  node supabase/functions/_shared/hash-entry-password.mjs pirate
// Output: ENTRY_PASSWORD_HASH=...  ENTRY_SALT=...
//
// Then:  supabase secrets set ENTRY_PASSWORD_HASH=... ENTRY_SALT=...
//
// The password never appears in the repository or client bundle.
// Run from the repository root so relative imports resolve.

const password = process.argv[2];
if (!password) {
  console.error('Usage: node supabase/functions/_shared/hash-entry-password.mjs <password>');
  process.exit(1);
}

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH_BYTES = 32;

const encoder = new TextEncoder();
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  encoder.encode(password),
  'PBKDF2',
  false,
  ['deriveBits']
);
const salt = crypto.randomUUID();
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
const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));

console.log('ENTRY_PASSWORD_HASH=' + hash);
console.log('ENTRY_SALT=' + salt);
console.log('\nApply with:');
console.log('  supabase secrets set ENTRY_PASSWORD_HASH=... ENTRY_SALT=...');
