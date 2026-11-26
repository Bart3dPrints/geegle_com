// Real account journey against the configured backend (local .env.local points
// at the isolated Supabase project; no production data is touched).
//
// Covers: sign-in, wrong password, session across reload and a new tab,
// favorites persistence, the Recently Played preference, account isolation and
// explicit logout.

import { chromium } from 'playwright';

const BASE = process.env.GEEGLE_AUTH_BASE ?? 'http://127.0.0.1:5174';
const USER_A = { username: 'qauser1', password: 'GeegleTest123!' };
const USER_B = { username: 'qauser2', password: 'GeegleTest123!' };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (error) => consoleErrors.push(error.message));

async function dismissNotice() {
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  try {
    await notice.waitFor({ state: 'visible', timeout: 2500 });
  } catch {
    return;
  }
  await notice.getByRole('button', { name: 'Got it' }).click();
  await notice.waitFor({ state: 'detached', timeout: 2500 });
}

async function signIn(user) {
  await page.goto(BASE + '/#games', { waitUntil: 'networkidle' });
  await dismissNotice();
  if (await page.getByRole('button', { name: 'Account', exact: true }).count()) {
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await page.waitForTimeout(800);
  }
  await page.getByRole('button', { name: /Sign in/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Username').fill(user.username);
  await dialog.getByLabel('Password').fill(user.password);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);
}

try {
  await page.goto(BASE + '/#games', { waitUntil: 'networkidle' });
  await dismissNotice();
  check('visitor starts logged out', (await page.getByRole('button', { name: /Sign in/ }).count()) > 0);

  // Wrong password is rejected with a precise, non-revealing message.
  await page.getByRole('button', { name: /Sign in/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Username').fill(USER_A.username);
  await dialog.getByLabel('Password').fill('definitely-wrong');
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(1500);
  check('wrong password shows a safe error', (await dialog.innerText()).includes('Invalid username or password'));
  await dialog.getByRole('button', { name: 'Close' }).count().catch(() => 0);
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });

  await signIn(USER_A);
  check('sign-in succeeds', (await page.getByRole('button', { name: 'Account', exact: true }).count()) > 0);

  await page.reload({ waitUntil: 'networkidle' });
  await dismissNotice();
  await page.waitForTimeout(700);
  check('session survives a reload', (await page.getByRole('button', { name: 'Account', exact: true }).count()) > 0);

  const second = await context.newPage();
  await second.goto(BASE + '/#games', { waitUntil: 'networkidle' });
  const secondNotice = second.locator('[aria-labelledby="library-notice-text"]');
  if (await secondNotice.count()) await secondNotice.getByRole('button', { name: 'Got it' }).click();
  await second.waitForTimeout(800);
  check('session survives a new tab', (await second.getByRole('button', { name: 'Account', exact: true }).count()) > 0);
  await second.close();

  // Favorite the first card and confirm it survives a reload.
  const star = page.locator('[data-card] [aria-label^="Add "]').first();
  const label = await star.getAttribute('aria-label');
  await star.click();
  await page.waitForTimeout(1200);
  check('favorite control reflects the saved state', (await page.locator('[data-card] [aria-label^="Remove "]').count()) > 0, label ?? '');
  await page.reload({ waitUntil: 'networkidle' });
  await dismissNotice();
  await page.waitForTimeout(1200);
  check('favorite persists across reload', (await page.locator('[data-card] [aria-label^="Remove "]').count()) > 0);

  // Recently Played preference persists.
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  check('signed-in settings shows the username', (await settings.innerText()).includes(USER_A.username));
  const recentToggle = settings.getByRole('checkbox', { name: /Show Recently Played/ });
  await recentToggle.check();
  await page.waitForTimeout(1000);
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await dismissNotice();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Settings' }).click();
  check(
    'Recently Played preference persists',
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('checkbox', { name: /Show Recently Played/ }).isChecked()
  );
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close settings' }).click();

  // Explicit logout.
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForTimeout(1500);
  check('explicit logout returns to signed out', (await page.getByRole('button', { name: /Sign in/ }).count()) > 0);

  // Second account sees its own (empty) favorites.
  await signIn(USER_B);
  await page.waitForTimeout(1200);
  const bFavorites = await page.locator('[data-card] [aria-label^="Remove "]').count();
  check('second account does not see the first account favorites', bFavorites === 0, String(bFavorites));
  check('second account is signed in', (await page.getByRole('button', { name: 'Account', exact: true }).count()) > 0);

  // Signed-in surfaces screenshot for the PR evidence.
  await page.screenshot({ path: 'docs/qa/library-signed-in.png', fullPage: false });
} catch (error) {
  results.push({ name: 'journey threw', ok: false, detail: error instanceof Error ? error.message : String(error) });
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} auth checks passed`);
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
if (consoleErrors.length) console.log('page errors:', consoleErrors.join(' | '));
if (failed.length) process.exitCode = 1;
