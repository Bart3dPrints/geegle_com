// Run 4.1 visual evidence: the library and chat under several complete theme
// presets, at the six acceptance viewports. Writes JPEGs to docs/evidence/run41.
//
// Usage: `npm run dev -- --mode qa --port 5173`, then
// `bun scripts/qa/run41-capture.mjs`

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
const OUT = 'docs/evidence/run41';
mkdirSync(OUT, { recursive: true });

const password = 'Capture-check-1';
const tag = () => Math.random().toString(36).slice(2, 7);
const browser = await chromium.launch();

async function closeNotices(page) {
  // The library notice renders only after the catalog settles, so a fixed delay
  // races it. Wait for the overlay to appear or the bounded wait to expire, then
  // dismiss every notice modal until none is left.
  await page.locator('div.fixed.inset-0.z-50').first().waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  for (let i = 0; i < 3; i += 1) {
    const overlay = page.locator('div.fixed.inset-0.z-50').first();
    if (!(await overlay.count())) return;
    await overlay.locator('button').last().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
}

async function openPage(context, width, height) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/#games`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await closeNotices(page);
  return page;
}

async function register(page) {
  const username = `shot${tag()}`;
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByRole('button', { name: /Create one/i }).click();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForTimeout(1800);
  await closeNotices(page);
  return username;
}

async function pickTheme(page, id, mode) {
  // "Close settings" also matches a loose name lookup, so anchor on the header.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('[data-theme-preset]').first().waitFor({ state: 'visible' });
  const modeButton = page.getByRole('button', { name: mode }).first();
  if (await modeButton.count()) await modeButton.click().catch(() => {});
  await page.locator(`[data-theme-preset="${id}"]`).click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  const closeSettings = page.getByRole('button', { name: 'Close settings' });
  if (await closeSettings.isVisible().catch(() => false)) await closeSettings.click().catch(() => {});
  await page.waitForTimeout(350);
  await closeNotices(page);
}

const guestContext = await browser.newContext({ deviceScaleFactor: 1 });
const guest = await openPage(guestContext, 1440, 900);

await guest.getByRole('button', { name: 'Settings', exact: true }).click();
await guest.waitForTimeout(500);
await guest.locator('[data-theme-preset]').first().waitFor({ state: 'visible' });
await guest.screenshot({ path: `${OUT}/theme-presets-1440.jpg`, type: 'jpeg', quality: 78 });
await guest.keyboard.press('Escape');
await guest.waitForTimeout(300);

for (const [id, mode, name] of [
  ['blue', 'Light', 'library-blue-light'],
  ['purple', 'Light', 'library-purple-light'],
  ['green', 'Dark', 'library-green-dark'],
]) {
  await pickTheme(guest, id, mode);
  await guest.screenshot({ path: `${OUT}/${name}-1440.jpg`, type: 'jpeg', quality: 78 });
}

const signedIn = await register(guest);
await pickTheme(guest, 'blue', 'Light');
await guest.locator('nav[aria-label="Sections"] [data-tab="chat"]').click();
await guest.waitForTimeout(700);
await guest.locator('[data-conversation-kind="public"]').first().click();
await guest.waitForTimeout(700);
const field = guest.getByLabel('Message text');
for (const text of ['Evening all — anyone tried the new racing section?', 'The theme follows the whole app now, not just the buttons.', 'Short one.']) {
  await field.fill(text);
  await guest.getByLabel('Send message').click();
  await guest.waitForTimeout(500);
}
await guest.locator('[data-mine="true"] [data-bubble]').last().hover();
await guest.waitForTimeout(300);
await guest.screenshot({ path: `${OUT}/chat-bubbles-menu-1440.jpg`, type: 'jpeg', quality: 78 });

for (const [width, height] of [[1024, 600], [1280, 720], [1366, 768], [1920, 1080], [390, 844]]) {
  await guest.setViewportSize({ width, height });
  await guest.waitForTimeout(600);
  await guest.screenshot({ path: `${OUT}/chat-${width}x${height}.jpg`, type: 'jpeg', quality: 76 });
}

await guest.setViewportSize({ width: 1440, height: 900 });
await pickTheme(guest, 'rose', 'Light');
await guest.locator('nav[aria-label="Sections"] [data-tab="games"]').click();
await guest.waitForTimeout(700);
await guest.screenshot({ path: `${OUT}/library-rose-light-1440.jpg`, type: 'jpeg', quality: 78 });

console.log('captured', signedIn);
await browser.close();
