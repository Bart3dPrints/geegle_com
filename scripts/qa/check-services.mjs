// Verifies the external service launches with ordinary supported interfaces:
// Everythingle (internal app, direct or Cherry), YouTube (official
// privacy-enhanced embed) and Krillion official + fan-made backup.
//
// Run: node scripts/qa/check-services.mjs  (needs the preview server)

import { chromium } from 'playwright';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4173';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

async function openLibrary() {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('.gl-field input', 'pirate');
  await page.press('.gl-field input', 'Enter');
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) await notice.getByRole('button', { name: 'Got it' }).click();
  await page.waitForSelector('[data-card]');
}

async function launchApp(title) {
  await page.getByRole('button', { name: 'apps', exact: true }).click();
  await page.waitForTimeout(400);
  const card = page.locator('[data-card]').filter({ hasText: new RegExp(`^${title}$`) }).first();
  await card.locator('button').first().click();
  // A guest's first app launch shows the account reminder once per session.
  const guestReminder = page.getByRole('button', { name: 'Continue as guest' });
  if (await guestReminder.count()) {
    await guestReminder.click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1800);
}

try {
  await openLibrary();

  // YouTube: official privacy-enhanced embed.
  await launchApp('YouTube');
  check('YouTube offers its URL input', (await page.getByLabel('YouTube video URL').count()) === 1);
  await page.getByLabel('YouTube video URL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(2000);
  const youtubeFrame = page.locator('iframe');
  check('YouTube opens the official embed', (await youtubeFrame.count()) > 0);
  const youtubeSrc = await youtubeFrame.first().getAttribute('src');
  check('YouTube uses youtube-nocookie.com', Boolean(youtubeSrc && youtubeSrc.includes('youtube-nocookie.com')), youtubeSrc ?? '');
  await page.getByRole('button', { name: /back/i }).first().click();
  await page.waitForTimeout(800);

  // Krillion official (Games) and the fan-made backup (Apps) are distinct cards.
  // Counted on the unfiltered Games grid: the shared search index deliberately
  // also returns Apps, so a search would list the official app a second time.
  await page.getByRole('button', { name: 'games', exact: true }).click();
  await page.waitForTimeout(500);
  const gameTitles = await page
    .locator('[data-card]')
    .evaluateAll((nodes) => nodes.map((node) => node.innerText.replace(/\s+/g, ' ').trim()));
  const krillionCount = gameTitles.filter((title) => title === 'Krillion').length;
  const backupCount = gameTitles.filter((title) => title === 'Krillion (Backup)').length;
  check('Krillion official card exists once in Games', krillionCount === 1, `${krillionCount} cards`);
  check('Krillion backup card exists once in Games', backupCount === 1, `${backupCount} cards`);
  await page.getByRole('button', { name: 'apps', exact: true }).click();
  await page.waitForTimeout(500);
  check('Krillion backup card exists in Apps', (await page.locator('[data-card]').filter({ hasText: 'Krillion (Backup)' }).count()) === 1);

  check('no page errors on service surfaces', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  results.push({ name: 'service journey threw', ok: false, detail: error instanceof Error ? error.message : String(error) });
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} service checks passed`);
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
if (failed.length) process.exitCode = 1;
