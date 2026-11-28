#!/usr/bin/env node
// One-at-a-time local game investigation. Opens a single game in a clean
// browser context, watches it for the required window, records the frame and
// closes it before the next game starts. Never runs games concurrently.
//
// Usage:
//   node scripts/artwork/investigate-local-games.mjs --out /tmp/run2-local [--limit 16] [--skip 0]

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const out = arg('--out', '/tmp/run2-local');
const limit = Number(arg('--limit', '16'));
const skip = Number(arg('--skip', '0'));
const seconds = Number(arg('--seconds', '12'));
mkdirSync(out, { recursive: true });

const reportPath = join(out, 'report.json');
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
const queue = JSON.parse(readFileSync('scripts/artwork/no-artwork.json', 'utf8'));
const titles = JSON.parse(readFileSync('scripts/artwork/titles.json', 'utf8'));
const progress = JSON.parse(readFileSync('scripts/artwork/progress.json', 'utf8')).entries;
const pathById = new Map(progress.map((entry) => [entry.id, entry.path]));
const entries = Object.entries(queue).slice(skip, skip + limit);

const browser = await chromium.launch({ headless: true });
try {
  for (const [id, record] of entries) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    const failed = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('requestfailed', (request) => failed.push(`${request.url()} ${request.failure()?.errorText ?? ''}`));
    const started = Date.now();
    let status = 'ok';
    try {
      const launchPath = record.path ?? pathById.get(id) ?? `/games/${id}.html`;
      const response = await page.goto(`${BASE}${launchPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response || response.status() >= 400) status = `http-${response?.status() ?? 'none'}`;
    } catch (error) {
      status = `goto-failed: ${error instanceof Error ? error.message : error}`;
    }
    await page.waitForTimeout(seconds * 1000);
    const shot = join(out, `${id}.png`);
    await page.screenshot({ path: shot }).catch(() => { status = status === 'ok' ? 'screenshot-failed' : status; });
    const summary = await page.evaluate(() => {
      const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
      const canvases = [...document.querySelectorAll('canvas')].map((canvas) => ({
        width: canvas.width,
        height: canvas.height,
      }));
      return { title: document.title, text: text.slice(0, 200), canvases, iframes: document.querySelectorAll('iframe').length };
    }).catch(() => ({ title: '', text: '', canvases: [], iframes: 0 }));
    report[id] = {
      title: titles[id] ?? record.title,
      path: record.path ?? pathById.get(id) ?? `/games/${id}.html`,
      status,
      seconds: Math.round((Date.now() - started) / 1000),
      summary,
      errors: errors.slice(0, 5),
      failed: failed.slice(0, 5),
      shot,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`${id}: ${status} ${summary.title || ''} ${summary.canvases.length ? `${summary.canvases.length} canvas` : 'no canvas'} ${summary.text.slice(0, 60)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
