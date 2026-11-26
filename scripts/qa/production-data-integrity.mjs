// Production data integrity: save revisions and cross-account isolation,
// verified against the live production Supabase project with real sessions.
//
// 1. Revision rotation: a new save gets a revision; the next write rotates it;
//    a write carrying a stale revision must match zero rows (this is exactly
//    the conflict signal in src/lib/cloudSaves.ts).
// 2. Ownership: an account cannot read, insert, update or delete another
//    account's rows, and the payload's user id is never trusted.
//
// Uses randomized disposable accounts. Nothing is mocked.
//
// Run: node --env-file=.env.prod.local scripts/qa/production-data-integrity.mjs

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (use --env-file).');
  process.exit(1);
}

const tag = randomBytes(4).toString('hex');
const makePassword = () => `${randomBytes(12).toString('base64url')}Aa1!`;
const A = { username: `ia${tag}`, password: makePassword() };
const B = { username: `ib${tag}`, password: makePassword() };
const GAME = 'integrity-probe';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function signUp(user) {
  const client = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `${user.username}@users.geegle.internal`,
    password: user.password,
    options: { data: { username: user.username } },
  });
  if (error || !data.session) throw new Error(`sign-up failed for ${user.username}: ${error?.message ?? 'no session'}`);
  return { client, id: data.user.id };
}

try {
  const a = await signUp(A);
  const b = await signUp(B);
  check('two disposable accounts exist on production', Boolean(a.id && b.id));

  // --- Revision rotation and stale-write rejection -------------------------
  const first = await a.client
    .from('geegle_game_saves')
    .upsert({ user_id: a.id, game_id: GAME, save_key: 'default', save_data: { progress: 1 } }, { onConflict: 'user_id,game_id,save_key' })
    .select('revision,updated_at')
    .single();
  check('a new save receives a revision', Boolean(first.data?.revision), first.error?.message ?? '');

  const r1 = first.data?.revision;
  const second = await a.client
    .from('geegle_game_saves')
    .update({ save_data: { progress: 2 } })
    .match({ user_id: a.id, game_id: GAME, save_key: 'default', revision: r1 })
    .select('revision,updated_at')
    .maybeSingle();
  check(
    'an accepted write rotates the revision',
    Boolean(second.data?.revision) && second.data.revision !== r1,
    `${String(r1).slice(0, 8)} -> ${String(second.data?.revision).slice(0, 8)}`
  );
  check(
    'the accepted write refreshes updated_at',
    new Date(second.data?.updated_at ?? 0).getTime() >= new Date(first.data?.updated_at ?? 0).getTime()
  );

  const stale = await a.client
    .from('geegle_game_saves')
    .update({ save_data: { progress: 999 } })
    .match({ user_id: a.id, game_id: GAME, save_key: 'default', revision: r1 })
    .select('revision')
    .maybeSingle();
  check(
    'a stale revision is rejected (conflict signal)',
    stale.data === null && !stale.error,
    stale.error ? stale.error.message : 'no row matched'
  );

  const afterStale = await a.client
    .from('geegle_game_saves')
    .select('save_data')
    .match({ user_id: a.id, game_id: GAME, save_key: 'default' })
    .maybeSingle();
  check(
    'the stale write did not overwrite newer progress',
    afterStale.data?.save_data?.progress === 2,
    JSON.stringify(afterStale.data?.save_data)
  );

  // --- Cross-account isolation with real rows in place ---------------------
  const bSeed = await b.client
    .from('geegle_favorites')
    .upsert({ user_id: b.id, game_id: GAME }, { onConflict: 'user_id,game_id' })
    .select('game_id');
  check('account B has a real favorite row to protect', Boolean(bSeed.data?.length), bSeed.error?.message ?? '');

  const bSave = await b.client
    .from('geegle_game_saves')
    .upsert({ user_id: b.id, game_id: GAME, save_key: 'default', save_data: { owner: 'B' } }, { onConflict: 'user_id,game_id,save_key' })
    .select('revision');
  check('account B has a real save row to protect', Boolean(bSave.data?.length), bSave.error?.message ?? '');

  const readB = await a.client.from('geegle_favorites').select('game_id').eq('user_id', b.id);
  check('A cannot read B favorites', (readB.data ?? []).length === 0, `rows=${(readB.data ?? []).length}`);

  const readBSaves = await a.client.from('geegle_game_saves').select('game_id').eq('user_id', b.id);
  check('A cannot read B saves', (readBSaves.data ?? []).length === 0, `rows=${(readBSaves.data ?? []).length}`);

  const readBProfile = await a.client.from('geegle_profiles').select('username').eq('id', b.id);
  check('A cannot read B profile', (readBProfile.data ?? []).length === 0, `rows=${(readBProfile.data ?? []).length}`);

  const readBSettings = await a.client.from('geegle_user_settings').select('theme').eq('id', b.id);
  check('A cannot read B preferences', (readBSettings.data ?? []).length === 0, `rows=${(readBSettings.data ?? []).length}`);

  const writeB = await a.client
    .from('geegle_favorites')
    .insert({ user_id: b.id, game_id: 'stolen' })
    .select();
  check('A cannot insert a row owned by B', Boolean(writeB.error), writeB.error?.code ?? 'no error');

  const writeBSave = await a.client
    .from('geegle_game_saves')
    .insert({ user_id: b.id, game_id: 'stolen', save_data: { stolen: true } })
    .select();
  check('A cannot insert a save owned by B', Boolean(writeBSave.error), writeBSave.error?.code ?? 'no error');

  const patchBSettings = await a.client
    .from('geegle_user_settings')
    .update({ theme: 'dark' })
    .eq('id', b.id)
    .select();
  check('A cannot modify B preferences', (patchBSettings.data ?? []).length === 0, `rows=${(patchBSettings.data ?? []).length}`);

  const patchBSave = await a.client
    .from('geegle_game_saves')
    .update({ save_data: { stolen: true } })
    .eq('user_id', b.id)
    .select();
  check('A cannot modify B saves', (patchBSave.data ?? []).length === 0, `rows=${(patchBSave.data ?? []).length}`);

  const deleteB = await a.client.from('geegle_favorites').delete().eq('user_id', b.id).select();
  check('A cannot delete B favorites', (deleteB.data ?? []).length === 0, `rows=${(deleteB.data ?? []).length}`);

  // Clean up the probe rows so the accounts stay tidy.
  await a.client.from('geegle_game_saves').delete().eq('user_id', a.id).eq('game_id', GAME);
  await b.client.from('geegle_game_saves').delete().eq('user_id', b.id).eq('game_id', GAME);
  await b.client.from('geegle_favorites').delete().eq('user_id', b.id).eq('game_id', GAME);
} catch (error) {
  check('data integrity journey threw', false, error instanceof Error ? error.message : String(error));
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} production data-integrity checks passed`);
console.log(`accounts created: ${A.username}, ${B.username} (random disposable credentials, not recorded)`);
process.exit(failed.length ? 1 : 0);
