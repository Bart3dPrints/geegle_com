// Verifies the real password-change path against the configured backend.
// Uses the same supabase-js client the app uses. Restores the original
// password at the end so the shared test account keeps working.
//
// Run: node --env-file=.env.local scripts/qa/check-password-change.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const USERNAME = 'qauser1';
const PASSWORD = 'GeegleTest123!';
const TEMPORARY = 'GeegleTemp456!';
const email = `${USERNAME}@users.geegle.internal`;

const client = createClient(url, key, { auth: { persistSession: false } });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const first = await client.auth.signInWithPassword({ email, password: PASSWORD });
check('original password signs in', !first.error, first.error?.message ?? '');

const update = await client.auth.updateUser({ password: TEMPORARY });
check('password update succeeds on the signed-in session', !update.error, update.error?.message ?? '');

await client.auth.signOut();
const oldPassword = await client.auth.signInWithPassword({ email, password: PASSWORD });
check('old password is rejected after the change', Boolean(oldPassword.error), oldPassword.error?.message ?? '');

const newPassword = await client.auth.signInWithPassword({ email, password: TEMPORARY });
check('new password signs in', !newPassword.error, newPassword.error?.message ?? '');

const restore = await client.auth.updateUser({ password: PASSWORD });
check('original password restored', !restore.error, restore.error?.message ?? '');

const final = await client.auth.signInWithPassword({ email, password: PASSWORD });
check('restored password signs in', !final.error, final.error?.message ?? '');
await client.auth.signOut();

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
if (results.some((result) => !result.ok)) process.exitCode = 1;
