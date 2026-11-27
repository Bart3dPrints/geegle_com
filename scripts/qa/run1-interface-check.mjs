#!/usr/bin/env node
// Browser acceptance for the settings, personalization and navigation work.
//
// Runs against the local development server (or GEEGLE_BASE) in a real
// Chromium instance. Account checks use the isolated backend configured by
// .env.local and disposable accounts; nothing is written to production.
//
// Usage: node scripts/qa/run1-interface-check.mjs

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
const PASSWORD = 'Run1TestPass!23';
const NEW_PASSWORD = 'Run1TestPass!45';
const suffix = Date.now().toString(36).slice(-6);
const USER_A = `run1a${suffix}`;
const USER_B = `run1b${suffix}`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
const near = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance;

// A 2×2 PNG is enough to exercise the real upload, decode and encode path.
const WALLPAPER = join(tmpdir(), 'geegle-run1-wallpaper.png');
writeFileSync(
  WALLPAPER,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4GBgYGJAQ0AAG0cAxHc1c0yAAAAAElFTkSuQmCC',
    'base64'
  )
);

async function dismissNotice(page) {
  const got = page.getByRole('button', { name: 'Got it', exact: true });
  if (await got.count()) await got.first().click();
  await page.waitForTimeout(200);
}

async function openLibrary(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    history.replaceState({ geegleView: 'library' }, '', location.pathname);
    location.reload();
  });
  await page.waitForSelector('header');
  await page.waitForTimeout(500);
  const got = page.getByRole('button', { name: 'Got it', exact: true });
  if (await got.count()) await got.first().click();
  await page.waitForTimeout(200);
}

async function openSettings(page, tab) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.waitFor();
  if (tab) await dialog.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(150);
  return dialog;
}

async function register(page, username) {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: /Create one/ }).click();
  const form = page.getByRole('dialog', { name: 'Create account' });
  await form.waitFor();
  await form.getByLabel('Username').fill(username);
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).waitFor({ timeout: 15000 });
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor({ timeout: 15000 });
}

async function signIn(page, username, password) {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.waitFor();
  await dialog.getByLabel('Username').fill(username);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).waitFor({ timeout: 15000 });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

