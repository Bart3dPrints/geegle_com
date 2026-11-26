// End-to-end journey against the production build and the isolated Supabase
// test project. Run with the preview server already listening:
//
//   npx vite preview --host 127.0.0.1 --port 4173
//   node scripts/qa/journey.mjs
//
// It drives a fresh browser context through the whole intended user journey,
// records console errors, page errors and failed requests, and writes
// screenshots to docs/qa/.

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4173';
const USER_A = { username: 'qauser1', password: 'GeegleTest123!' };
const USER_B = { username: 'qauser2', password: 'GeegleTest123!' };

mkdirSync('docs/qa', { recursive: true });

// Deterministic starting point: the isolated test accounts start with no
// favorites, history, saves or settings. Uses only the public anon key.
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

async function resetAccount(username) {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${username}@users.geegle.internal`, password: USER_A.password }),
  });
  const session = await response.json();
  if (!session.access_token) throw new Error(`could not sign in ${username} to reset: ${response.status}`);
  const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` };
  // Settings have no client DELETE grant by design, so reset the JSON in place.
  const settings = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/geegle_user_settings?id=eq.${session.user.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: {} }),
  });
  if (!settings.ok) throw new Error(`could not reset settings: ${settings.status}`);
  for (const table of ['geegle_favorites', 'geegle_recently_played', 'geegle_game_saves']) {
    const cleared = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?user_id=eq.${session.user.id}`, {
      method: 'DELETE',
      headers,
    });
    if (!cleared.ok) throw new Error(`could not reset ${table}: ${cleared.status}`);
  }
}

await resetAccount(USER_A.username);
await resetAccount(USER_B.username);

const results = [];
const problems = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail: String(detail) });
  if (!ok) problems.push(`${name}: ${detail}`);
};

function watch(page, label) {
  page.on('pageerror', (error) => problems.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    // Games are third-party documents; their engine warnings are not Geegle's.
    const text = message.text();
    const engineNoise = /emscripten_set_main_loop|requestAnimationFrame for the main loop/i.test(text);
    if (message.type() === 'error' && !engineNoise && !message.location().url.includes('/games/')) {
      problems.push(`${label} console: ${text}`);
    }
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.startsWith('http://127.0.0.1:4173')) {
      problems.push(`${label} requestfailed: ${url} ${request.failure()?.errorText}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
}

const browser = await chromium.launch();

// ---------------------------------------------------------------- desktop
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
watch(page, 'desktop');

await page.goto(BASE, { waitUntil: 'networkidle' });
check('landing title is exactly Geegle', (await page.title()) === 'Geegle', await page.title());
check('landing has no Games shortcut', (await page.getByRole('button', { name: 'Games', exact: true }).count()) === 0);
check('landing has a neutral avatar', (await page.locator('.gl-avatar').count()) === 1);
await page.screenshot({ path: 'docs/qa/landing-desktop.png' });

// Normal web search from the landing page opens a real search destination.
const popupPromise = context.waitForEvent('page');
await page.locator('input[aria-label="Search the web"]').fill('weather today');
await page.getByRole('button', { name: 'Geegle Search' }).click();
const popup = await popupPromise;
check('normal search opens google.com results', popup.url().startsWith('https://www.google.com/search'), popup.url());
await popup.close();

// pirate → library, directly.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.locator('input[aria-label="Search the web"]').fill('pirate');
await page.locator('input[aria-label="Search the web"]').press('Enter');
await page.waitForSelector('footer', { timeout: 15000 });
check('pirate opens the library', page.url().endsWith('#games'), page.url());
check('footer is exact', (await page.locator('footer').innerText()).trim() === 'Bart made this. Thank him', await page.locator('footer').innerText());
check('one navigation area with three sections', (await page.locator('header nav[aria-label="Sections"] button').count()) === 3);
check('no password page appears', (await page.locator('input[type=password]').count()) === 0);
check('alphabetical sections exist', (await page.locator('main section[id^="letter-"]').count()) >= 20, await page.locator('main section[id^="letter-"]').count());
check('every catalog entry renders', (await page.locator('[data-card]').count()) === 2621, await page.locator('[data-card]').count());
await page.screenshot({ path: 'docs/qa/library-desktop.png' });

