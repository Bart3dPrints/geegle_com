// Session survival across a browser restart and per-account preference sync
// across browsers, against the isolated backend.
//
// 1. Sign in, save a background colour and a tab title.
// 2. Capture browser storage, close the browser, reopen with it: the session
//    must still be valid without signing in again.
// 3. A completely fresh browser signs in: appearance and tab identity must follow.
// 4. Reset everything so the test account is left clean.
//
// Run: node --env-file=.env.local scripts/qa/check-session-sync.mjs

import { chromium } from 'playwright';

const BASE = process.env.GEEGLE_AUTH_BASE ?? 'http://127.0.0.1:5174';
const USER = { username: 'qauser1', password: 'GeegleTest123!' };
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function openLibrary(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (!(await page.locator('.gl-field').count())) return;
  await page.fill('.gl-field input', 'pirate');
  await page.press('.gl-field input', 'Enter');
  await page.waitForSelector('header');
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) {
    await notice.getByRole('button', { name: 'Got it' }).click();
    await notice.waitFor({ state: 'detached' });
  }
}

async function signIn(page) {
  await openLibrary(page);
  await page.getByRole('button', { name: /Sign in/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Username').fill(USER.username);
  await dialog.getByLabel('Password', { exact: true }).fill(USER.password);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(1800);
}

let browser = await chromium.launch();
try {
  const first = await browser.newContext();
  const page = await first.newPage();
  await signIn(page);
  check('signed in for the sync test', (await page.getByRole('button', { name: 'Account', exact: true }).count()) === 1);

  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[role="dialog"][aria-label="Settings"]');
  await settings.locator('input[aria-label="Custom background colour"]').fill('#202020');
  await settings.getByRole('button', { name: 'Apply' }).click();
  await settings.getByRole('tab', { name: 'Tab appearance' }).click();
  await settings.locator('#tab-title').fill('Geegle Sync Test');
  await settings.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(600);
  await settings.getByRole('button', { name: 'Close settings' }).click();

  const state = await first.storageState();
  await first.close();
  await browser.close();

  // Browser restart: same storage, new browser process.
  browser = await chromium.launch();
  const restored = await browser.newContext({ storageState: state });
  const restarted = await restored.newPage();
  await openLibrary(restarted);
  await restarted.waitForTimeout(1200);
  check('session survives a browser restart', (await restarted.getByRole('button', { name: 'Account', exact: true }).count()) === 1);
  check('saved look survives a browser restart', (await restarted.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(32, 32, 32)', await restarted.evaluate(() => getComputedStyle(document.body).backgroundColor));
  await restored.close();

  // Fresh browser, same account: preferences come from the account, not the device.
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await signIn(freshPage);
  await freshPage.waitForTimeout(1500);
  const background = await freshPage.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('chosen appearance follows the account to a fresh browser', background === 'rgb(32, 32, 32)', background);
  check('tab identity follows the account to a fresh browser', (await freshPage.title()) === 'Geegle Sync Test', await freshPage.title());

  // Leave the test account clean.
  await freshPage.getByRole('button', { name: 'Settings' }).click();
  const cleanup = freshPage.locator('[role="dialog"][aria-label="Settings"]');
  await cleanup.getByRole('button', { name: 'Reset to defaults' }).click();
  await cleanup.getByRole('tab', { name: 'Tab appearance' }).click();
  await cleanup.getByRole('button', { name: 'Reset to defaults' }).click();
  await freshPage.waitForTimeout(800);
  await cleanup.getByRole('button', { name: 'Close settings' }).click();
  await fresh.close();
} catch (error) {
  results.push({ name: 'session journey threw', ok: false, detail: error instanceof Error ? error.message : String(error) });
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} session/sync checks passed`);
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
if (failed.length) process.exitCode = 1;
