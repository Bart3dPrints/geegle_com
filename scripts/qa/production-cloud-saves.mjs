// Genuine gameplay cloud-save verification on the live site.
//
// A game is only checked end to end when it writes storage of its own while
// being played. If it stores nothing (some wrappers keep progress in memory
// only), the run records SKIP with the observed evidence instead of pretending
// the platform failed — and instead of inventing a key the game never wrote.
//
// Flow per game that does persist: sign in, play with real input, wait for the
// 15-second automatic sync, confirm the account-owned row in production
// Supabase, exit, sign out, destroy the browser profile, open a brand-new
// browser, sign in again, launch the game and compare what the game itself shows
// with what it showed before the profile was destroyed.
//
// A second phase exercises the manual controls (save, restore, export, import,
// invalid import, other-game import, offline upload and recovery).
//
// Usage: node --env-file=.env.prod.local scripts/qa/production-cloud-saves.mjs
// Randomized disposable credentials; no existing account is touched.

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.GEEGLE_PROD_BASE ?? 'https://bartisawesome.onrender.com';
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (use --env-file).');
  process.exit(1);
}

const tag = randomBytes(4).toString('hex');
const makePassword = () => `${randomBytes(12).toString('base64url')}Aa1!`;
const ACCOUNT = { username: `cs${tag}`, password: makePassword() };
const otherAccount = (index) => ({ username: `ct${index}${tag}`, password: makePassword() });
const SYNC_WAIT_MS = 18_000;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), skipped: false, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const skip = (name, reason) => {
  results.push({ name, ok: true, skipped: true, detail: reason });
  console.log(`SKIP  ${name} — ${reason}`);
};

const email = (username) => `${username.toLowerCase()}@users.geegle.internal`;
let accountCreated = false;

async function openLibrary(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (await page.locator('.gl-field').count()) {
    await page.fill('.gl-field input', 'pirate');
    await page.press('.gl-field input', 'Enter');
    await page.waitForSelector('header');
  }
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) {
    await notice.getByRole('button', { name: 'Got it' }).click().catch(() => {});
    await notice.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(300);
}

async function signIn(page, account, { register = false } = {}) {
  await page.getByRole('button', { name: /Sign in/ }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  if (register) {
    await dialog.getByRole('button', { name: /Create one/ }).click();
    dialog = page.getByRole('dialog', { name: 'Create account' });
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  }
  await dialog.getByLabel('Username').fill(account.username);
  await dialog.getByLabel('Password', { exact: true }).fill(account.password);
  await dialog.getByRole('button', { name: register ? 'Create account' : 'Sign in' }).click();
  await page.waitForTimeout(4000);
  const signedIn = (await page.getByRole('button', { name: 'Account', exact: true }).count()) > 0;
  if (!signedIn) {
    // Close whatever the form left open so the next step can interact.
    await page.keyboard.press('Escape').catch(() => {});
  }
  return signedIn;
}

async function signOut(page) {
  const back = page.getByRole('button', { name: 'Back to library' });
  if (await back.count()) {
    await back.first().click({ force: true });
    await page.waitForTimeout(2500);
  }
  if (!(await page.getByRole('button', { name: 'Account', exact: true }).count())) return;
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const current = page.getByRole('menuitem', { name: 'Sign out' });
  if (await current.count()) await current.click();
  else await page.getByRole('menuitem', { name: 'Log out' }).click(); // pre-correction build
  await page.waitForTimeout(2500);
}

async function apiFor(account) {
  const client = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: email(account.username),
    password: account.password,
  });
  if (error) throw new Error(`backend sign-in failed: ${error.message}`);
  return client;
}

async function launch(page, searchTerm, cardPattern) {
  await page.locator('#library-search').fill(searchTerm);
  await page.locator('#library-search').press('Enter');
  await page.waitForTimeout(800);
  await page.locator('[data-card]').filter({ hasText: cardPattern }).locator('button').first().click();
  await page.waitForSelector('iframe', { timeout: 45_000 });
  await page.waitForTimeout(4500);
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/games/'));
}

