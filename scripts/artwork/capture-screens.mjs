#!/usr/bin/env node
// Capture authentic title screens / gameplay from games this repository serves.
//
// Priority 4 of the artwork policy: only for titles with no obtainable official
// icon, logo or gameplay asset. Frames are taken over time (before and after a
// click so engine splashes and "PLAY" gates are passed), written to a staging
// directory, and later validated and optimised by scripts/artwork/process-shots.py.
//
// Resumable: ids already staged, or already present in scripts/artwork captured
// records / artwork-map cleared records, are skipped. A crashed or wedged
// browser is relaunched and the item is retried once; a failed item never stops
// the batch.
//
// Usage:
//   node scripts/artwork/capture-screens.mjs --out /tmp/artshots --limit 25
//   node scripts/artwork/capture-screens.mjs --ids clhobo,clslope --out /tmp/artshots
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { readCatalogRows, localFilename } from '../catalog-data.mjs';

const root = process.cwd();
const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4180';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
const outDir = path.resolve(arg('out', '/tmp/artshots'));
const limit = Number(arg('limit', '0'));
const onlyIds = (arg('ids', '') || '').split(',').map((v) => v.trim()).filter(Boolean);
const waitFirst = Number(arg('wait', '5000'));
const concurrency = Math.max(1, Number(arg('concurrency', '3')));
const force = args.includes('--force');
mkdirSync(outDir, { recursive: true });

function json(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const cleared = json(path.join(root, 'scripts/artwork-map.json'), { cleared: {} }).cleared ?? {};
const captured = json(path.join(root, 'scripts/artwork/captured.json'), {});
const known = new Set([...Object.keys(cleared), ...Object.keys(captured.assets ?? {}), ...Object.keys(captured.screens ?? {})]);
const reviewDecisions = json(path.join(root, 'scripts/artwork/review.json'), {});
const rejected = new Set(Object.entries(reviewDecisions).filter(([, v]) => v && v.status === 'rejected').map(([id]) => id));
const staged = new Set(
  readdirSync(outDir)
    .filter((name) => name.endsWith('.png'))
    .map((name) => name.replace(/@\d+\.png$/, '')),
);

const rows = readCatalogRows();
const seen = new Set();
const todo = [];
for (const row of rows) {
  if (seen.has(row.id)) continue;
  seen.add(row.id);
  if (!localFilename(row.path)) continue;
  if (!force && (known.has(row.id) || staged.has(row.id) || rejected.has(row.id))) continue;
  if (onlyIds.length && !onlyIds.includes(row.id)) continue;
  todo.push(row);
}
todo.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const batch = limit > 0 ? todo.slice(0, limit) : todo;
console.log(`[capture] ${batch.length} of ${todo.length} eligible ids -> ${outDir}`);

let browser;
let context;
let contextUses = 0;

async function launch() {
  if (browser) await browser.close().catch(() => {});
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
  context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(20000);
  contextUses = 0;
}

const results = [];
let completed = 0;

async function framesFor(row) {
  const page = await context.newPage();
  const frames = [];
  try {
    await page.goto(BASE + row.path, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(waitFirst);
    frames.push(await page.screenshot({ type: 'png' }));
    // Pass an engine splash or a "tap/play to start" gate.
    for (let step = 0; step < 3; step += 1) {
      await page.mouse.click(640, 360).catch(() => {});
      await page.waitForTimeout(2500);
      frames.push(await page.screenshot({ type: 'png' }));
    }
  } finally {
    await page.close().catch(() => {});
  }
  return frames;
}

async function captureOne(row) {
  let frames = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      frames = await framesFor(row);
      break;
    } catch (error) {
      const message = String(error);
      results.push({ id: row.id, title: row.title, attempt: attempt + 1, error: message.slice(0, 160) });
      // A dead context cannot create pages; rebuild it before retrying.
      contextUses += 4;
      await launch().catch(() => {});
      if (attempt === 1) return;
    }
  }
  frames.forEach((buffer, i) => writeFileSync(path.join(outDir, `${row.id}@${i + 1}.png`), buffer));
  // Recycle the context periodically so a single wedged renderer cannot stall
  // the whole run.
  contextUses += 1;
  if (contextUses > 120) await launch().catch(() => {});
}

await launch();
let cursor = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < batch.length) {
      const row = batch[cursor++];
      await captureOne(row);
      completed += 1;
      if (completed % 25 === 0) console.log(`[capture] ${completed}/${batch.length}`);
    }
  }),
);
writeFileSync(path.join(outDir, 'capture-report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
await browser.close().catch(() => {});
console.log(`[capture] done ${completed}`);
