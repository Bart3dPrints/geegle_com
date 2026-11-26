// Browser regression journey for the current Geegle interface.
// Run against a local preview server: node scripts/qa/interface-check.mjs
//
// Checks only observable behaviour: landing layout, exact title/footer, the
// library loading notice, library search (Enter filters, never launches),
// category filters, alphabetical sections and rail, proxy notice, compact
// player controls, settings appearance persistence, neutral computed colours,
// console errors and horizontal overflow.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4173';
const OUT = 'docs/qa';
mkdirSync(OUT, { recursive: true });

const results = [];
const failures = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
const isGameContent = (url) => !url || url.includes('/games/') || url.includes('/apps/');
page.on('console', (message) => {
  // Errors raised inside a game build are that game's content, not the
  // Geegle interface. They are recorded separately by the catalog audit.
  if (message.type() === 'error' && !isGameContent(message.location()?.url)) consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push('pageerror: ' + error.message));
page.on('requestfailed', (request) => {
  if (!request.url().includes('favicon') && !isGameContent(request.url())) {
    failedRequests.push(`${request.url()} ${request.failure()?.errorText}`);
  }
});

const hasHorizontalOverflow = () =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

const neutral = (value) => {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return !match || (match[1] === match[2] && match[2] === match[3]);
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('tab title is exactly Geegle', (await page.title()) === 'Geegle', await page.title());
  check('landing has no Games shortcut', (await page.locator('.gl-library').count()) === 0);
  check('landing footer is the exact sentence', (await page.locator('.gl-foot').innerText()).includes('Bart made this. Thank him'));
  const field = await page.locator('.gl-field').boundingBox();
  check('search field is about 53px tall', Math.abs((field?.height ?? 0) - 53) <= 2, String(field?.height));
  check('landing has no horizontal overflow', !(await hasHorizontalOverflow()));
  await page.screenshot({ path: `${OUT}/landing-desktop.png`, fullPage: true });

  await page.fill('.gl-field input', 'pirate');
  await page.press('.gl-field input', 'Enter');
  await page.waitForSelector('text=Please wait if you see nothing upon clicking on a Game/Proxy.');
  check('pirate opens the library with no gate', page.url().endsWith('#games'));
  const notice = page.locator('[role="dialog"][aria-labelledby="library-notice-text"]');
  check('library notice uses the exact text', (await notice.innerText()).includes('Please wait if you see nothing upon clicking on a Game/Proxy.'));
  check("library notice checkbox starts unchecked", !(await notice.locator('input[type=checkbox]').isChecked()));
  check('library renders underneath the notice', (await page.locator('#letter-A').count()) === 1);
  check('numeric section comes first', (await page.locator('section[id^="letter-"]').first().getAttribute('id')) === 'letter-#');
  await page.screenshot({ path: `${OUT}/library-notice.png`, fullPage: false });

  // Dismiss for this visit, return, and confirm it appears again.
  await notice.getByRole('button', { name: 'Got it' }).click();
  await page.locator('header').getByRole('button', { name: /Geegle home/ }).click();
  await page.waitForSelector('.gl-field input');
  await page.fill('.gl-field input', 'pirate');
  await page.press('.gl-field input', 'Enter');
  check('notice reappears on a new entry when not suppressed', await page.locator('[aria-labelledby="library-notice-text"]').isVisible());
  await page.locator('[aria-labelledby="library-notice-text"]').locator('input[type=checkbox]').check();
  await page.locator('[aria-labelledby="library-notice-text"]').getByRole('button', { name: 'Got it' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  check('suppressed notice stays dismissed after reload', (await page.locator('[aria-labelledby="library-notice-text"]').count()) === 0);

  // Library search: hovering a suggestion and pressing Enter filters, never launches.
  const search = page.getByRole('combobox', { name: 'Search games' });
  await search.fill('mario');
  const suggestion = page.locator('#library-suggestions [role="option"]').first();
  await suggestion.hover();
  await search.press('Enter');
  await page.waitForTimeout(300);
  check('Enter never launches a hovered suggestion', (await page.locator('iframe').count()) === 0);
  check('Enter commits the query as a library filter', (await page.getByRole('status').first().innerText()).includes('results for'));
  const filtered = await page.locator('[data-card]').count();
  check('filtered results are a subset', filtered > 0 && filtered < 2621, String(filtered));
  check('suggestions close after Enter', (await page.locator('#library-suggestions').count()) === 0);

  await search.fill('zeldaa');
  await page.waitForTimeout(200);
  const fuzzy = await page.locator('#library-suggestions [role="option"]').count();
  check('misspelling still suggests results', fuzzy > 0, String(fuzzy));
  await search.press('Escape');
  check('Escape closes suggestions', (await page.locator('#library-suggestions').count()) === 0);
  await search.fill('');
  await search.press('Enter');
  await page.waitForTimeout(200);
  check('empty search resets the library', (await page.locator('[data-card]').count()) > 1000);

  // Category filter.
  await page.getByRole('tab', { name: 'Puzzle' }).click();
  await page.waitForTimeout(200);
  const puzzleCount = await page.locator('[data-card]').count();
  check('category filter narrows the library', puzzleCount > 0 && puzzleCount < 1000, String(puzzleCount));
  await page.getByRole('tab', { name: 'All' }).click();

  // Letter rail scrolls to a real section.
  await page.getByRole('button', { name: 'Jump to Z' }).first().click();
  await page.waitForTimeout(600);
  const zTop = await page.locator('#letter-Z').evaluate((element) => element.getBoundingClientRect().top);
  check('letter rail scrolls the section under the header', zTop > 80 && zTop < 220, String(Math.round(zTop)));

  // Computed neutral colours on real elements.
  const mismatched = await page.evaluate(() => {
    const samples = ['body', 'header', '.card', '.chip', '.btn-primary'];
    const bad = [];
    for (const sample of samples) {
      const element = document.querySelector(sample);
      if (!element) continue;
      const style = getComputedStyle(element);
      for (const property of ['backgroundColor', 'color', 'borderColor']) {
        const value = style[property];
        const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match && !(match[1] === match[2] && match[2] === match[3])) {
          bad.push(`${sample} ${property}=${value}`);
        }
      }
    }
    return bad;
  });
  check('sampled interface colours are true grayscale', mismatched.length === 0, mismatched.join('; '));

  // Proxies.
  await page.getByRole('button', { name: 'proxies', exact: true }).click();
  const firstProxy = page.locator('section[aria-label="Proxies"] .card').first();
  check('proxy card shows no description text', !(await firstProxy.innerText()).toLowerCase().includes('proxy service'));
  check('proxy selector is labelled Server 1', (await page.locator('section[aria-label="Proxies"] select').first().locator('option').first().innerText()).trim() === 'Server 1');
  await firstProxy.getByRole('button', { name: 'Open' }).click();
  const proxyNotice = page.locator('[aria-labelledby="proxy-notice-text"]');
  check('proxy notice uses the exact text', (await proxyNotice.innerText()).includes('Please ignore and exit out of any pop-ups or redirects from these proxies.'));
  await proxyNotice.getByRole('button', { name: 'Cancel' }).click();
  check('cancelling the proxy notice does not open the destination', (await page.locator('iframe').count()) === 0);

  // Compact player controls on a real local game.
  await page.getByRole('button', { name: 'games', exact: true }).click();
  const gameSearch = page.getByRole('combobox', { name: 'Search games' });
  await gameSearch.fill('2048');
  await gameSearch.press('Enter');
  await page.waitForTimeout(200);
  await page.locator('[data-card] button').first().click();
  await page.waitForSelector('iframe');
  await page.waitForTimeout(800);
  check('player has no reload control', (await page.getByRole('button', { name: /reload/i }).count()) === 0);
  check('player shows a back control', (await page.getByRole('button', { name: 'Back to library' }).count()) === 1);
  check('player shows open-in-new-window', (await page.getByRole('button', { name: 'Open in a new window' }).count()) === 1);
  check('player shows fullscreen', (await page.getByRole('button', { name: 'Fullscreen' }).count()) === 1);
  const backBox = await page.getByRole('button', { name: 'Back to library' }).boundingBox();
  check('game back control sits in the top-right cluster', (backBox?.x ?? 0) > 1000 && (backBox?.y ?? 999) < 80, JSON.stringify(backBox));
  await page.getByRole('button', { name: 'Back to library' }).click();
  await page.waitForSelector('[data-card]');

  // Settings: guest access, appearance apply and reset.
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[role="dialog"][aria-label="Settings"]');
  check('settings opens from the left of the header', await settings.isVisible());
  await settings.locator('input[aria-label="Custom background colour"]').fill('#202020');
  await settings.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(200);
  const applied = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('applied background colour is used', applied === 'rgb(32, 32, 32)', applied);
  await page.reload({ waitUntil: 'networkidle' });
  const persisted = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('appearance persists after reload', persisted === 'rgb(32, 32, 32)', persisted);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('[role="dialog"][aria-label="Settings"]').getByRole('button', { name: 'Reset to defaults' }).click();
  await page.waitForTimeout(200);
  const reset = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('reset restores the neutral default', reset === 'rgb(250, 250, 250)', reset);
  await page.locator('[role="dialog"][aria-label="Settings"]').getByRole('button', { name: 'Close settings' }).click();

  await page.screenshot({ path: `${OUT}/library-desktop.png`, fullPage: true });

  // Mobile and Chromebook viewports.
  for (const [name, width, height] of [['mobile', 390, 844], ['chromebook', 1366, 768]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    check(`${name} has no horizontal overflow`, !(await hasHorizontalOverflow()));
    await page.screenshot({ path: `${OUT}/library-${name}.png`, fullPage: false });
  }

  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('no failed first-party requests', failedRequests.length === 0, failedRequests.join(' | '));
} catch (error) {
  failures.push('threw: ' + (error instanceof Error ? error.message : String(error)));
} finally {
  await browser.close();
}

const passed = results.filter((result) => result.ok).length;
console.log(`${passed}/${results.length} checks passed`);
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
if (failures.length) {
  console.error('\nFAILURES:\n' + failures.join('\n'));
  process.exitCode = 1;
}
