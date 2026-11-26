// Verifies the guest reminder preference end to end against the built app.
//
//   node scripts/qa/check-guest-reminder-preference.mjs
//
// Covers: the checkbox starts unchecked, an unchecked Continue as guest only
// suppresses the reminder for the browsing session, a checked Continue as
// guest survives a reload, the Settings reset action brings the reminder back,
// and a brand-new browser context starts with no stored preference.

import { chromium } from '@playwright/test';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4173';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
};

const browser = await chromium.launch();

async function settleLibrary(page) {
  await page.waitForSelector('[data-card]');
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.isVisible().catch(() => false)) {
    await notice.getByRole('button', { name: 'Got it' }).click();
    await page.waitForTimeout(250);
  }
  return page;
}

async function openLibrary(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/#games`, { waitUntil: 'networkidle' });
  return settleLibrary(page);
}

async function launchCard(page, index) {
  await page.locator('[data-card] button').nth(index).click();
  await page.waitForTimeout(600);
}

const reminder = (page) => page.locator('[aria-labelledby="account-reminder-title"]');

// --- session-only path in a fresh context -------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await openLibrary(context);
  await launchCard(page, 0);
  check('the guest reminder appears', (await reminder(page).count()) === 1);
  const unchecked = await reminder(page).locator('input[type=checkbox]').isChecked();
  check('the checkbox starts unchecked', unchecked === false);
  await reminder(page).getByRole('button', { name: 'Continue as guest' }).click();
  await page.waitForTimeout(600);
  check('Continue as guest still launches the game', (await page.getByRole('button', { name: 'Back to library' }).count()) === 1);
  await page.getByRole('button', { name: 'Back to library' }).click();
  await page.waitForSelector('[data-card]');

  await page.reload({ waitUntil: 'networkidle' });
  await settleLibrary(page);
  await launchCard(page, 0);
  check(
    'an unchecked dismissal still covers later launches in the same session',
    (await reminder(page).count()) === 0,
    'session-only behaviour preserved'
  );
  await context.close();

  // A brand-new browsing session has no dismissal at all.
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const freshPage = await openLibrary(fresh);
  await launchCard(freshPage, 0);
  check('a new browsing session asks again', (await reminder(freshPage).count()) === 1);
  await fresh.close();
}

// --- permanent path, reset action and new context -----------------------
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await openLibrary(context);
await launchCard(page, 0);
check('the reminder is shown before the permanent choice', (await reminder(page).count()) === 1);
await reminder(page).locator('input[type=checkbox]').check();
check('the checkbox can be checked', await reminder(page).locator('input[type=checkbox]').isChecked());
await reminder(page).getByRole('button', { name: 'Continue as guest' }).click();
await page.waitForTimeout(600);
check('the chosen game launches after checking the box', (await page.getByRole('button', { name: 'Back to library' }).count()) === 1);
await page.getByRole('button', { name: 'Back to library' }).click();
await page.waitForSelector('[data-card]');

await page.reload({ waitUntil: 'networkidle' });
await settleLibrary(page);
await launchCard(page, 0);
check('the permanent choice survives a reload', (await reminder(page).count()) === 0);
await page.getByRole('button', { name: 'Back to library' }).click();
await page.waitForSelector('[data-card]');

// A new tab in the same profile shares localStorage.
const secondTab = await context.newPage();
await secondTab.goto(`${BASE}/#games`, { waitUntil: 'networkidle' });
await settleLibrary(secondTab);
await launchCard(secondTab, 0);
check('the permanent choice applies in a new tab', (await reminder(secondTab).count()) === 0);
await secondTab.close();

// Reset from Settings → Preferences.
await page.getByRole('button', { name: 'Settings' }).click();
const settings = page.locator('[role="dialog"][aria-label="Settings"]');
await settings.getByRole('tab', { name: 'Preferences' }).click();
const reset = settings.getByRole('button', { name: 'Reset account reminder' });
check('Preferences offers the reset action', (await reset.count()) === 1);
check('the reset action is enabled while the preference is off', await reset.isEnabled());
await reset.click();
await settings.getByRole('button', { name: 'Close settings' }).click();
await launchCard(page, 0);
check('resetting brings the reminder back', (await reminder(page).count()) === 1);

// Clearing browser storage resets the guest preference too.
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await settleLibrary(page);
await launchCard(page, 0);
check('clearing storage restores the reminder', (await reminder(page).count()) === 1);

await context.close();
await browser.close();

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length }, null, 2));
process.exitCode = failed.length > 0 ? 1 : 0;
