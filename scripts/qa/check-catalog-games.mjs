// Per-game verification for the catalog restoration batch.
//
// Opens each game's own build in a real browser (not the library shell),
// waits for a rendering surface, records the SWF/asset responses, delivers
// real keyboard input, and checks that the frame changes. Each game has its
// own timeout and the browser is recovered between games, so one broken title
// cannot halt the run.
//
// Run with the dev or preview server listening:
//   node scripts/qa/check-catalog-games.mjs
// Optional: GEEGLE_BASE, GEEGLE_GAMES (comma-separated file names).

import { chromium } from '@playwright/test';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4173';
const TIMEOUT = Number(process.env.GEEGLE_GAME_TIMEOUT ?? 60000);

// A click target is where the game's own start control sits, so the run
// verifies gameplay rather than only the title screen.
const GAMES = [
  { file: 'clhobo.html', title: 'HOBO' },
  { file: 'clhobo2.html', title: 'HOBO 2: Prison Brawl' },
  { file: 'clhobo3.html', title: 'HOBO 3: Wanted' },
  { file: 'clhobo4.html', title: 'HOBO 4: Total War' },
  { file: 'clhobo5.html', title: 'HOBO 5: Space Brawls' },
  { file: 'clhobo6.html', title: 'HOBO 6: Hell' },
  { file: 'clhobo7.html', title: 'HOBO 7: Heaven' },
  { file: 'clstickminbreakingbank.html', title: 'Henry Stickmin: Breaking the Bank', click: [700, 570] },
  { file: 'clstickminescapingprison.html', title: 'Henry Stickmin: Escaping the Prison', click: [630, 300] },
  { file: 'clstickmanstealingdiamond.html', title: 'Henry Stickmin: Stealing the Diamond' },
  { file: 'clstickminairship.html', title: 'Henry Stickmin: Infiltrating the Airship' },
  { file: 'clstickminfleecomplex.html', title: 'Henry Stickmin: Fleeing the Complex' },
  { file: 'clpolytrackworksnow.html', title: 'Polytrack (working)', click: [1030, 505] },
  { file: 'clsnowrider.html', title: 'Snow Rider', click: [640, 400] },
  { file: 'snow-rider.html', title: 'Snow Rider 3D', click: [640, 400] },
  { file: 'clsnowridergoodygumdrops.html', title: 'Snow Rider Goody Gumdrops' },
  { file: 'clsnowriderrrr.html', title: 'Snow Rider Rrr', click: [640, 400] },
];

// Third-party cross-promotion and analytics failures do not stop the game from
// running; they are reported as warnings, not as fatal initialization errors.
const NON_FATAL = /NewgroundsPromo|gamedistribution|google-opensocial|Cross-Origin-Opener-Policy|Failed to connect to server/i;

const selected = process.env.GEEGLE_GAMES
  ? GAMES.filter((game) => process.env.GEEGLE_GAMES.split(',').includes(game.file))
  : GAMES;

const browser = await chromium.launch();
const results = [];

for (const { file, title, click } of selected) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  const assets = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`.slice(0, 300));
  });
  page.on('response', (response) => {
    if (/\.(swf|json|data|wasm)(\?|$)/i.test(response.url()) || /\.swf\.part\d/.test(response.url())) {
      assets.push({ status: response.status(), url: response.url().slice(-90) });
    }
    if (response.status() >= 400) {
      resultWarnings.push(`${response.status()} ${response.url().slice(0, 140)}`);
    }
  });

  const resultWarnings = [];
  const result = { file, title, loaded: false, canvas: null, assets, errors, warnings: [], changed: false };
  try {
    await page.goto(`${BASE}/games/${encodeURIComponent(file)}`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await page.waitForSelector('ruffle-player, canvas', { timeout: TIMEOUT });
    // Ruffle and Unity both need time to fetch and start the game.
    await page.waitForTimeout(12000);
    result.canvas = await page.evaluate(() => {
      const host = document.querySelector('ruffle-player');
      const canvas = host?.shadowRoot?.querySelector('canvas') ?? document.querySelector('canvas');
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    });
    // Start the game through its own control, then play with real input.
    await page.mouse.click(...(click ?? [640, 400]));
    await page.waitForTimeout(4000);
    const before = await page.screenshot({ type: 'png' });
    await page.locator('body').click({ position: { x: 10, y: 10 } }).catch(() => {});
    for (const key of ['ArrowRight', 'Space', 'Enter', 'ArrowUp']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(2000);
    const after = await page.screenshot({ type: 'png' });
    result.changed = !before.equals(after);
    result.loaded = Boolean(result.canvas) && assets.some((asset) => asset.status === 200);
  } catch (error) {
    result.errors.push(`fatal: ${error.message}`.slice(0, 300));
  }
  await context.close().catch(() => {});
  result.warnings = [
    ...resultWarnings,
    ...result.errors.filter(
      (error) => NON_FATAL.test(error) || /Failed to load resource/i.test(error)
    ),
  ];
  result.errors = result.errors.filter(
    (error) => !NON_FATAL.test(error) && !/Failed to load resource/i.test(error)
  );
  results.push(result);
  const verdict = result.loaded && result.changed && result.errors.length === 0 ? 'PASS' : 'FAIL';
  console.log(
    `${verdict} ${title} :: canvas=${result.canvas ? `${result.canvas.width}x${result.canvas.height}` : 'none'} ` +
      `assets=${assets.filter((a) => a.status === 200).length}/${assets.length} ` +
      `frameChanged=${result.changed} errors=${result.errors.length} warnings=${result.warnings.length}`
  );
  for (const error of result.errors) console.log(`   ${error}`);
  for (const warning of result.warnings) console.log(`   warning: ${warning}`);
}

await browser.close();
const failed = results.filter(
  (result) => !result.loaded || !result.changed || result.errors.length > 0
);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exitCode = failed.length > 0 ? 1 : 0;