try {
  await openLibrary(page);

  // ── 8. Alphabetical rail at every required viewport ──────────────────────
  const VIEWPORTS = [
    { width: 1024, height: 600 },
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    const rail = await page.evaluate(() => {
      const navs = [...document.querySelectorAll('nav[aria-label="Alphabetical navigation"]')];
      const nav = navs.find((element) => element.getBoundingClientRect().width > 0);
      if (!nav) return null;
      const buttons = [...nav.querySelectorAll('button')];
      const rects = buttons.map((button) => button.getBoundingClientRect());
      return {
        labels: buttons.map((button) => button.textContent.trim()),
        tops: rects.map((rect) => rect.top),
        bottoms: rects.map((rect) => rect.bottom),
        height: nav.getBoundingClientRect().height,
        clientHeight: nav.clientHeight,
        scrollHeight: nav.scrollHeight,
        viewportHeight: window.innerHeight,
      };
    });
    check(
      `${size.width}×${size.height}: all 28 rail entries exist in order`,
      rail &&
        rail.labels.length === 28 &&
        rail.labels[0] === 'FAV' &&
        rail.labels[1] === '#' &&
        rail.labels[2] === 'A' &&
        rail.labels[27] === 'Z',
      rail ? `${rail.labels.length} entries` : 'rail missing'
    );
    check(
      `${size.width}×${size.height}: FAV and Z are inside the viewport`,
      rail &&
        rail.tops[0] >= 0 &&
        rail.bottoms[27] <= rail.viewportHeight + 1 &&
        Math.min(...rail.bottoms) <= rail.viewportHeight,
      rail ? `FAV top ${rail.tops[0].toFixed(1)}, Z bottom ${rail.bottoms[27].toFixed(1)} of ${rail.viewportHeight}` : ''
    );
    check(
      `${size.width}×${size.height}: no rail entry is cut off (no internal scroll)`,
      rail && rail.scrollHeight <= rail.clientHeight + 1,
      rail ? `scroll ${rail.scrollHeight}/${rail.clientHeight}` : ''
    );
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);

  // ── 3. Settings window size across sections ─────────────────────────────
  const dialog = await openSettings(page, 'Theme');
  const sizes = [];
  for (const tab of ['Theme', 'Appearance', 'Preferences', 'Tab appearance', 'Changelog']) {
    await dialog.getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(120);
    const box = await dialog.locator(':scope > div').boundingBox();
    sizes.push({ tab, width: box.width, height: box.height });
  }
  const heights = sizes.map((size) => size.height);
  const widths = sizes.map((size) => size.width);
  check(
    'Settings keeps one external size across all five sections',
    heights.every((height) => near(height, heights[0])) && widths.every((width) => near(width, widths[0])),
    sizes.map((size) => `${size.tab} ${size.height.toFixed(1)}×${size.width.toFixed(1)}`).join(', ')
  );
  check(
    'Settings content scrolls internally instead of growing the window',
    await dialog.locator('.overflow-y-auto').count() > 0
  );

  // Smaller screens: the window stays inside the viewport.
  for (const size of [{ width: 1024, height: 600 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    const box = await dialog.locator(':scope > div').boundingBox();
    check(
      `${size.width}×${size.height}: Settings fits the viewport`,
      box && box.height <= size.height - 30 && box.width <= size.width - 30,
      box ? `${box.height.toFixed(0)}×${box.width.toFixed(0)}` : 'no box'
    );
    check(
      `${size.width}×${size.height}: no horizontal scrolling in Settings`,
      await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);
  await dialog.getByRole('tab', { name: 'Theme', exact: true }).click();

  // ── 7. Closing animation (both directions) ──────────────────────────────
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(40);
  const closingOpacity = await page
    .getByRole('dialog', { name: 'Settings' })
    .evaluate((element) => Number(getComputedStyle(element).opacity))
    .catch(() => 1);
  await page.waitForTimeout(350);
  const stillOpen = await page.getByRole('dialog', { name: 'Settings' }).count();
  check('Settings closes with an animation, not an abrupt removal', closingOpacity < 1 && stillOpen === 0, `opacity ${closingOpacity}`);

  // Favorite one game so reset checks can prove favorites are untouched.
  const firstStar = page.locator('button[aria-pressed][aria-label*="Star"], button[aria-pressed][aria-label*="star"]').first();
  const starCount = await firstStar.count();
  let favId = null;
  if (starCount) {
    favId = await firstStar.getAttribute('aria-label');
    await firstStar.click();
    await page.waitForTimeout(300);
  }

  // ── 5. Personalization ─────────────────────────────────────────────────
  const headerBefore = await page.evaluate(() => document.querySelector('header').getBoundingClientRect().height);
  const dialog2 = await openSettings(page, 'Appearance');

  await dialog2.getByRole('button', { name: 'Green', exact: true }).click();
  await page.waitForTimeout(500);
  const accent = await page.evaluate(() => ({
    variable: getComputedStyle(document.documentElement).getPropertyValue('--geegle-accent').trim(),
    contrast: getComputedStyle(document.documentElement).getPropertyValue('--geegle-accent-contrast').trim(),
    chip: getComputedStyle(document.querySelector('button[role="tab"][aria-selected="true"]')).backgroundColor,
  }));
  check('accent preset applies to interface elements', accent.variable === '#15803d' && accent.chip === 'rgb(21, 128, 61)', JSON.stringify(accent));
  check('accent selects a readable text colour', accent.contrast === '#ffffff');

  await dialog2.getByLabel('Font', { exact: true }).selectOption('serif');
  await page.waitForTimeout(400);
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  check('font selection changes the interface typeface', /Georgia/i.test(font), font);

  await dialog2.getByLabel('Text colour').evaluate((input) => {
    // React tracks its own value, so use the native setter before dispatching.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '#123456');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const textColor = await page.evaluate(() => getComputedStyle(document.body).color);
  check('font colour applies to text', textColor === 'rgb(18, 52, 86)', textColor);

  // Wallpaper via the real file input.
  await dialog2.getByLabel('Choose image').setInputFiles(WALLPAPER);
  await page.waitForTimeout(1200);
  const wallpaper = await page.evaluate(() => {
    const background = getComputedStyle(document.body).backgroundImage;
    return {
      applied: /data:image\/webp/.test(background),
      scrim: /linear-gradient/.test(background),
      stored: (localStorage.getItem('geegle-appearance') ?? '').includes('data:image/webp'),
    };
  });
  check(
    'uploaded wallpaper is optimized to WebP and applied with a readability scrim',
    wallpaper.applied && wallpaper.scrim && wallpaper.stored,
    JSON.stringify(wallpaper)
  );

  // Widgets: enabled individually, and they do not grow the header.
  await dialog2.getByLabel('Clock', { exact: true }).check();
  await dialog2.getByLabel('Date', { exact: true }).check();
  await page.waitForTimeout(500);
  const headerAfter = await page.evaluate(() => document.querySelector('header').getBoundingClientRect().height);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(400);
  const widgetText = await page.evaluate(() => {
    const header = document.querySelector('header');
    const text = header.innerText;
    return { hasTime: /\d{1,2}:\d{2}\s?(AM|PM)/.test(text), hasDate: /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/.test(text) };
  });
  check('clock and date widgets render in the header', widgetText.hasTime && widgetText.hasDate, JSON.stringify(widgetText));
  check('widgets do not increase the header height', near(headerBefore, headerAfter, 0.5), `${headerBefore.toFixed(1)} → ${headerAfter.toFixed(1)}`);

  // ── 6. Persistence across reload ───────────────────────────────────────
  await page.reload();
  await page.waitForSelector('header');
  await page.waitForTimeout(900);
  const gotAgain = page.getByRole('button', { name: 'Got it', exact: true });
  if (await gotAgain.count()) await gotAgain.first().click();
  const persisted = await page.evaluate(() => ({
    accent: getComputedStyle(document.documentElement).getPropertyValue('--geegle-accent').trim(),
    font: getComputedStyle(document.body).fontFamily,
    color: getComputedStyle(document.body).color,
    wallpaper: document.body.style.backgroundImage.includes('data:image/webp'),
    widgets: /\d{1,2}:\d{2}\s?(AM|PM)/.test(document.querySelector('header').innerText),
    favorites: JSON.parse(localStorage.getItem('geegle-favorites') ?? '[]'),
  }));
  check(
    'personalization persists across a page reload',
    persisted.accent === '#15803d' &&
      /Georgia/i.test(persisted.font) &&
      persisted.color === 'rgb(18, 52, 86)' &&
      persisted.wallpaper &&
      persisted.widgets,
    JSON.stringify({ ...persisted, favorites: persisted.favorites.length })
  );

  // ── 9. Changelog sorting ───────────────────────────────────────────────
  const dialog3 = await openSettings(page, 'Changelog');
  const newestFirst = await dialog3.locator('ol li time').allTextContents();
  await dialog3.getByLabel('Sort releases').selectOption('oldest');
  await page.waitForTimeout(250);
  const oldestFirst = await dialog3.locator('ol li time').allTextContents();
  check(
    'Changelog sorts newest first by default and reverses on request',
    newestFirst.length > 1 &&
      newestFirst[0] === oldestFirst[oldestFirst.length - 1] &&
      newestFirst[newestFirst.length - 1] === oldestFirst[0],
    `${newestFirst.length} releases; first ${newestFirst[0]}`
  );
  const explanatory = await dialog3.innerText();
  check('Changelog has no sorting explanation', !/Times are Eastern/.test(explanatory) && !/Newest first\./.test(explanatory));

  // ── 5. Reset all personalization keeps favorites ───────────────────────
  await dialog3.getByRole('tab', { name: 'Appearance', exact: true }).click();
  await dialog3.getByRole('button', { name: 'Reset all personalization' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(400);
  const reset = await page.evaluate(() => ({
    accent: getComputedStyle(document.documentElement).getPropertyValue('--geegle-accent').trim(),
    font: getComputedStyle(document.body).fontFamily,
    color: getComputedStyle(document.body).color,
    wallpaper: document.body.style.backgroundImage,
    widgets: /\d{1,2}:\d{2}\s?(AM|PM)/.test(document.querySelector('header').innerText),
    favorites: JSON.parse(localStorage.getItem('geegle-favorites') ?? '[]'),
    favoritesCards: document.querySelectorAll('#starred button[aria-pressed="true"]').length,
  }));
  const resetInline = await page.evaluate(() => ({
    accent: document.documentElement.style.getPropertyValue('--geegle-accent'),
    color: document.documentElement.style.getPropertyValue('--geegle-text'),
  }));
  check(
    'reset restores the neutral defaults',
    resetInline.accent === '' &&
      resetInline.color === '' &&
      !/Georgia/i.test(reset.font) &&
      reset.color === 'rgb(23, 23, 23)' &&
      reset.wallpaper === '' &&
      reset.widgets === false,
    JSON.stringify({ ...reset, ...resetInline })
  );
  check('reset does not delete favorites', !favId || (reset.favorites.length > 0 && reset.favoritesCards > 0), `${reset.favorites.length} favorites`);

  // ── 4/6. Account menu, Preferences, password change, isolation ─────────
  await register(page, USER_A);

  const dialog4 = await openSettings(page, 'Appearance');
  await dialog4.getByRole('button', { name: 'Amber', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Account menu' });
  const menuItems = await menu.getByRole('menuitem').allTextContents();
  check(
    'account dropdown lists Preferences then Sign out',
    menuItems.length === 2 && /Preferences/.test(menuItems[0]) && /Sign out/.test(menuItems[1]),
    menuItems.join(' | ')
  );
  await menu.getByRole('menuitem', { name: 'Preferences' }).click();
  const prefsDialog = page.getByRole('dialog', { name: 'Settings' });
  await prefsDialog.waitFor();
  const prefsSelected = await prefsDialog
    .getByRole('tab', { name: 'Preferences', exact: true })
    .getAttribute('aria-selected');
  check('Preferences opens the account settings section', prefsSelected === 'true');

  // Password change re-verifies the current password before changing it.
  const currentFieldRequired = await prefsDialog
    .getByLabel('Current password', { exact: true })
    .getAttribute('required');
  check('password change requires the current password field', currentFieldRequired !== null);

  await prefsDialog.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await prefsDialog.getByLabel('Current password', { exact: true }).fill('DefinitelyWrong!1');
  await prefsDialog.getByRole('button', { name: 'Update password' }).click();
  await page.waitForTimeout(2500);
  const wrongCurrent = await prefsDialog.getByRole('alert').innerText();
  check('a wrong current password is rejected', /incorrect/i.test(wrongCurrent), wrongCurrent);

  await prefsDialog.getByLabel('Current password', { exact: true }).fill(PASSWORD);
  await prefsDialog.getByRole('button', { name: 'Update password' }).click();
  await page.waitForTimeout(2500);
  const changed = await prefsDialog.getByRole('alert').innerText();
  check('password changes for an authenticated user', /Password updated/.test(changed), changed);

  // Visibility toggles exist on both password fields.
  const toggles = await prefsDialog.getByRole('button', { name: 'Show password' }).count();
  check('password visibility toggles are available', toggles >= 2, `${toggles} controls`);

  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(300);

  // Cross-device persistence: accent survives a reload for the account.
  await page.reload();
  await page.waitForSelector('header');
  await page.waitForTimeout(1200);
  await dismissNotice(page);
  const acctAccent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--geegle-accent').trim()
  );
  check('account preferences persist across a session', acctAccent === '#b45309', acctAccent);

  await signOut(page);
  await signIn(page, USER_A, NEW_PASSWORD);
  check('the new password signs in', true);

  await signOut(page);
  await register(page, USER_B);
  // Account preferences load asynchronously after the session appears.
  await page.waitForTimeout(1800);
  const secondAccent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--geegle-accent').trim()
  );
  check('a second account does not inherit the first account\'s preferences', secondAccent !== '#b45309', `accent "${secondAccent}"`);

  // ── 1/11. Existing search and navigation still work ────────────────────
  await page.getByRole('searchbox').or(page.getByPlaceholder('Search games, apps and proxies')).first().fill('amogn us');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const searchResults = await page.locator('main img.geegle-art').count();
  check('fuzzy search still filters the library', searchResults > 0 && searchResults < 50, `${searchResults} results`);
  const clear = page.getByRole('button', { name: /Clear/i }).first();
  if (await clear.count()) await clear.click();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const navDiagnostic = await page.evaluate(() => {
    const button = [...document.querySelectorAll('nav[aria-label="Sections"] button')].find(
      (element) => element.textContent.trim().toLowerCase() === 'apps'
    );
    if (!button) return { found: false };
    const rect = button.getBoundingClientRect();
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { found: true, rect: [rect.x, rect.y, rect.width, rect.height], top: top?.outerHTML.slice(0, 140) };
  });
  if (!navDiagnostic.found || /fixed inset-0/.test(navDiagnostic.top ?? '')) {
    const where = await page.evaluate(() => ({
      url: location.href,
      text: document.body.innerText.slice(0, 160).replace(/\n/g, ' | '),
      headings: [...document.querySelectorAll('nav')].map((nav) => nav.getAttribute('aria-label')),
      errors: document.querySelectorAll('[role="alert"]').length,
    }));
    console.log('NAV DIAGNOSTIC', JSON.stringify({ ...navDiagnostic, ...where }));
  }
  await page.getByRole('button', { name: /^apps$/i }).click();
  await page.waitForTimeout(300);
  const apps = await page.locator('main section[aria-label="Apps"] img.geegle-art').count();
  check('Apps navigation still renders its cards', apps >= 5, `${apps} app cards`);

  // The owner-supplied Soundboard cover must be the card's real artwork.
  const soundboard = page.locator('main section[aria-label="Apps"] img[src="/artwork/soundboard.webp"]');
  await page.waitForTimeout(600);
  const soundboardState = await soundboard.first().evaluate(
    (image) => ({ complete: image.complete, width: image.naturalWidth, visible: Number(getComputedStyle(image).opacity) })
  ).catch(() => null);
  check(
    'Soundboard card displays the supplied cover artwork',
    (await soundboard.count()) === 1 && soundboardState?.complete && soundboardState.width > 0 && soundboardState.visible === 1,
    JSON.stringify(soundboardState)
  );

  // ── Collapsible category sections ──────────────────────────────────────
  await page.getByRole('button', { name: /^games$/i }).click();
  await page.waitForTimeout(400);
  const letterA = page.getByRole('button', { name: 'A', exact: true }).first();
  const heading = page.locator('#letter-heading-A button');
  await heading.click();
  await page.waitForTimeout(350);
  const collapsed = await heading.getAttribute('aria-expanded');
  const panelGone = await page.locator('#letter-panel-A').count();
  await heading.click();
  await page.waitForTimeout(350);
  const expanded = await heading.getAttribute('aria-expanded');
  check('alphabetical sections collapse and expand smoothly', collapsed === 'false' && panelGone === 0 && expanded === 'true');

  check('no uncaught page errors during the run', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
} catch (error) {
  check('run completed without an exception', false, String(error).slice(0, 500));
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('Failures:');
  for (const failure of failed) console.log(`- ${failure.name}: ${failure.detail}`);
  process.exitCode = 1;
}
