// Live production acceptance run against the deployed site and the real
// production Supabase project.
//
// Creates two disposable, randomly named accounts, drives the actual interface
// and verifies the account system end to end: registration, duplicate and
// case-insensitive duplicate rejection, logout/login, reauthenticated password
// change, favorites, appearance, Recently Played, automatic cloud saving,
// reload, full browser restart, cleared storage, restoration, and separation
// between the two accounts.
//
// Usage:
//   node --env-file=.env.prod.local scripts/qa/production-acceptance.mjs
//   GEEGLE_PROD_BASE=https://bartisawesome.onrender.com
//
// Randomized credentials only: no fixed or published test password is used, and
// no existing account is touched.

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const BASE = process.env.GEEGLE_PROD_BASE ?? 'https://bartisawesome.onrender.com';
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (use --env-file).');
  process.exit(1);
}

const tag = randomBytes(4).toString('hex');
const makePassword = () => `${randomBytes(12).toString('base64url')}Aa1!`;
const PASSWORD = makePassword();
const NEW_PASSWORD = makePassword();
const A = { username: `pa${tag}`, password: PASSWORD };
const B = { username: `pb${tag}`, password: makePassword() };
// The dropdown/wordmark corrections ship with this branch. Set
// GEEGLE_EXPECT_NEW_MENU=1 once that build is deployed; until then the menu
// checks are recorded as skipped instead of pretending to pass.
const EXPECT_NEW_MENU = process.env.GEEGLE_EXPECT_NEW_MENU === '1';
const PROBE_KEY = 'e2eProgress';
const PROBE_VALUE = `progress-${tag}`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const email = (username) => `${username.toLowerCase()}@users.geegle.internal`;

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
  await page.waitForTimeout(400);
}

const signedIn = (page) =>
  page.getByRole('button', { name: 'Account', exact: true }).count().then((n) => n > 0);

async function submitAccount(page, mode, user, password) {
  await page.getByRole('button', { name: /Sign in/ }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  if (mode === 'register') {
    await dialog.getByRole('button', { name: /Create one/ }).click();
    dialog = page.getByRole('dialog', { name: 'Create account' });
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  }
  await dialog.getByLabel('Username').fill(user.username);
  await dialog.getByLabel('Password').fill(password);
  await dialog
    .getByRole('button', { name: mode === 'register' ? 'Create account' : 'Sign in' })
    .click();
  await page.waitForTimeout(3500);
  return page
    .getByRole('dialog', { name: mode === 'register' ? 'Create account' : 'Sign in' });
}

async function closeGame(page) {
  const exit = page.getByRole('button', { name: 'Back to library' });
  if (await exit.count()) {
    await exit.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
  }
}

async function signOut(page) {
  await closeGame(page);
  if (!(await signedIn(page))) return;
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const current = page.getByRole('menuitem', { name: 'Sign out' });
  if (await current.count()) await current.click();
  else await page.getByRole('menuitem', { name: 'Log out' }).click(); // pre-correction build
  await page.waitForTimeout(2000);
}

async function launch2048(page) {
  await page.locator('#library-search').fill('2048');
  await page.locator('#library-search').press('Enter');
  await page.waitForTimeout(600);
  await page.locator('[data-card]').filter({ hasText: /2048/ }).locator('button').first().click();
  await page.waitForSelector('iframe', { timeout: 45_000 });
  await page.waitForTimeout(3000);
  return page.frames().find((frame) => frame.url().includes('cl2048.html'));
}

const apiFor = async (user) => {
  const client = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: email(user.username),
    password: user.password,
  });
  if (error) throw new Error(`backend sign-in failed: ${error.message}`);
  return client;
};

let browser = await chromium.launch();