// Alphabetical sidebar jumps.
const rail = page.locator('aside nav[aria-label="Alphabetical navigation"]');
await rail.getByRole('button', { name: 'Jump to M' }).click();
await page.waitForTimeout(700);
const jumped = await page.evaluate(() => window.scrollY);
check('sidebar letter jumps the page', jumped > 200, `scrollY=${jumped}`);
const heading = await page.locator('#letter-M').boundingBox();
check('jump lands on the M section', Boolean(heading) && heading.y > 60 && heading.y < 220, JSON.stringify(heading));

// Category filter.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
const allCount = await page.locator('[data-card]').count();
await page.getByRole('tab', { name: 'Puzzle', exact: true }).click();
await page.waitForTimeout(400);
const puzzleCount = await page.locator('[data-card]').count();
check('category filter reduces the grid', puzzleCount > 0 && puzzleCount < allCount, `${puzzleCount}/${allCount}`);
await page.getByRole('tab', { name: 'All', exact: true }).click();
await page.waitForTimeout(300);

// Fuzzy search with a misspelled name.
await page.locator('button[aria-label="Search games and apps"]').click();
await page.locator('input[aria-label="Search query"]').fill('amogn us');
await page.waitForTimeout(300);
const searchHtml = await page.getByRole('dialog', { name: 'Search games' }).innerText();
check('misspelled search finds Among Us', /among us/i.test(searchHtml), searchHtml.slice(0, 120));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// Sign in against the isolated backend.
await page.locator('button[aria-label="Sign in"]').click();
await page.locator('#auth-username').fill(USER_A.username);
await page.locator('#auth-password').fill(USER_A.password);
await page.locator('form button[type=submit]').click();
await page.waitForSelector('button[aria-label="Account"]', { timeout: 20000 });
check('username/password sign-in works', true);

// Star the first game.
const firstFavorite = page.locator('[data-card] button[aria-label^="Add "]').first();
const favoriteLabel = await firstFavorite.getAttribute('aria-label');
const favoriteLabelAfter = favoriteLabel.replace(/^Add /, 'Remove ').replace(/ to favorites$/, ' from favorites');
await firstFavorite.click();
await page.waitForFunction(
  (label) => [...document.querySelectorAll('[data-card] button[aria-pressed="true"]')]
    .some((button) => button.getAttribute('aria-label') === label),
  favoriteLabelAfter,
  { timeout: 10000 }
);
check('the clicked star becomes a favorite', true, favoriteLabelAfter);
check('Starred section appears', (await page.getByRole('heading', { name: 'Starred' }).count()) === 1);

// Settings: enable Recently Played (the header Settings button, not the
// account dropdown, which holds only Sign out).
await page.locator('header button[aria-label="Settings"]').click();
await page.waitForSelector('input[type=checkbox]');
check('Recently Played is off by default', !(await page.locator('input[type=checkbox]').isChecked()));
await page.locator('input[type=checkbox]').check();
await page.locator('button[aria-label="Close settings"]').click();
check('Recently Played stays hidden before any play', (await page.getByRole('heading', { name: 'Recently Played' }).count()) === 0);

// Open a game and use fullscreen.
await page.locator('[data-card] button[aria-label^="Play "]').first().click();
// A guest is offered the account reminder once before the first game opens.
const guestReminder = page.getByRole('button', { name: 'Continue as guest' });
if (await guestReminder.count()) {
  await guestReminder.click();
  await page.waitForTimeout(400);
}
await page.waitForSelector('iframe', { timeout: 20000 });
check('game opens in the player', (await page.locator('iframe').count()) === 1);
await page.locator('button[aria-label="Fullscreen"]').focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
const fullscreen = await page.evaluate(() => Boolean(document.fullscreenElement));
check('fullscreen control engages', fullscreen, `fullscreenElement=${fullscreen}`);
if (fullscreen) await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Back', exact: true }).focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
check('returning to the library works', page.url().endsWith('#games'));
check('Recently Played appears after a play', (await page.getByRole('heading', { name: 'Recently Played' }).count()) === 1);

