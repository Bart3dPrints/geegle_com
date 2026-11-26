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

  // Everythingle: internal app with its own server choice and exit.
  await launchApp('Everythingle');
  const everythingleFrame = page.locator('iframe[title*="Everythingle" i]');
  check('Everythingle opens its player', (await everythingleFrame.count()) > 0);
  const everythingleSrc = await everythingleFrame.first().getAttribute('src').catch(() => null);
  check('Everythingle loads the official destination or a verified server', Boolean(everythingleSrc && /everythingle\.com|chrivtx|s3\.amazonaws/.test(everythingleSrc)), everythingleSrc ?? '');
  check('Everythingle offers an exit control', (await page.getByRole('button', { name: /back/i }).count()) > 0);
  await page.getByRole('button', { name: /back/i }).first().click();
  await page.waitForTimeout(800);

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
  await page.getByRole('button', { name: 'games', exact: true }).click();
  const krillionSearch = page.getByRole('combobox', { name: 'Search games' });
  await krillionSearch.fill('krillion');
  await krillionSearch.press('Enter');
  await page.waitForTimeout(400);
  check('Krillion official card exists once in Games', (await page.locator('[data-card]').filter({ hasText: /^Krillion$/ }).count()) === 1);
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
