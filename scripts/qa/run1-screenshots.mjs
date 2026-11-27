#!/usr/bin/env node
// Captures the evidence screenshots for the navigation and settings review.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
const OUT = 'docs/qa';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  history.replaceState({ geegleView: 'library' }, '', location.pathname);
  location.reload();
});
await page.waitForSelector('header');
await page.waitForTimeout(900);
const got = page.getByRole('button', { name: 'Got it', exact: true });
if (await got.count()) await got.first().click();
await page.waitForTimeout(300);

for (const size of [
  { width: 1024, height: 600 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  await page.setViewportSize(size);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/run1-library-${size.width}x${size.height}.png` });
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Settings', exact: true }).click();
const dialog = page.getByRole('dialog', { name: 'Settings' });
await dialog.waitFor();
for (const tab of ['Theme', 'Appearance', 'Preferences', 'Changelog']) {
  await dialog.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/run1-settings-${tab.toLowerCase().replace(' ', '-')}.png` });
}
await page.setViewportSize({ width: 1024, height: 600 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/run1-settings-1024x600.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/run1-settings-mobile.png` });

await browser.close();
console.log('screenshots written to', OUT);