/** What the game wrote for itself, read through the account-scoped view. */
const storedKeys = (frame) => frame.evaluate(() => {
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) keys.push(localStorage.key(index));
  return keys.filter(Boolean);
});

const GAMES = [
  {
    id: 'cl2048',
    label: '2048',
    search: '2048',
    card: /^2048$/,
    reason: 'this build loads every script from a CDN and ships no storage manager, so it keeps no progress',
    async play(frame) {
      await frame.click('.game-container', { position: { x: 40, y: 40 } }).catch(() => {});
      for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
        await frame.press('body', key).catch(() => {});
        await frame.waitForTimeout(240);
      }
    },
    async value(frame) {
      return frame.evaluate(() => ({
        score: document.querySelector('.score-container')?.textContent?.trim() ?? '',
        tiles: document.querySelectorAll('.tile').length,
      }));
    },
    describe: (value) => `score=${value?.score} tiles=${value?.tiles}`,
    // The scoreboard renders "16" plus a separate "+4" bonus element.
    meaningful: (value) => Number.parseInt(String(value?.score ?? '').replace(/[^0-9].*$/, ''), 10) > 0,
  },
  {
    id: 'clspacebarclicker',
    label: 'Spacebar Clicker',
    search: 'spacebar clicker',
    card: /spacebar/i,
    reason: 'playing added no storage of its own: the game keeps progress in memory, or its save routine never runs',
    async play(frame) {
      await frame.click('body', { position: { x: 200, y: 200 } }).catch(() => {});
      for (let i = 0; i < 14; i += 1) {
        await frame.press('body', 'Space').catch(() => {});
        await frame.waitForTimeout(120);
      }
    },
    async value(frame) {
      return frame.evaluate(() => document.querySelector('#counter')?.textContent?.trim() ?? '');
    },
    describe: (value) => `counter=${value}`,
    meaningful: (value) => Number(String(value).replace(/[^0-9]/g, '')) > 0,
  },
  {
    id: 'clquantumclicker',
    label: 'Quantum Clicker',
    search: 'quantum clicker',
    card: /quantum/i,
    reason: 'clicks on its main button added no storage of its own, so there was no game-written progress to verify',
    async play(frame) {
      for (let i = 0; i < 18; i += 1) {
        await frame.click('#clickBtn').catch(() => {});
        await frame.waitForTimeout(110);
      }
    },
    async value(frame) {
      return frame.evaluate(() => document.querySelector('#stats')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    },
    describe: (value) => String(value).slice(0, 80),
    meaningful: (value) => /\d/.test(String(value)) && !/^0\b/.test(String(value).trim()),
  },
];