// Reload and reopen: session, favorites and settings persist.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('footer');
check('session survives a reload', (await page.locator('button[aria-label="Account"]').count()) === 1);
check('favorites survive a reload', (await page.locator('[data-card] button[aria-label^="Remove "]').count()) > 0);
check('Recently Played setting survives a reload', (await page.getByRole('heading', { name: 'Recently Played' }).count()) === 1);
await page.screenshot({ path: 'docs/qa/library-signed-in.png' });

const reopened = await context.newPage();
watch(reopened, 'reopened');
await reopened.goto(`${BASE}/#games`, { waitUntil: 'networkidle' });
await reopened.waitForSelector('footer');
check('login persists in a new tab', (await reopened.locator('button[aria-label="Account"]').count()) === 1);
await reopened.close();

// Log out, then verify account isolation.
await page.locator('button[aria-label="Account"]').click();
await page.getByRole('menuitem', { name: 'Sign out' }).click();
await page.waitForSelector('button[aria-label="Sign in"]', { timeout: 20000 });
check('logout returns to signed out', true);

await page.locator('button[aria-label="Sign in"]').click();
await page.locator('#auth-username').fill(USER_B.username);
await page.locator('#auth-password').fill(USER_B.password);
await page.locator('form button[type=submit]').click();
await page.waitForSelector('button[aria-label="Account"]', { timeout: 20000 });
await page.waitForTimeout(800);
check('second account starts with no favorites', (await page.locator('[data-card] button[aria-label^="Remove "]').count()) === 0);
check('second account has Recently Played off', (await page.getByRole('heading', { name: 'Recently Played' }).count()) === 0);

// ------------------------------------------------------------- responsive
for (const [label, viewport] of [
  ['chromebook', { width: 1366, height: 768 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const sized = await browser.newContext({ viewport });
  const view = await sized.newPage();
  watch(view, label);
  await view.goto(`${BASE}/#games`, { waitUntil: 'networkidle' });
  await view.waitForSelector('footer');
  const metrics = await view.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    cards: document.querySelectorAll('[data-card]').length,
    rail: document.querySelectorAll('nav[aria-label="Alphabetical navigation"] button').length,
    navVisible: [...document.querySelectorAll('header nav[aria-label="Sections"] button')].every(
      (button) => button.getBoundingClientRect().width > 0
    ),
  }));
  check(`${label} has no horizontal overflow`, metrics.overflow <= 1, JSON.stringify(metrics));
  check(`${label} keeps navigation and cards usable`, metrics.cards === 2621 && metrics.navVisible && metrics.rail > 0, JSON.stringify(metrics));
  await view.screenshot({ path: `docs/qa/library-${label}.png` });
  await sized.close();
}

// Reduced motion: the alphabetical jump must land immediately, not animate.
const calm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const calmPage = await calm.newPage();
watch(calmPage, 'reduced-motion');
await calmPage.goto(`${BASE}/#games`, { waitUntil: 'networkidle' });
await calmPage.waitForSelector('footer');
await calmPage.locator('aside nav[aria-label="Alphabetical navigation"]').getByRole('button', { name: 'Jump to M' }).click();
await calmPage.waitForTimeout(120);
const calmScroll = await calmPage.evaluate(() => window.scrollY);
check('reduced motion jumps without animating', calmScroll > 200, `scrollY=${calmScroll}`);
await calm.close();

await context.close();
await browser.close();

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({
  passed: results.length - failed.length,
  failed: failed.length,
  problems,
  results,
}, null, 2));
process.exitCode = failed.length > 0 || problems.length > 0 ? 1 : 0;
