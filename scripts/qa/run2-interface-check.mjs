#!/usr/bin/env node
// Browser acceptance for Run 2: Everythingle, Krillion, YouTube, player
// controls, the navigation shortcut, homepage and announcement.
//
// Usage: node scripts/qa/run2-interface-check.mjs
// Requires the local dev server on 127.0.0.1:5173 (or GEEGLE_BASE).

import { chromium } from '@playwright/test';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function openLibrary(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    history.replaceState({ geegleView: 'library' }, '', location.pathname);
    location.reload();
  });
  await page.waitForSelector('header');
  await page.waitForTimeout(600);
  const got = page.getByRole('button', { name: 'Got it', exact: true });
  if (await got.count()) await got.first().click();
  await page.waitForTimeout(200);
}

async function continueAsGuest(page) {
  const guest = page.getByRole('button', { name: 'Continue as guest', exact: true });
  await guest.waitFor({ timeout: 2000 }).catch(() => null);
  if (await guest.count()) {
    await guest.click();
    await page.waitForTimeout(300);
  }
}

async function openTab(page, name) {
  await continueAsGuest(page);
  const notice = page.getByRole('button', { name: 'Got it', exact: true });
  if (await notice.count()) {
    await notice.first().click();
    await page.waitForTimeout(200);
  }
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(200);
}

async function openSettings(page, tab) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.waitFor();
  if (tab) await dialog.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(200);
  return dialog;
}

