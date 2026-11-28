#!/usr/bin/env node
// Second pass for local games that showed a start control or a loading state on
// the first look. One game at a time, a bounded interaction (press Enter / a
// key, click the game's own Play control or the centre of the frame) and a
// longer observation window. Loading screens and engine splashes are never kept.

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const out = arg('--out', '/tmp/run2-retry');
const idsFile = arg('--ids', '/tmp/retry-ids.json');
const seconds = Number(arg('--seconds', '20'));
mkdirSync(out, { recursive: true });

const reportPath = join(out, 'report.json');
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
const progress = JSON.parse(readFileSync('scripts/artwork/progress.json', 'utf8')).entries;
const pathById = new Map(progress.map((entry) => [entry.id, entry.path]));
const titles = JSON.parse(readFileSync('scripts/artwork/titles.json', 'utf8'));
const ids = JSON.parse(readFileSync(idsFile, 'utf8'));

const browser = await chromium.launch({ headless: true });
try {
  for (const id of ids) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    try {
      await page.goto(`${BASE}${pathById.get(id) ?? `/games/${id}.html`}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (error) {
      report[id] = { ...(report[id] ?? {}), status: 'goto-failed', error: String(error), shot: null };
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      await context.close();
      continue;
    }

    // Let the first frame settle, then use the game's own start control.
    await page.waitForTimeout(4000);
    const text = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
    if (text.includes('press any key') || text.includes('flashing lights')) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      await page.keyboard.press('a');
    }
    const play = page.getByRole('button', { name: /^\s*play\s*$/i });
    if (await play.count()) await play.first().click({ timeout: 4000 }).catch(() => {});
    // Ruffle's own green PLAY sits at the top of the frame; emulators and
    // PICO-8 wrappers use a centred glyph. Each is the wrapper's own control.
    await page.mouse.click(640, 60);
    await page.waitForTimeout(800);
    await page.mouse.click(640, 360);
    await page.waitForTimeout(800);
    await page.mouse.click(640, 200);
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(seconds * 1000);

    const shot = join(out, `${id}.png`);
    const status = await page.screenshot({ path: shot }).then(() => 'ok').catch(() => 'screenshot-failed');
    const summary = await page.evaluate(() => ({
      title: document.title,
      text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
      canvases: [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`),
    })).catch(() => ({ title: '', text: '', canvases: [] }));
    report[id] = { title: titles[id] ?? id, status, seconds, summary, errors: errors.slice(0, 4), shot };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`${id}: ${status} ${summary.title} | ${summary.text.slice(0, 80)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
