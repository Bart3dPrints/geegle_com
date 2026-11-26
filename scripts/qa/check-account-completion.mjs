// Account-system acceptance run against a real Supabase backend that requires
// email confirmation (the same condition as production).
//
// It drives the actual interface, so it exercises the sign-up path that
// previously returned a generic error, then checks the account system:
// registration, duplicate and case-insensitive duplicate usernames, session
// persistence, logout, reauthenticated password change, and cross-account
// rejection at the database API.
//
// Run with the app pointed at the backend under test:
//   node --env-file=.env.qa.local scripts/qa/check-account-completion.mjs
//   GEEGLE_AUTH_BASE=http://127.0.0.1:5174 ...
//
// The production-simulation backend is a local Supabase stack (Postgres +
// GoTrue + PostgREST behind Kong) with GOTRUE_MAILER_AUTOCONFIRM=false and
// migration 0005 applied. No hosted data is touched.

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.GEEGLE_AUTH_BASE ?? 'http://127.0.0.1:5174';
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (use --env-file).');
  process.exit(1);
}

const stamp = Date.now().toString(36).slice(-7);
const PASSWORD = 'GeegleTest123!';
const NEW_PASSWORD = 'GeegleTest456!';
const ACCOUNT = { username: `acc${stamp}`, password: PASSWORD };
const OTHER = { username: `oth${stamp}`, password: PASSWORD };

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

async function openLibrary() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (await page.locator('.gl-field').count()) {
    await page.fill('.gl-field input', 'pirate');
    await page.press('.gl-field input', 'Enter');
    await page.waitForSelector('header');
  }
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) {
    await notice.getByRole('button', { name: 'Got it' }).click().catch(() => {});
  }
  await page.waitForTimeout(300);
}

async function openAccountDialog(mode) {
  await page.getByRole('button', { name: /Sign in/ }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.waitFor({ state: 'visible', timeout: 4000 });
  if (mode === 'register') {
    await dialog.getByRole('button', { name: /Create one/ }).click();
    dialog = page.getByRole('dialog', { name: 'Create account' });
    await dialog.waitFor({ state: 'visible', timeout: 4000 });
  }
  return dialog;
}

async function submitAccount(mode, user, password) {
  const dialog = await openAccountDialog(mode);
  await dialog.getByLabel('Username').fill(user.username);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: mode === 'register' ? 'Create account' : 'Sign in' }).click();
  await page.waitForTimeout(2500);
  return page.getByRole('dialog', { name: mode === 'register' ? 'Create account' : 'Sign in' });
}

async function dismissNotice() {
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) {
    await notice.getByRole('button', { name: 'Got it' }).click().catch(() => {});
    await notice.waitFor({ state: 'detached', timeout: 2500 }).catch(() => {});
  }
}

async function signOut() {
  await dismissNotice();
  if (!(await page.getByRole('button', { name: 'Account', exact: true }).count())) return;
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForTimeout(1500);
}

const signedIn = () => page.getByRole('button', { name: 'Account', exact: true }).count().then((n) => n > 0);