async function closeSettings(page) {
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => {
  const stack = error.stack ?? String(error);
  // Embeds run their own applications; only errors from Geegle itself count
  // as regressions in this run.
  if (!/127\.0\.0\.1:5173|localhost:5173|\/src\//.test(stack)) return;
  pageErrors.push(stack);
});

try {
  // ── Public homepage ──────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Customize appearance/ }).click();
  const editor = page.getByRole('dialog', { name: 'Appearance' });
  await editor.waitFor();
  const themeLabels = await editor.locator('.gl-segments button').allInnerTexts();
  check('homepage theme selector offers only System, Dark and Light', themeLabels.length === 3, themeLabels.join('/'));
  check('homepage shows no footer credit', (await page.getByText('Bart made this. Thank him').count()) === 0);
  check(
    'homepage shows no development announcement',
    (await page.getByText('Geegle is under active development').count()) === 0
  );
  await page.getByRole('button', { name: 'Close appearance' }).click();

  // ── Library: announcement, footer, rail ─────────────────────────────────
  await openLibrary(page);
  await page.getByRole('button', { name: 'Dismiss announcement' }).waitFor({ timeout: 10000 }).catch(() => null);
  const announcement = await page.evaluate(() => {
    const section = document.querySelector('section[aria-label="Development announcement"]');
    if (!section) return null;
    return {
      text: section.innerText,
      actions: [...section.querySelectorAll('a,button')]
        .filter((el) => !el.getAttribute('aria-label')?.startsWith('Dismiss'))
        .map((el) => ({ text: el.textContent?.trim(), href: el.getAttribute('href') })),
    };
  });
  check(
    'the development announcement uses the exact text',
    Boolean(announcement) &&
      announcement.text.includes('Geegle is under active development') &&
      announcement.text.includes('Found a bug, have a suggestion, or want a new feature added? Let me know!') &&
      announcement.text.includes('I review feedback every 1–2 weeks and implement suggestions whenever possible.'),
    announcement ? announcement.text.replace(/\n+/g, ' | ') : 'missing'
  );
  check(
    'the announcement has exactly one Give feedback action to the existing form',
    announcement?.actions.length === 1 &&
      announcement.actions[0].text === 'Give feedback' &&
      announcement.actions[0].href?.includes('docs.google.com/forms/'),
    JSON.stringify(announcement?.actions)
  );
  check(
    'library footer keeps the credit',
    (await page.getByText('Bart made this. Thank him').count()) >= 1
  );

  await page.getByRole('button', { name: 'Dismiss announcement' }).click();
  await page.waitForTimeout(400);
  check(
    'the announcement can be dismissed',
    (await page.locator('section[aria-label="Development announcement"]').count()) === 0
  );

  for (const size of [
    { width: 1024, height: 600 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    const rail = await page.evaluate(() => {
      const nav = [...document.querySelectorAll('nav[aria-label="Alphabetical navigation"]')]
        .find((el) => el.getBoundingClientRect().width > 0);
      if (!nav) return null;
      const buttons = [...nav.querySelectorAll('button')].filter((el) => el.getBoundingClientRect().height > 0);
      const first = buttons[0]?.getBoundingClientRect();
      const last = buttons[buttons.length - 1]?.getBoundingClientRect();
      return {
        count: buttons.length,
        first: first ? first.top : null,
        last: last ? last.bottom : null,
        viewport: window.innerHeight,
        scroll: nav.scrollHeight - nav.clientHeight,
      };
    });
    check(
      `all 28 rail entries fit at ${size.width}×${size.height}`,
      rail && rail.count === 28 && rail.first >= 0 && rail.last <= rail.viewport && rail.scroll <= 1,
      JSON.stringify(rail)
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── Everythingle ────────────────────────────────────────────────────────
  await openTab(page, 'apps');
  const everythingleCard = page.getByRole('button', { name: 'Play Everythingle' });
  check('Everythingle appears once in Apps', (await everythingleCard.count()) === 1);
  await everythingleCard.click();
  await continueAsGuest(page);
  await page.getByRole('grid', { name: 'Guesses' }).waitFor();
  check(
    'Everythingle opens as a playable puzzle, not an external launcher',
    (await page.getByRole('grid', { name: 'Guesses' }).count()) === 1 &&
      (await page.locator('iframe').count()) === 0,
    `${await page.locator('iframe').count()} frames`
  );

  // Invalid word, short word, a real guess and keyboard hints.
  for (const letter of 'zzzzz') await page.keyboard.press(letter);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check(
    'unknown five-letter words are rejected',
    (await page.getByText('Not in the word list.').count()) === 1
  );
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Backspace');
  for (const letter of 'abc') await page.keyboard.press(letter);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check(
    'short guesses are rejected',
    (await page.getByText('Enter a 5-letter word.').count()) === 1
  );
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');

  const answer = await page.evaluate(() => {
    const raw = localStorage.getItem('geegle-everythingle:guest');
    return raw ? JSON.parse(raw).state.answer : null;
  });
  const firstGuess = 'about';
  for (const letter of firstGuess) await page.keyboard.press(letter);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const states = await page.locator('[role="gridcell"]').evaluateAll((cells) =>
    cells.slice(0, 5).map((cell) => cell.getAttribute('data-state'))
  );
  check(
    'a valid guess is scored into coloured tiles',
    states.length === 5 && states.every((value) => ['correct', 'present', 'absent'].includes(value)),
    states.join(',')
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await openTab(page, 'apps');
  await page.getByRole('button', { name: 'Play Everythingle' }).click();
  await continueAsGuest(page);
  await page.getByRole('grid', { name: 'Guesses' }).waitFor();
  const persisted = await page.locator('[role="gridcell"]').first().innerText();
  check('puzzle progress survives a reload', persisted.trim().toLowerCase() === firstGuess[0], persisted);

  // Solve the current round from its own saved answer.
  for (const letter of answer) await page.keyboard.press(letter);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check(
    'solving a round is recognised and advances progression',
    (await page.getByText('Solved').count()) === 1 &&
      (await page.getByRole('button', { name: 'Next puzzle' }).count()) === 1
  );
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await page.waitForTimeout(300);
  const empty = await page.locator('[role="gridcell"]').first().getAttribute('data-state');
  check('Next puzzle starts a fresh round', empty === 'empty', String(empty));

  await page.getByRole('button', { name: 'Back to Apps' }).click();
  await page.waitForTimeout(300);

  // ── Krillion ────────────────────────────────────────────────────────────
  check(
    'Krillion and Krillion (Backup) both appear in Apps',
    (await page.getByRole('button', { name: 'Play Krillion', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Play Krillion (Backup)' }).count()) === 1
  );
  await page.getByRole('button', { name: 'Play Krillion', exact: true }).click();
  await continueAsGuest(page);
  await page.locator('iframe[title="Krillion"]').waitFor({ timeout: 20000 });
  const krillion = await page.evaluate(() => {
    const frame = document.querySelector('iframe[title="Krillion"]');
    const box = frame?.getBoundingClientRect();
    return {
      src: frame?.getAttribute('src'),
      top: box?.top,
      height: box?.height,
      width: box?.width,
      viewport: window.innerHeight,
    };
  });
  check(
    'the Krillion player fills the viewport without pushing content down',
    krillion.top >= 0 &&
      krillion.top < 2 &&
      Math.abs(krillion.height - krillion.viewport) < 3 &&
      krillion.src === '/games/krillion.html',
    JSON.stringify(krillion)
  );
  check(
    'player offers only Back and Fullscreen, no external launch control',
    (await page.getByRole('button', { name: 'Back to library' }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Fullscreen' }).count()) === 1 &&
      (await page.getByRole('button', { name: /Open in a new window|Open original/i }).count()) === 0
  );
  // The supported wrapper centres the official embed in the whole player.
  await page.goto(`${BASE}/games/krillion.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const wrapperFrame = await page.evaluate(() => {
    const frame = document.getElementById('krillion-frame');
    const box = frame?.getBoundingClientRect();
    return { src: frame?.getAttribute('src'), top: box?.top, height: box?.height, viewport: window.innerHeight };
  });
  check(
    'the Krillion wrapper centres the official embed in the full player area',
    wrapperFrame.src?.startsWith('https://krillion.cc/embed/') &&
      Math.abs(wrapperFrame.top ?? -1) < 2 &&
      Math.abs((wrapperFrame.height ?? 0) - wrapperFrame.viewport) < 3,
    JSON.stringify(wrapperFrame)
  );
  await openLibrary(page);
  await openTab(page, 'apps');

  await openTab(page, 'games');
  const krillionGames = page.getByRole('button', { name: 'Play Krillion', exact: true });
  check(
    'Krillion also appears in Games with the same entry',
    (await krillionGames.count()) === 1
  );
  await openTab(page, 'apps');

  // ── YouTube ─────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Play YouTube' }).click();
  await continueAsGuest(page);
  await page.getByLabel('YouTube video URL').waitFor();
  check(
    'YouTube exposes Back and Fullscreen only as player chrome',
    (await page.getByRole('button', { name: 'Back to Apps' }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Fullscreen' }).count()) === 1
  );
  await page.getByLabel('YouTube video URL').fill('not a video');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  check('invalid YouTube input is rejected', (await page.getByRole('alert').count()) >= 1);
  await page.getByLabel('YouTube video URL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.locator('iframe[title="YouTube video player"]').waitFor({ timeout: 15000 });
  const embed = await page.locator('iframe[title="YouTube video player"]').getAttribute('src');
  check('a valid YouTube link plays in the official embed', embed?.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), embed);
  check(
    'no ordinary Open on YouTube control is offered',
    (await page.getByRole('link', { name: 'Open on YouTube' }).count()) === 0
  );
  await page.getByRole('button', { name: 'Back to Apps' }).click();
  await page.waitForTimeout(300);

  // ── Shortcut configuration and navigation ──────────────────────────────
  let dialog = await openSettings(page, 'Preferences');
  const keyInput = dialog.getByLabel('Shortcut key');
  const destination = dialog.getByLabel('Destination');
  check(
    'Preferences exposes the default backslash shortcut and destination',
    (await keyInput.inputValue()) === '\\' &&
      (await destination.inputValue()) === 'https://manhasset.instructure.com/'
  );
  await destination.fill('https://example.com/shortcut-test');
  await destination.press('Enter');
  await page.waitForTimeout(400);
  await closeSettings(page);
  await page.keyboard.press('\\');
  await page.waitForURL(/example\.com\/shortcut-test/, { timeout: 15000 }).catch(() => null);
  check('pressing the configured key navigates to the destination', page.url().includes('example.com/shortcut-test'), page.url());

  await openLibrary(page);
  dialog = await openSettings(page, 'Preferences');
  await dialog.getByLabel('Enable shortcut').uncheck();
  await page.waitForTimeout(300);
  await closeSettings(page);
  const before = page.url();
  await page.keyboard.press('\\');
  await page.waitForTimeout(500);
  check('disabling the shortcut stops navigation', page.url() === before, page.url());

  dialog = await openSettings(page, 'Preferences');
  await dialog.getByLabel('Enable shortcut').check();
  await page.waitForTimeout(300);
  await closeSettings(page);
  await page.getByLabel('Search games, apps and proxies').fill('');
  await page.getByLabel('Search games, apps and proxies').focus();
  await page.keyboard.type('\\');
  await page.waitForTimeout(400);
  const searchValue = await page.getByLabel('Search games, apps and proxies').inputValue();
  check(
    'the shortcut never fires while typing in the search box',
    searchValue.includes('\\') && !page.url().includes('example.com'),
    searchValue
  );
  await page.getByLabel('Search games, apps and proxies').fill('');

  dialog = await openSettings(page, 'Preferences');
  await dialog.getByRole('button', { name: 'Restore defaults' }).click();
  await page.waitForTimeout(300);
  check(
    'restore defaults returns the key and destination',
    (await dialog.getByLabel('Shortcut key').inputValue()) === '\\' &&
      (await dialog.getByLabel('Destination').inputValue()) === 'https://manhasset.instructure.com/'
  );
  await closeSettings(page);

  // ── Changelog and external-service audit ───────────────────────────────
  dialog = await openSettings(page, 'Changelog');
  const firstEntry = await dialog.locator('ol li').first().innerText();
  check('the changelog lists PR 15 with its curated summary', /navigation shortcut/i.test(firstEntry), firstEntry);
  const newestFirst = await dialog.locator('ol li time').evaluateAll((items) => items.map((i) => i.getAttribute('datetime')));
  await dialog.getByLabel('Sort releases').selectOption('oldest');
  await page.waitForTimeout(200);
  const oldestFirst = await dialog.locator('ol li time').evaluateAll((items) => items.map((i) => i.getAttribute('datetime')));
  check(
    'both changelog sort directions work',
    newestFirst[0] === oldestFirst[oldestFirst.length - 1] && newestFirst.length === oldestFirst.length
  );
  await closeSettings(page);

  await openTab(page, 'proxies');
  const xylora = page.getByRole('heading', { name: 'Xylora', exact: true }).locator('xpath=../..');
  const xyloraDebug = {
    cards: await xylora.count(),
    images: await xylora.locator('img').count(),
    disabled: await xylora.getByRole('button', { name: 'Open' }).isDisabled().catch(() => 'missing'),
    reason: await xylora.getByText(/no longer resolves/).count(),
  };
  check(
    'Xylora keeps its card and artwork but its dead endpoint is disabled',
    xyloraDebug.cards === 1 && xyloraDebug.images === 1 && xyloraDebug.disabled === true && xyloraDebug.reason === 1,
    JSON.stringify(xyloraDebug)
  );

  // ── Branding assets ─────────────────────────────────────────────────────
  const favicon = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="icon"]');
    const response = await fetch(link?.getAttribute('href') ?? '/favicon.svg');
    const text = await response.text();
    return { ok: response.ok, hasGoogleColours: /4285f4|34a853|fbbc05|ea4335/i.test(text), text };
  });
  check('an independent Geegle favicon is served', favicon.ok && !favicon.hasGoogleColours);
  const touchIcon = await page.evaluate(async () => (await fetch('/apple-touch-icon.png')).status);
  check('a mobile touch icon is served', touchIcon === 200, String(touchIcon));

  check('no uncaught page errors during the run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('Failed:', failed.map((f) => f.name).join('; '));
  process.exitCode = 1;
}
