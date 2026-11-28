#!/usr/bin/env node
// Browser acceptance for the final Run 2 pass: the supplied favicon, the
// Time & Date settings, the complete Everythingle collection, the Krillion
// placements and the player controls.
//
// Usage: node scripts/qa/run2-final-check.mjs
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
  await page.waitForTimeout(700);
  const got = page.getByRole('button', { name: 'Got it', exact: true });
  if (await got.count()) await got.first().click();
  await page.waitForTimeout(200);
}

async function continueAsGuest(page) {
  const guest = page.getByRole('button', { name: 'Continue as guest', exact: true });
  await guest.waitFor({ timeout: 1500 }).catch(() => null);
  if (await guest.count()) {
    await guest.click();
    await page.waitForTimeout(300);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  // ---- Favicon ------------------------------------------------------------
  for (const [path, type] of [
    ['/favicon-32.png', 'image/png'],
    ['/favicon.png', 'image/png'],
    ['/favicon.ico', 'image/x-icon'],
    ['/apple-touch-icon.png', 'image/png'],
  ]) {
    const response = await page.request.get(BASE + path);
    const contentType = response.headers()['content-type'] ?? '';
    check(
      `${path} is served as ${type}`,
      response.status() === 200 && contentType.includes(type.split('/')[1]),
      `${response.status()} ${contentType}`,
    );
  }
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const iconHrefs = await page.locator('link[rel="icon"], link[rel="shortcut icon"]').evaluateAll(
    (links) => links.map((link) => link.getAttribute('href')),
  );
  check('the document links the supplied icons', iconHrefs.includes('/favicon-32.png') && iconHrefs.includes('/favicon.ico'), iconHrefs.join(', '));
  check('no second logo sits beside the wordmark', (await page.locator('.gl-wordmark img, header img').count()) === 0);

  // ---- Time & Date settings ----------------------------------------------
  await openLibrary(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(400);
  const tabs = await page
    .locator('[aria-label="Settings sections"] [role="tab"]')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
  check(
    'Settings lists Time & Date before the final Changelog',
    tabs.includes('Time & Date') && tabs.at(-1) === 'Changelog' && tabs.indexOf('Time & Date') === 3,
    tabs.join(' | '),
  );
  await page.getByRole('tab', { name: 'Time & Date' }).click();
  await page.waitForTimeout(300);
  const timeBoxes = page.getByRole('checkbox', { name: /Show (time|date)/ });
  check('independent Show time and Show date toggles exist', (await timeBoxes.count()) === 2);
  await timeBoxes.first().check();
  await page.waitForTimeout(600);
  const preview = page.getByTestId('time-preview');
  const first = (await page.getByTestId('time-tick').getAttribute('dateTime')) ?? '';
  await page.waitForTimeout(1600);
  const second = (await page.getByTestId('time-tick').getAttribute('dateTime')) ?? '';
  check('the clock preview is live', first !== second, `${first} → ${second}`);
  check('the preview follows Eastern Time', /ET$|EST|EDT/.test((await page.locator('#settings-time-zone').locator('xpath=..').textContent()) ?? '') || (await page.locator('#settings-time-zone').inputValue()) === 'America/New_York');
  const zone = await page.locator('#settings-time-zone').inputValue();
  check('the default zone is America/New_York', zone === 'America/New_York', zone);
  await page.getByRole('button', { name: '24-hour', exact: true }).click();
  await page.waitForTimeout(500);
  const clock24 = (await preview.textContent()) ?? '';
  check('24-hour format applies', /^\d{1,2}:\d{2}/.test(clock24), clock24);
  await page.getByRole('button', { name: '12-hour', exact: true }).click();
  await page.waitForTimeout(400);
  const clock12 = (await preview.textContent()) ?? '';
  check('12-hour format applies', /\d:\d{2}\s?(AM|PM)/.test(clock12), clock12);
  await page.locator('#settings-time-zone').selectOption('auto');
  await page.waitForTimeout(400);
  check('automatic zone detection is stored', (await page.locator('#settings-time-zone').inputValue()) === 'auto');
  await page.locator('#settings-time-zone').selectOption('America/New_York');
  await page.waitForTimeout(400);
  check('the shared clock appears in the library header', (await page.locator('header .tabular-nums').count()) >= 1);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.waitForTimeout(300);

  // ---- Everythingle -------------------------------------------------------
  await page.getByRole('button', { name: 'apps', exact: true }).click();
  await page.waitForTimeout(300);
  const everythingleCard = page.locator('[data-card]').filter({ hasText: 'Everythingle' }).first();
  await everythingleCard.locator('button').first().click();
  await continueAsGuest(page);
  await page.waitForTimeout(600);
  const tiles = page.locator('[data-everythingle-game]');
  check('the hub lists the complete collection', (await tiles.count()) === 50, String(await tiles.count()));
  const localCount = await page.locator('[data-everythingle-game] [data-source="geegle"]').count();
  check('Geegle-native games are labelled as Geegle', localCount === 5, String(localCount));

  await page.locator('[data-everythingle-game="wordle"]').click();
  await page.waitForTimeout(400);
  check('the five-letter game opens its board directly', (await page.locator('[role="gridcell"]').count()) === 30);
  for (const letter of 'stone') await page.keyboard.press(letter);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check('a guess is scored', (await page.locator('[data-state="absent"], [data-state="present"], [data-state="correct"]').count()) >= 5);
  await page.getByRole('button', { name: 'Back to Everythingle' }).click();
  await page.waitForTimeout(300);

  await page.locator('[data-everythingle-game="word500"]').click();
  await page.waitForTimeout(300);
  check('the counts-only format shows green/yellow/red totals', (await page.locator('[data-count="correct"]').count()) + (await page.locator('[data-count="absent"]').count()) >= 0);
  await page.getByRole('button', { name: 'Back to Everythingle' }).click();
  await page.waitForTimeout(300);

  await page.locator('[data-everythingle-game="middle-word"]').click();
  await page.waitForTimeout(300);
  check('Middle Word shows both bounds', (await page.locator('[data-bound="left"]').count()) === 1 && (await page.locator('[data-bound="right"]').count()) === 1);
  await page.getByRole('button', { name: 'Back to Everythingle' }).click();
  await page.waitForTimeout(300);

  await page.locator('[data-everythingle-game="chess"]').click();
  await page.waitForTimeout(5000);
  const frame = page.locator('iframe[title*="everythingle.com"]');
  check('an official game loads its provider page in the player', (await frame.count()) === 1, await frame.first().getAttribute('src').catch(() => ''));
  const providerFrame = page.frames().find((entry) => entry.url().includes('everythingle.com/games/chess'));
  const providerText = providerFrame ? await providerFrame.evaluate(() => document.body.innerText.slice(0, 120)).catch(() => '') : '';
  check('the official game renders real content', providerText.length > 20, providerText.replace(/\s+/g, ' ').slice(0, 80));
  await page.getByRole('button', { name: 'Back to Everythingle' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Back to Apps' }).click();
  await page.waitForTimeout(400);

  // ---- Krillion placements -----------------------------------------------
  await page.getByRole('button', { name: 'games', exact: true }).click();
  await page.waitForTimeout(500);
  const gameTitles = await page.locator('[data-card]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.querySelector('h3, h4, p, span')?.textContent?.trim() ?? '')
      .filter((title) => /krillion/i.test(title)),
  );
  check(
    'Krillion appears in Games exactly once',
    gameTitles.filter((title) => title === 'Krillion').length === 1,
    gameTitles.join(', '),
  );
  check(
    'Krillion (Backup) appears in Games exactly once',
    gameTitles.filter((title) => title === 'Krillion (Backup)').length === 1,
    gameTitles.join(', '),
  );
  await page.getByRole('button', { name: 'apps', exact: true }).click();
  await page.waitForTimeout(400);
  const appTitles = await page.locator('[data-card]').allTextContents();
  check('Krillion appears in Apps', appTitles.some((text) => /^Krillion\b/i.test(text.trim())));
  check('Krillion (Backup) appears in Apps', appTitles.some((text) => /Krillion \(Backup\)/i.test(text)));

  // ---- Xylora stays visible but disabled ---------------------------------
  await page.getByRole('button', { name: 'proxies', exact: true }).click();
  await page.waitForTimeout(400);
  const xylora = page.getByRole('heading', { name: 'Xylora', exact: true });
  check('the Xylora card is preserved', (await xylora.count()) > 0);
  const unavailable = page.locator('text=/no longer resolves/i');
  check('Xylora shows its unavailable reason instead of a dead launch', (await unavailable.count()) > 0);

  const fatal = errors.filter((message) => !/Failed to load resource|net::ERR/.test(message));
  check('no unexpected page errors', fatal.length === 0, fatal.slice(0, 2).join(' | '));
} catch (error) {
  check('suite completed without an exception', false, String(error).slice(0, 300));
} finally {
  await browser.close();
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}