try {
  // 1. Registration through the real interface on a confirmation-required project.
  await openLibrary();
  const afterRegister = await submitAccount('register', ACCOUNT, PASSWORD);
  const registerText = await afterRegister.innerText().catch(() => '');
  check(
    'registration through the interface creates an active account',
    await signedIn(),
    registerText ? registerText.replace(/\s+/g, ' ').slice(0, 120) : ''
  );

  // 2. The session survives a reload.
  await page.reload({ waitUntil: 'networkidle' });
  await dismissNotice();
  await page.waitForTimeout(1500);
  check('session survives a reload', await signedIn());

  // 3. Logout removes access to account surfaces.
  await signOut();
  check('logout returns to the signed-out state', !(await signedIn()));

  // 4. Duplicate username is refused with a clear message.
  const dup = await submitAccount('register', ACCOUNT, PASSWORD);
  const dupText = await dup.innerText().catch(() => '');
  check('duplicate username is refused', dupText.includes('already taken'), dupText.replace(/\s+/g, ' ').slice(0, 120));

  // 5. A differently capitalised duplicate is the same username.
  await page.keyboard.press('Escape');
  const upper = await submitAccount('register', { username: ACCOUNT.username.toUpperCase() }, PASSWORD);
  const upperText = await upper.innerText().catch(() => '');
  check(
    'differently capitalised duplicate is refused',
    upperText.includes('already taken'),
    upperText.replace(/\s+/g, ' ').slice(0, 120)
  );

  // 6. Surrounding whitespace is normalised, not a new account.
  await page.keyboard.press('Escape');
  const padded = await submitAccount('register', { username: `  ${ACCOUNT.username}  ` }, PASSWORD);
  const paddedText = await padded.innerText().catch(() => '');
  check(
    'surrounding whitespace does not create a second account',
    paddedText.includes('already taken'),
    paddedText.replace(/\s+/g, ' ').slice(0, 120)
  );

  // 7. The new account can sign in.
  await page.keyboard.press('Escape');
  await submitAccount('login', ACCOUNT, PASSWORD);
  check('the new account signs in', await signedIn());

  // 8. Password change requires the current password.
  await dismissNotice();
  await page.getByRole('button', { name: 'Settings' }).click();
  let settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('tab', { name: 'Preferences' }).click();
  // Password visibility: independent per field, and never a submit.
  const currentInput = settings.locator('input[aria-label="Current password"]');
  const newInput = settings.locator('input[aria-label="New password"]');
  check(
    'Settings passwords start hidden',
    (await currentInput.getAttribute('type')) === 'password' && (await newInput.getAttribute('type')) === 'password'
  );
  await currentInput.locator('..').getByRole('button', { name: 'Show password' }).click();
  check(
    'revealing one field leaves the other hidden',
    (await currentInput.getAttribute('type')) === 'text' && (await newInput.getAttribute('type')) === 'password'
  );
  await newInput.locator('..').getByRole('button', { name: 'Show password' }).click();
  check('both fields can be revealed independently', (await newInput.getAttribute('type')) === 'text');
  await newInput.locator('..').getByRole('button', { name: 'Hide password' }).click();
  check(
    'hiding one field leaves the other revealed',
    (await currentInput.getAttribute('type')) === 'text' && (await newInput.getAttribute('type')) === 'password'
  );
  await currentInput.locator('..').getByRole('button', { name: 'Hide password' }).click();
  check('both fields hide again', (await currentInput.getAttribute('type')) === 'password');
  check('toggling visibility does not submit the form', !(await settings.innerText()).includes('Password updated'));

  await settings.getByLabel('Current password').fill('definitely-wrong');
  await settings.getByLabel('New password').fill(NEW_PASSWORD);
  await settings.getByRole('button', { name: 'Update password' }).click();
  await page.waitForTimeout(1800);
  check('wrong current password is refused', (await settings.innerText()).includes('Current password is incorrect'));

  await settings.getByLabel('Current password').fill(PASSWORD);
  await settings.getByLabel('New password').fill('short');
  await settings.getByRole('button', { name: 'Update password' }).click();
  await page.waitForTimeout(1200);
  check('short new password is refused', (await settings.innerText()).includes('at least 8 characters'));

  await settings.getByLabel('Current password').fill(PASSWORD);
  await settings.getByLabel('New password').fill(NEW_PASSWORD);
  await settings.getByRole('button', { name: 'Update password' }).click();
  await page.waitForTimeout(2200);
  check('correct current password changes the password', (await settings.innerText()).includes('Password updated'));
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(500);

  // 9. Old password no longer works, new one does.
  await signOut();
  const oldLogin = await submitAccount('login', ACCOUNT, PASSWORD);
  const oldText = await oldLogin.innerText().catch(() => '');
  check('the old password is rejected', oldText.includes('Invalid username or password'), oldText.slice(0, 100));
  await page.keyboard.press('Escape');
  await submitAccount('login', ACCOUNT, NEW_PASSWORD);
  check('the new password signs in', await signedIn());
  await signOut();

  // 10. Cross-account rejection at the database API, using real sessions.
  const A = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const B = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const aSignIn = await A.auth.signInWithPassword({ email: `${ACCOUNT.username}@users.geegle.internal`, password: NEW_PASSWORD });
  // Second account is created through the API with the same fixed path.
  const bSignUp = await B.auth.signUp({
    email: `${OTHER.username}@users.geegle.internal`,
    password: PASSWORD,
    options: { data: { username: OTHER.username } },
  });
  const aId = aSignIn.data.user?.id;
  const bId = bSignUp.data.user?.id;
  check('two independent accounts exist for isolation testing', Boolean(aId && bId), `${Boolean(aId)}/${Boolean(bId)}`);

  if (aId && bId) {
    const writeOtherFavorite = await A
      .from('geegle_favorites')
      .insert({ user_id: bId, game_id: 'isolation-probe' })
      .select();
    check(
      'account A cannot write a favorite for account B',
      Boolean(writeOtherFavorite.error),
      writeOtherFavorite.error?.code ?? 'no error returned'
    );

    const readOtherFavorites = await A.from('geegle_favorites').select('user_id,game_id').eq('user_id', bId);
    check(
      'account A cannot read account B favorites',
      (readOtherFavorites.data ?? []).length === 0 && !readOtherFavorites.error,
      `rows=${(readOtherFavorites.data ?? []).length}`
    );

    const writeOtherSave = await A
      .from('geegle_game_saves')
      .insert({ user_id: bId, game_id: 'isolation-probe', save_data: { stolen: true } })
      .select();
    check(
      'account A cannot write a cloud save for account B',
      Boolean(writeOtherSave.error),
      writeOtherSave.error?.code ?? 'no error returned'
    );

    const readOtherProfile = await A.from('geegle_profiles').select('id,username').eq('id', bId);
    check(
      'account A cannot read account B profile',
      (readOtherProfile.data ?? []).length === 0,
      `rows=${(readOtherProfile.data ?? []).length}`
    );

    const readOtherSettings = await A.from('geegle_user_settings').select('id').eq('id', bId);
    check(
      'account A cannot read account B settings',
      (readOtherSettings.data ?? []).length === 0,
      `rows=${(readOtherSettings.data ?? []).length}`
    );

    const patchOtherSettings = await A
      .from('geegle_user_settings')
      .update({ theme: 'dark' })
      .eq('id', bId)
      .select();
    check(
      'account A cannot modify account B settings',
      (patchOtherSettings.data ?? []).length === 0,
      `rows=${(patchOtherSettings.data ?? []).length}`
    );

    const deleteOtherFavorites = await A.from('geegle_favorites').delete().eq('user_id', bId).select();
    check(
      'account A cannot delete account B favorites',
      (deleteOtherFavorites.data ?? []).length === 0,
      `rows=${(deleteOtherFavorites.data ?? []).length}`
    );
  }

  // 11. Concurrent registration of one username creates exactly one account.
  const raceName = `race${stamp}`;
  const raceBody = JSON.stringify({ email: `${raceName}@users.geegle.internal`, password: PASSWORD });
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      fetch(`${SUPA_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY },
        body: raceBody,
      }).then((response) => response.json().then((body) => ({ status: response.status, body })))
    )
  );
  const sessions = responses.filter((entry) => entry.body?.access_token).length;
  check('concurrent duplicate registration yields one account', sessions === 1, `sessions=${sessions}`);
} catch (error) {
  check('account journey threw', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} account checks passed`);
if (pageErrors.length) console.log('page errors:', pageErrors.join(' | '));
process.exit(failed.length ? 1 : 0);