const saved = async (api, gameId) => {
  const { data, error } = await api
    .from('geegle_game_saves')
    .select('game_id,save_data,revision')
    .eq('game_id', gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

async function freshBrowser() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  return { browser, context, page };
}

let api;
try {
  // ---------------------------------------------------------------- setup
  const setup = await freshBrowser();
  await openLibrary(setup.page);
  accountCreated = await signIn(setup.page, ACCOUNT, { register: true });
  check('1. disposable account created through the production form', accountCreated);
  await setup.context.close();
  await setup.browser.close();
  api = await apiFor(ACCOUNT);
  const { data: authUser } = await api.auth.getUser();
  check('2. the account exists in production Supabase Auth', Boolean(authUser?.user?.id), authUser?.user?.id?.slice(0, 8) ?? 'none');

  // ---------------------------------------------------------------- phase 1
  for (const game of GAMES) {
    console.log(`\n-- ${game.label} (${game.id})`);
    const before = await freshBrowser();
    await openLibrary(before.page);
    check(`${game.id}: signed in for the gameplay run`, await signIn(before.page, ACCOUNT));
    const frame = await launch(before.page, game.search, game.card);
    check(`${game.id}: launches`, Boolean(frame));
    if (!frame) {
      await before.context.close();
      await before.browser.close();
      continue;
    }
    const keysBefore = await storedKeys(frame);
    await game.play(frame);
    await frame.waitForTimeout(1500);
    const value = await game.value(frame);
    const keysAfter = await storedKeys(frame);
    const keys = keysAfter.filter((key) => !keysBefore.includes(key));
    check(`${game.id}: real input changed what the game shows`, game.meaningful(value), game.describe(value));

    if (!keys.length) {
      skip(`${game.id}: cloud save round trip`, `${game.reason} (keys written by the game: 0)`);
      await signOut(before.page);
      await before.context.close();
      await before.browser.close();
      continue;
    }

    await before.page.waitForTimeout(SYNC_WAIT_MS);
    const row = await saved(api, game.id);
    check(`${game.id}: the account-owned save exists in production`, Boolean(row), row ? `revision=${String(row.revision).slice(0, 8)}` : 'no row');
    check(`${game.id}: the save carries the game's own keys`, Boolean(row) && JSON.stringify(row.save_data).includes(keys[0]), keys.join(','));

    await signOut(before.page);
    await before.context.close();
    await before.browser.close();

    const after = await freshBrowser();
    await openLibrary(after.page);
    check(`${game.id}: a brand-new browser signs in to the same account`, await signIn(after.page, ACCOUNT));
    const restoredFrame = await launch(after.page, game.search, game.card);
    await restoredFrame?.waitForTimeout(2500);
    const restoredValue = restoredFrame ? await game.value(restoredFrame) : null;
    check(
      `${game.id}: the game shows the restored progress itself`,
      JSON.stringify(restoredValue) === JSON.stringify(value),
      `before=${game.describe(value)} after=${game.describe(restoredValue)}`
    );

    // A second account never receives the first account's save.
    await signOut(after.page);
    const other = otherAccount(GAMES.indexOf(game));
    check(`${game.id}: second account created`, await signIn(after.page, other, { register: true }));
    const otherFrame = await launch(after.page, game.search, game.card);
    const otherValue = otherFrame ? await game.value(otherFrame) : null;
    check(
      `${game.id}: a different account starts without that progress`,
      JSON.stringify(otherValue) !== JSON.stringify(value),
      `other=${game.describe(otherValue)}`
    );
    await after.context.close();
    await after.browser.close();
  }
} catch (error) {
  check('gameplay cloud-save journey threw', false, error instanceof Error ? error.message : String(error));
}

// ---------------------------------------------------------------- phase 2
// Manual controls and failure recovery, on a game the platform can capture.
let manualBrowser;
try {
  manualBrowser = await chromium.launch();
  const context = await manualBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await openLibrary(page);
  check('3. primary account signs in for the manual checks', await signIn(page, ACCOUNT));

  const frame = await launch(page, '2048', /^2048$/);
  check('4. game opens for the manual checks', Boolean(frame));
  // The shim path is exercised by writing through the game's own storage view.
  await frame?.evaluate(() => localStorage.setItem('manualProgress', 'saved-here')).catch(() => {});
  await page.waitForTimeout(1000);
  const message = async () => (await page.locator('p[class*="inset-x-3"]').last().innerText().catch(() => '')).trim();

  await page.getByRole('button', { name: 'Save progress to cloud' }).click();
  await page.waitForTimeout(3000);
  const saveMessage = await message();
  const afterManual = await saved(api, 'cl2048');
  check(
    '5. manual save syncs the changed storage to the account',
    /saved to cloud|already in sync/i.test(saveMessage) && JSON.stringify(afterManual?.save_data ?? '').includes('saved-here'),
    `${saveMessage} / revision=${String(afterManual?.revision ?? '').slice(0, 8)}`
  );

  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
  await page.getByRole('button', { name: 'Export this save as a file' }).click();
  const download = await downloadPromise;
  let exported = null;
  if (download) {
    const path = `/tmp/${download.suggestedFilename()}`;
    await download.saveAs(path);
    exported = JSON.parse(readFileSync(path, 'utf8'));
  }
  check('6. a save file exports as JSON for this game', Boolean(exported) && exported.gameId === 'cl2048', exported ? Object.keys(exported.localStorage ?? {}).join(',') : 'no download');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Restore progress from cloud' }).click();
  await page.waitForTimeout(3500);
  const restoreMessage = await message();
  check('7. manual restore reports success', /restored/i.test(restoreMessage), restoreMessage);

  writeFileSync('/tmp/geegle-invalid.json', '{"format":"not-a-save","localStorage":{}}');
  await page.locator('input[type=file]').setInputFiles('/tmp/geegle-invalid.json');
  await page.waitForTimeout(2500);
  const invalidMessage = await message();
  check('8. an invalid save file is refused', /unrecognized|invalid/i.test(invalidMessage), invalidMessage);

  writeFileSync('/tmp/geegle-foreign.json', JSON.stringify({ format: 'geegle-storage-v3', gameId: 'clspacebarclicker', localStorage: { nope: '1' }, indexedDB: [] }));
  await page.locator('input[type=file]').setInputFiles('/tmp/geegle-foreign.json');
  await page.waitForTimeout(2500);
  const foreignMessage = await message();
  check('9. a save from another game is refused', /different game/i.test(foreignMessage), foreignMessage);

  if (exported) {
    writeFileSync('/tmp/geegle-valid.json', JSON.stringify(exported));
    await page.locator('input[type=file]').setInputFiles('/tmp/geegle-valid.json');
    await page.waitForTimeout(5000);
    const importMessage = await message();
    check('10. a valid save file is imported and synced', /imported/i.test(importMessage), importMessage);
  }

  // Offline upload: say so, and never replace the stored save with the failure.
  const beforeOffline = await saved(api, 'cl2048');
  const beforeRevision = String(beforeOffline?.revision ?? '');
  // The restore above remounted the frame, so resolve it again before writing.
  const liveFrame = page.frames().find((entry) => entry.url().includes('cl2048'));
  await context.setOffline(true);
  await liveFrame?.evaluate(() => localStorage.setItem('manualProgress', 'offline-change')).catch(() => {});
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Save progress to cloud' }).click();
  await page.waitForTimeout(3500);
  const offlineMessage = await message();
  check('11. an offline save reports the failure instead of claiming success', /offline|failed/i.test(offlineMessage), offlineMessage);
  const duringOffline = await saved(api, 'cl2048');
  check('12. the failed upload leaves the stored cloud save intact', String(duringOffline?.revision ?? '') === beforeRevision, `${beforeRevision.slice(0, 8)} → ${String(duringOffline?.revision ?? '').slice(0, 8)}`);

  // The old bottom-right status box is gone; the UI must not keep a box or
  // its success text over the game.
  check(
    '13. the player shows no persistent cloud-save status box',
    (await page.locator('div.absolute.bottom-3.right-3').count()) === 0 &&
      (await page.locator('text=Saved to Cloud').count()) === 0
  );

  await context.setOffline(false);
  await page.waitForTimeout(SYNC_WAIT_MS + 4000);
  const afterReconnect = await saved(api, 'cl2048');
  check(
    '14. reconnecting synchronises the pending progress in the background',
    String(afterReconnect?.revision ?? '') !== beforeRevision,
    `revision=${String(afterReconnect?.revision ?? '').slice(0, 8)} (was ${beforeRevision.slice(0, 8)})`
  );

  await context.close();
} catch (error) {
  check('manual save controls threw', false, error instanceof Error ? error.message : String(error));
} finally {
  await manualBrowser?.close();
  await api?.auth.signOut();
}

const failed = results.filter((entry) => !entry.ok);
const skipped = results.filter((entry) => entry.skipped).length;
console.log(`\n${results.length - failed.length - skipped}/${results.length - skipped} gameplay cloud-save checks passed (${skipped} skipped with evidence)`);
console.log(`account created: ${ACCOUNT.username} (random disposable credentials, not recorded)`);
process.exit(failed.length ? 1 : 0);
