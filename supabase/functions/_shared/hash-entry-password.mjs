#!/usr/bin/env node
// Generates the PBKDF2-SHA256 hash + salt for the Geegle site entry password.
// The hash is stored ONLY as a Supabase Edge Function secret — never in the
// repository, never in frontend code.
//
// Usage:
//   node supabase/functions/_shared/hash-entry-password.mjs <password>
//
// Then set the secrets on your Supabase project:
//   supabase secrets set ENTRY_PASSWORD_HASH='<hash>' ENTRY_SALT='<salt>'

import { pbkdf2, randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error(
    'Usage: node supabase/functions/_shared/hash-entry-password.mjs <password>'
  );
  process.exit(1);
}

const salt = randomBytes(16);
const derived = pbkdf2(password, salt, 600000, 32, 'sha256');

console.log('Run these commands on your Supabase project:');
console.log('');
console.log(
  `supabase secrets set ENTRY_PASSWORD_HASH='${derived.toString('base64')}'`
);
console.log(`supabase secrets set ENTRY_SALT='${salt.toString('base64')}'`);