try {
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await contextA.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // 1. Create account A through the real form.
  await openLibrary(page);
  await submitAccount(page, 'register', A, PASSWORD);
  check('1. account created through the production form', await signedIn(page));

  // 2. Profile and preferences records exist in production.
  const apiA = await apiFor(A);
  const { data: authA } = await apiA.auth.getUser();
  const profile = await apiA.from('geegle_profiles').select('username').eq('id', authA.user.id).maybeSingle();
  const settings = await apiA.from('geegle_user_settings').select('id').eq('id', authA.user.id).maybeSingle();
  check(
    '2. profile and preferences rows exist for the account',
    profile.data?.username === A.username.toLowerCase() && Boolean(settings.data),
    `${profile.data?.username ?? 'none'}/${Boolean(settings.data)}`
  );

  // 2b-2c. Token refresh and two simultaneous registrations of one username.
  const refreshed = await apiA.auth.refreshSession();
  const refreshedToken = refreshed.data?.session?.access_token;
  const afterRefresh = refreshedToken
    ? await apiA.from('geegle_profiles').select('username').eq('id', authA.user.id).maybeSingle()
    : { data: null, error: refreshed.error };
  check(
    '2b. the session token refreshes and still reads this account',
    Boolean(refreshedToken) && afterRefresh.data?.username === A.username.toLowerCase(),
    afterRefresh.error?.message ?? 'ok'
  );

  const raceName = `pr${tag}`;
  const raceClient = () => createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const attempts = await Promise.all([
    raceClient().auth.signUp({ email: email(raceName), password: makePassword(), data: { username: raceName } }),
    raceClient().auth.signUp({ email: email(raceName), password: makePassword(), data: { username: raceName } }),
  ]);
  const raced = attempts.filter((attempt) => !attempt.error && attempt.data?.session);
  check(
    '2c. two simultaneous registrations of one username create one account',
    raced.length === 1,
    `sessions=${raced.length} errors=${attempts.map((a) => a.error?.status ?? a.error?.code ?? 'none').join('/')}`
  );

  // 3. Logout.
  await signOut(page);
  check('3. logout signs out', !(await signedIn(page)));

  // 4. Login again.
  await submitAccount(page, 'login', A, PASSWORD);
  check('4. login succeeds', await signedIn(page));

  // 4b-4g. The account dropdown is the avatar menu and holds one action.
  if (!EXPECT_NEW_MENU) {
    console.log('SKIP  4b-4g account dropdown corrections — the deployed build predates them (set GEEGLE_EXPECT_NEW_MENU=1)');
  } else {
  const menuButton = page.getByRole('button', { name: 'Account', exact: true });
  const menu = page.getByRole('menu', { name: 'Account menu' });
  await menuButton.click();
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  const menuItems = await menu.getByRole('menuitem').allInnerTexts();
  check('4b. the account dropdown lists exactly one action', menuItems.length === 1, JSON.stringify(menuItems));
  check('4c. the only action reads exactly Sign out', menuItems[0]?.trim() === 'Sign out', menuItems[0] ?? '');
  const menuText = (await menu.innerText()).replace(/\s+/g, ' ').trim();
  check(
    '4d. the dropdown has no Settings entry and no username',
    !/Settings/.test(menuText) && !menuText.toLowerCase().includes(A.username.toLowerCase()),
    menuText
  );
  const menuBox = await menu.boundingBox();
  const avatarBox = await menuButton.boundingBox();
  check(
    '4e. the dropdown sits directly beneath the avatar',
    Boolean(menuBox && avatarBox) && menuBox.y >= avatarBox.y + avatarBox.height - 2 && Math.abs(menuBox.y + menuBox.width - (avatarBox.x + avatarBox.width)) < 40,
    `menu=${JSON.stringify(menuBox)} avatar=${JSON.stringify(avatarBox)}`
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('4f. Escape closes the dropdown', (await menu.count()) === 0);
  await menuButton.click();
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  await page.mouse.click(20, 700);
  await page.waitForTimeout(400);
  check('4g. clicking outside closes the dropdown', (await menu.count()) === 0);
  }

  // 5. Duplicate registration.
  await signOut(page);
  const dup = await submitAccount(page, 'register', A, PASSWORD);
  check('5. duplicate username refused', (await dup.innerText()).includes('already taken'));
  await page.keyboard.press('Escape');

  // 6. Differently capitalised duplicate.
  const dupUpper = await submitAccount(page, 'register', { username: A.username.toUpperCase() }, PASSWORD);
  check(
    '6. differently capitalised duplicate refused',
    (await dupUpper.innerText()).includes('already taken')
  );
  await page.keyboard.press('Escape');

  // Sign back in for the remaining checks.
  await submitAccount(page, 'login', A, PASSWORD);

  // 7-9. Password change with reauthentication.
  await page.getByRole('button', { name: 'Settings' }).click();
  let dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('tab', { name: 'Preferences' }).click();
  await dialog.getByLabel('Current password').fill('definitely-not-it');
  await dialog.getByLabel('New password').fill(NEW_PASSWORD);
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await page.waitForTimeout(2500);
  check('7. wrong current password refused', (await dialog.innerText()).includes('Current password is incorrect'));

  await dialog.getByLabel('Current password').fill(PASSWORD);
  await dialog.getByLabel('New password').fill(NEW_PASSWORD);
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await page.waitForTimeout(3000);
  check('8. password changed with the correct current password', (await dialog.innerText()).includes('Password updated'));

  // 10. Star a game.
  await dialog.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(500);
  const star = page.locator('[data-card] button[aria-label^="Add "]').first();
  await star.click();
  await page.waitForTimeout(2500);
  const favoriteCount = await page.locator('[data-card] button[aria-label^="Remove "]').count();
  check('10. a game is starred', favoriteCount > 0, `stars=${favoriteCount}`);

  // 11. Appearance.
  await page.getByRole('button', { name: 'Settings' }).click();
  dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.locator('input[aria-label="Custom background colour"]').fill('#203a2f');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(1800);

  // 12. Recently Played visible.
  await dialog.getByRole('tab', { name: 'Preferences' }).click();
  const recentToggle = dialog.getByRole('checkbox', { name: /Show Recently Played/ });
  if (!(await recentToggle.isChecked())) await recentToggle.check();
  await page.waitForTimeout(1800);
  await dialog.getByRole('button', { name: 'Close settings' }).click();

  // 13-14. Real gameplay progress and automatic saving.
  const frame = await launch2048(page);
  check('13. 2048 launches on production', Boolean(frame));
  // Mechanism check: this 2048 build keeps no progress of its own (no storage
  // manager), so the value below is written by this test on purpose. It proves
  // the account-scoped capture, upload and restore path, not game support.
  // Genuine gameplay evidence lives in docs/CLOUD_SAVE_VERIFICATION.md.
  await frame.evaluate(([key, value]) => localStorage.setItem(key, value), [PROBE_KEY, PROBE_VALUE]);
  await page.waitForTimeout(18_000);

  const saveRow = await apiA
    .from('geegle_game_saves')
    .select('game_id,save_data,revision')
    .eq('game_id', 'cl2048')
    .maybeSingle();
  check(
    '14. the shimmed game storage is captured and saved to the account automatically',
    Boolean(saveRow.data) && JSON.stringify(saveRow.data.save_data).includes(PROBE_VALUE),
    saveRow.data ? `revision=${String(saveRow.data.revision).slice(0, 8)}` : (saveRow.error?.message ?? 'no row')
  );

  // 15. Reload keeps the session.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  check('15. session survives a page refresh', await signedIn(page));

  // 16-17. Full browser restart with the same profile.
  const storage = await contextA.storageState();
  await contextA.close();
  await browser.close();
  browser = await chromium.launch();
  const restartedContext = await browser.newContext({ storageState: storage });
  const restarted = await restartedContext.newPage();
  await openLibrary(restarted);
  await restarted.waitForTimeout(2500);
  check('16. session survives a full browser restart', await signedIn(restarted));
  await restartedContext.close();

  // 18-20. Cleared storage: sign in again and recover preferences, favorites and progress.
  const cleanContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const clean = await cleanContext.newPage();
  await openLibrary(clean);
  await submitAccount(clean, 'login', A, NEW_PASSWORD);
  check('18. login with the changed password after clearing storage', await signedIn(clean));
  await clean.waitForTimeout(2500);

  const background = await clean.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('19. appearance is restored from the account', background === 'rgb(32, 58, 47)', background);
  const restoredStars = await clean.locator('[data-card] button[aria-label^="Remove "]').count();
  check('19b. favorites are restored from the account', restoredStars > 0, `stars=${restoredStars}`);

  const restoredFrame = await launch2048(clean);
  const restoredValue = restoredFrame
    ? await restoredFrame.evaluate((key) => localStorage.getItem(key), PROBE_KEY)
    : null;
  check('20. the account save is restored into a cleared browser before launch', restoredValue === PROBE_VALUE, String(restoredValue));

  // 21-22. A second account sees none of it.
  await signOut(clean);
  await submitAccount(clean, 'register', B, B.password);
  check('21. second account is created', await signedIn(clean));
  await clean.waitForTimeout(2500);
  const bStars = await clean.locator('[data-card] button[aria-label^="Remove "]').count();
  const bBackground = await clean.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('22. second account has no first-account favorites or appearance', bStars === 0 && bBackground !== 'rgb(32, 58, 47)', `stars=${bStars} bg=${bBackground}`);
  const bFrame = await launch2048(clean);
  const bValue = bFrame ? await bFrame.evaluate((key) => localStorage.getItem(key), PROBE_KEY) : 'no-frame';
  check('22b. second account does not receive the first account save', bValue === null, String(bValue));

  // 23. Logout.
  await signOut(clean);
  check('23. final logout signs out', !(await signedIn(clean)));
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  await cleanContext.close();
} catch (error) {
  check('production acceptance journey threw', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} production acceptance checks passed`);
console.log(`accounts created: ${A.username}, ${B.username} (random disposable credentials, not recorded)`);
process.exit(failed.length ? 1 : 0);
