// Real cloud-save round trip against the configured backend.
//
// 1. Sign in, launch 2048 (a game with verified save support), write the game's
//    own progress key inside the game frame.
// 2. Wait for the 15-second changed-save sync, then confirm the row through the
//    backend API as the same account.
// 3. Open a fresh browser context for the same account and confirm the value is
//    restored before launch.
// 4. Open a different account and confirm the value never appears.
//
// Run: node --env-file=.env.local scripts/qa/check-cloud-save.mjs

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.GEEGLE_AUTH_BASE ?? 'http://127.0.0.1:5174';
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const A = { username: 'qauser1', password: 'GeegleTest123!', email: 'qauser1@users.geegle.internal' };
const B = { username: 'qauser2', password: 'GeegleTest123!', email: 'qauser2@users.geegle.internal' };
const PROBE = 'e2eProgress';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const api = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
const signed = await api.auth.signInWithPassword({ email: A.email, password: A.password });
check('backend session for the save check', !signed.error, signed.error?.message ?? '');
// Remove the earlier probe row so this run starts from a known state.
await api.from('geegle_game_saves').delete().eq('user_id', signed.data.user.id).eq('game_id', 'cl2048');

const browser = await chromium.launch();
async function newSignedIn(user) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + '/#games', { waitUntil: 'networkidle' });
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) await notice.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: /Sign in/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Username').fill(user.username);
  await dialog.getByLabel('Password').fill(user.password);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);
  return { context, page };
}

async function launchGame(page) {
  const search = page.getByRole('combobox', { name: 'Search games' });
  await search.fill('2048');
  await search.press('Enter');
  await page.waitForTimeout(300);
  await page.locator('[data-card]').filter({ hasText: /^2048$/ }).locator('button').first().click();
  await page.waitForSelector('iframe', { timeout: 30_000 });
  await page.waitForTimeout(2500);
  return page.frames().find((frame) => frame.url().includes('cl2048.html'));
}

try {
  const { context: contextA, page: pageA } = await newSignedIn(A);
  const probe = `progress-${Date.now()}`;
  const frameA = await launchGame(pageA);
  check('game frame loads for the signed-in account', Boolean(frameA));
  await frameA.evaluate(([key, value]) => localStorage.setItem(key, value), [PROBE, probe]);

  // Automatic sync saves changed progress on its 15-second tick.
  await pageA.waitForTimeout(18_000);

  const row = await api.from('geegle_game_saves').select('game_id,save_data,revision').eq('game_id', 'cl2048').maybeSingle();
  const keys = row.data ? Object.keys(row.data.save_data?.localStorage ?? {}) : [];
  check('changed progress is saved to the account automatically', keys.includes(PROBE), JSON.stringify(keys));
  check('the saved value matches the game', Boolean(row.data) && JSON.stringify(row.data.save_data).includes(probe));

  // Same account in a fresh browser context: restore before launch.
  const { context: contextB, page: pageB } = await newSignedIn(A);
  const frameB = await launchGame(pageB);
  const restored = frameB ? await frameB.evaluate((key) => localStorage.getItem(key), PROBE) : null;
  check('a fresh browser restores the value for the same account', restored === probe, String(restored));

  // Different account: no leakage.
  const { context: contextC, page: pageC } = await newSignedIn(B);
  const frameC = await launchGame(pageC);
  const leaked = frameC ? await frameC.evaluate((key) => localStorage.getItem(key), PROBE) : null;
  check('a different account does not receive the value', leaked === null, String(leaked));

  for (const context of [contextA, contextB, contextC]) await context.close();
} catch (error) {
  results.push({ name: 'cloud-save journey threw', ok: false, detail: error instanceof Error ? error.message : String(error) });
} finally {
  await browser.close();
  await api.auth.signOut();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} cloud-save checks passed`);
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
if (failed.length) process.exitCode = 1;
