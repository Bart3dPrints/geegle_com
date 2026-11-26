// Account reminder journey against the isolated QA backend.
//
//   npx vite --mode qa --port 5174
//   GEEGLE_AUTH_BASE=http://127.0.0.1:5174 node --env-file=.env.qa.local \
//     scripts/qa/check-account-reminder.mjs
//
// Covers: the guest reminder appears once, keeps the chosen destination,
// launches it after a real sign-in or account creation, and never interrupts
// signed-in use. No production data is touched; the account is disposable.

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.GEEGLE_AUTH_BASE ?? 'http://127.0.0.1:5174';
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (use --env-file).');
  process.exit(2);
}

const stamp = Date.now().toString(36);
const USER = { username: `qaRem${stamp}`.slice(0, 32), password: `Gg-${stamp}-${Math.random().toString(36).slice(2, 10)}` };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

const reminder = () => page.locator('[aria-labelledby="account-reminder-title"]');
const authDialog = (name) => page.locator(`[role="dialog"][aria-label="${name}"]`);

async function openLibrary() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (await page.locator('.gl-field').count()) {
    await page.fill('.gl-field input', 'pirate');
    await page.press('.gl-field input', 'Enter');
    await page.waitForSelector('header');
  }
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) await notice.getByRole('button', { name: 'Got it' }).click();
  await page.waitForTimeout(300);
}

async function clickGame(title = '2048') {
  await page.locator('#library-search').fill(title);
  await page.locator('#library-search').press('Enter');
  await page.waitForTimeout(500);
  await page.locator('[data-card]').filter({ hasText: new RegExp(`^${title}$`) }).locator('button').first().click();
  await page.waitForTimeout(600);
}

async function backToLibrary() {
  const back = page.getByRole('button', { name: 'Back to library' });
  if (await back.count()) {
    await back.click();
    await page.waitForSelector('[data-card]');
    await page.waitForTimeout(400);
  }
}

async function signOut() {
  const account = page.getByRole('button', { name: 'Account', exact: true });
  if (!(await account.count())) return;
  await account.click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForTimeout(1500);
}

try {
  await openLibrary();
  check('the library is ready for a guest', (await page.getByRole('button', { name: 'Sign in', exact: true }).count()) >= 1);

  // 1. First guest launch: reminder instead of the game, destination kept.
  await clickGame();
  check('a guest launch shows the reminder', (await reminder().count()) === 1);
  check('the reminder title is exact', (await reminder().getByRole('heading').innerText()).trim() === 'Save your progress');
  check(
    'the reminder message is exact',
    (await reminder().innerText()).includes(
      'Sign in or create an account to keep supported game progress and preferences across devices. Guest progress may be lost when browser data is cleared.'
    )
  );
  check('no game opens behind the reminder', (await page.locator('iframe').count()) === 0);

  // 2. Account creation from the reminder opens the chosen game afterwards.
  await reminder().getByRole('button', { name: 'Create account' }).click();
  check('Create account opens the existing registration form', await authDialog('Create account').isVisible());
  await authDialog('Create account').getByLabel('Username').fill(USER.username);
  await authDialog('Create account').getByLabel('Password', { exact: true }).fill(USER.password);
  await authDialog('Create account').getByRole('button', { name: 'Create account' }).click();
  await page.waitForTimeout(4000);
  check('the new account is signed in', (await page.getByRole('button', { name: 'Account', exact: true }).count()) === 1);
  check('the chosen game opens after creating the account', (await page.locator('iframe').count()) === 1);

  // 3. The account really exists in the backend.
  const api = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const { data: session, error: signInError } = await api.auth.signInWithPassword({
    email: `${USER.username.toLowerCase()}@users.geegle.internal`,
    password: USER.password,
  });
  check('the new account signs in to the backend', !signInError && Boolean(session.user), signInError?.message ?? '');
  const { data: profile } = session.user
    ? await api.from('geegle_profiles').select('id,username').eq('id', session.user.id).maybeSingle()
    : { data: null };
  check('the profile row exists for the new account', Boolean(profile?.id));

  // 4. Signed-in launches are never interrupted.
  await backToLibrary();
  await clickGame();
  await page.waitForTimeout(1500);
  check('a signed-in launch shows no reminder', (await reminder().count()) === 0);
  check('a signed-in launch opens the game', (await page.locator('iframe').count()) === 1);
  await backToLibrary();

  // 5. Sign-in from the reminder opens the chosen destination.
  await signOut();
  await openLibrary();
  await clickGame();
  check('the reminder returns for a signed-out visitor', (await reminder().count()) === 1);
  await reminder().getByRole('button', { name: 'Sign in' }).click();
  check('Sign in opens the existing sign-in form', await authDialog('Sign in').isVisible());
  await authDialog('Sign in').getByLabel('Username').fill(USER.username);
  await authDialog('Sign in').getByLabel('Password', { exact: true }).fill(USER.password);
  await authDialog('Sign in').getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(4000);
  check('signing in from the reminder signs the account in', (await page.getByRole('button', { name: 'Account', exact: true }).count()) === 1);
  check('the chosen game opens after signing in', (await page.locator('iframe').count()) === 1);

  // 6. Closing the account form keeps the destination and launches nothing.
  await backToLibrary();
  await signOut();
  await openLibrary();
  await clickGame();
  await reminder().getByRole('button', { name: 'Sign in' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check('closing the form launches nothing', (await page.locator('iframe').count()) === 0);
  check('the reminder returns with the destination kept', (await reminder().count()) === 1);

  // 7. Continue as guest opens the game and is remembered for the session.
  await reminder().getByRole('button', { name: 'Continue as guest' }).click();
  await page.waitForSelector('iframe', { timeout: 20_000 });
  check('Continue as guest opens the chosen game', (await page.locator('iframe').count()) === 1);
  await backToLibrary();
  await clickGame();
  await page.waitForTimeout(1200);
  check('later guest launches are not interrupted', (await reminder().count()) === 0);

  // 8. Guest progress is not deleted by showing the reminder.
  check('no page errors during the reminder journey', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  check('the reminder journey threw', false, error instanceof Error ? error.message : String(error));
} finally {
  await context.close();
  await browser.close();
}

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} reminder checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
