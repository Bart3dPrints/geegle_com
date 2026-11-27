#!/usr/bin/env node
// Diagnostic probe: open a game wrapper in a real Chromium page, wait, and
// record WHY it renders (or does not). Prints console errors, failed requests,
// DOM landmarks and a screenshot path so a blank frame can be attributed to the
// game/dependency or to the capture environment.
//
//   node scripts/artwork/probe-render.mjs --ids cl10bullets,cl100roomsofenemies --wait 45000
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { readCatalogRows } from '../catalog-data.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4180';
const ids = (arg('ids', '') || '').split(',').map((v) => v.trim()).filter(Boolean);
const wait = Number(arg('wait', '45000'));
const outDir = path.resolve(arg('out', '/tmp/renderprobe'));
mkdirSync(outDir, { recursive: true });

const rows = new Map(readCatalogRows().map((row) => [row.id, row]));
const browser = await chromium.launch({
  headless: process.env.HEADED ? false : true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const report = [];

for (const id of ids) {
  const row = rows.get(id);
  if (!row) {
    report.push({ id, error: 'no catalog row' });
    continue;
  }
  const page = await context.newPage();
  const consoleErrors = [];
  const failed = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`.slice(0, 300));
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${String(error).slice(0, 300)}`));
  page.on('requestfailed', (request) => failed.push(`${request.url().slice(0, 200)} :: ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.url().slice(0, 200)} :: HTTP ${response.status()}`);
  });
  try {
    await page.goto(BASE + row.path, { waitUntil: 'load', timeout: 30000 });
  } catch (error) {
    report.push({ id, title: row.title, path: row.path, gotoError: String(error).slice(0, 200), consoleErrors, failed });
    await page.close().catch(() => {});
    continue;
  }
  const started = Date.now();
  await page.waitForTimeout(wait);
  await page.mouse.click(640, 360).catch(() => {});
  await page.waitForTimeout(4000);
  const dom = await page.evaluate(() => {
    const body = document.body;
    const canvases = [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`);
    const media = [...document.querySelectorAll('video,embed,object')].length;
    return {
      title: document.title,
      text: (body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
      canvases,
      media,
      ruffle: Boolean(document.querySelector('ruffle-player')),
      frames: [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src')),
      bodyChildCount: body ? body.children.length : 0,
    };
  }).catch((error) => ({ evaluateError: String(error).slice(0, 200) }));
  const shot = path.join(outDir, `${id}.png`);
  await page.screenshot({ path: shot }).catch(() => {});
  report.push({ id, title: row.title, path: row.path, elapsedMs: Date.now() - started, dom, consoleErrors: consoleErrors.slice(0, 12), failed: failed.slice(0, 12), shot });
  await page.close().catch(() => {});
}

await browser.close().catch(() => {});
writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
