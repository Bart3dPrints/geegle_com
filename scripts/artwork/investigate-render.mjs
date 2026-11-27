#!/usr/bin/env node
// Short rendering investigation for catalog entries without artwork.
//
// The owner cancelled the ten-minute observation requirement: artwork now uses
// a 10-15 second window, so SECONDS defaults to 12. The harness still records
// the same evidence per entry:
//
//   Step A  launch the served build, record state, timestamp, console errors,
//           failed requests and engine/canvas information
//   Step B  keep the page open for the whole observation window, in bounded
//           parallel batches, clicking the wrapper's own start control each poll
//   Step D  re-check at the end, capture the final frame, compare it with the
//           initial frame and record the real elapsed time
//
// Evidence is appended to scripts/artwork/render-investigation.json keyed by
// id, so an interrupted run resumes where it stopped (investigated ids are
// skipped unless --force is given).
//
//   node scripts/artwork/investigate-render.mjs --limit 20 --seconds 600
//   node scripts/artwork/investigate-render.mjs --ids cl10bullets --seconds 120
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { readCatalogRows } from '../catalog-data.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4180';
const OUT = path.resolve(arg('out', '/tmp/artshots4'));
const REPORT = path.resolve(arg('report', path.join(ROOT, 'scripts/artwork/render-investigation.json')));
const SECONDS = Number(arg('seconds', '12'));
const POLL = Number(arg('poll', '2000'));
const CONCURRENCY = Math.max(1, Math.min(8, Number(arg('concurrency', '4'))));
const FRAME_MIN_BYTES = Number(arg('frame-min-bytes', '3500'));
const START_CLICK_EVERY = Number(arg('start-click-every', '60000'));
const limit = Number(arg('limit', '0'));
const explicitIds = (arg('ids', '') || '').split(',').map((v) => v.trim()).filter(Boolean);

mkdirSync(OUT, { recursive: true });

const rows = new Map(readCatalogRows().map((row) => [row.id, row]));
const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : {};

// Queue: explicit ids, otherwise previously reopened blockers in a stable order.
let queue = explicitIds;
if (!queue.length) {
  const reopened = existsSync(path.join(ROOT, 'scripts/artwork/reopened.json'))
    ? JSON.parse(readFileSync(path.join(ROOT, 'scripts/artwork/reopened.json'), 'utf8'))
    : {};
  queue = Object.keys(reopened).sort();
}
if (!flag('force')) queue = queue.filter((id) => !report[id]);
if (limit > 0) queue = queue.slice(0, limit);
if (!queue.length) {
  console.log(JSON.stringify({ queued: 0, message: 'nothing left to investigate' }));
  process.exit(0);
}

function save() {
  writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
}

const browser = await chromium.launch({
  headless: process.env.HEADED ? false : true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

// Wrappers call into a host API that only exists inside the Geegle player. A
// stub keeps the served page from throwing before its own engine starts; it
// does not fake any game behaviour.
const HOST_STUB = () => {
  window.maeExportApis_ = window.maeExportApis_ || function () {};
  window.maeExportApis = window.maeExportApis || function () {};
};

function startControlSelector() {
  return [
    '#startButton',
    '#start-button',
    '#start',
    'button:has-text("PLAY")',
    'button:has-text("Play")',
    'button:has-text("START")',
    'button:has-text("Start")',
    'a:has-text("PLAY")',
    '[role="button"]:has-text("PLAY")',
    // In-game tutorial/continue prompts: leaving them up makes the only
    // capturable frame an overlay, which is not acceptable artwork.
    'button:has-text("OK")',
    'button:has-text("Ok")',
    'button:has-text("Continue")',
    'button:has-text("GOT IT")',
  ].join(', ');
}

async function probeState(page) {
  return page.evaluate(() => {
    const body = document.body;
    const canvases = [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`);
    const iframes = [...document.querySelectorAll('iframe')].map((f) => (f.getAttribute('src') || '').slice(0, 180));
    const buttons = [...document.querySelectorAll('button,a[role="button"],#startButton')]
      .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 12);
    return {
      title: document.title,
      text: (body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600),
      canvases,
      iframes,
      buttons,
      ruffle: Boolean(document.querySelector('ruffle-player')),
      bodyChildren: body ? body.children.length : 0,
      scrollHeight: document.documentElement.scrollHeight,
    };
  }).catch((error) => ({ probeError: String(error).slice(0, 200) }));
}

async function clickStart(page) {
  const selector = startControlSelector();
  const handle = await page.$(selector).catch(() => null);
  if (handle) {
    await handle.click({ timeout: 3000 }).catch(() => {});
    return true;
  }
  // No labelled control: interact with the centre of the viewport, which is
  // where an engine asks for its "click to focus" gesture.
  const box = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.click(Math.round(box.width / 2), Math.round(box.height / 2)).catch(() => {});
  return false;
}

async function investigate(id) {
  const row = rows.get(id);
  const entry = {
    id,
    title: row?.title ?? null,
    path: row?.path ?? null,
    launchUrl: row ? BASE + row.path : null,
    startedAt: new Date().toISOString(),
    observedSeconds: 0,
    classification: null,
    initial: null,
    final: null,
    frames: [],
    consoleErrors: [],
    failedRequests: [],
    startControlClicked: false,
  };
  if (!row) {
    entry.classification = 'launched-error';
    entry.error = 'no catalog row';
    report[id] = entry;
    save();
    return entry;
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(HOST_STUB);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') entry.consoleErrors.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => entry.consoleErrors.push(`pageerror: ${String(error).slice(0, 300)}`));
  page.on('requestfailed', (request) => {
    entry.failedRequests.push(`${request.url().slice(0, 220)} :: ${request.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) entry.failedRequests.push(`${response.url().slice(0, 220)} :: HTTP ${response.status()}`);
  });

  let buffer = null;
  try {
    await page.goto(entry.launchUrl, { waitUntil: 'load', timeout: 45000 });
  } catch (error) {
    entry.gotoError = String(error).slice(0, 300);
  }

  const started = Date.now();
  await page.waitForTimeout(3000);
  entry.initial = await probeState(page);
  const initialShot = path.join(OUT, `${id}@0.png`);
  const initialBuffer = await page.screenshot({ path: initialShot }).catch(() => null);
  entry.initialShot = initialShot;
  entry.initialBytes = initialBuffer ? initialBuffer.length : 0;

  const endAt = started + SECONDS * 1000;
  // Three frames spread across the window, so a settling build is captured
  // after its loader has finished rather than mid-load.
  const frameTimes = [0.4, 0.65, 0.9]
    .map((fraction) => started + SECONDS * 1000 * fraction);
  let nextFrame = 0;
  let nextClick = started + 1500;
  let lastProbe = entry.initial;

  while (Date.now() < endAt) {
    const wait = Math.min(POLL, Math.max(500, endAt - Date.now()));
    await page.waitForTimeout(wait).catch(() => {});
    if (nextClick <= Date.now()) {
      const clicked = await clickStart(page);
      entry.startControlClicked = entry.startControlClicked || clicked;
      nextClick = Date.now() + START_CLICK_EVERY;
    }
    lastProbe = await probeState(page);
    if (nextFrame < frameTimes.length && Date.now() >= frameTimes[nextFrame]) {
      buffer = await page.screenshot().catch(() => null);
      if (buffer && buffer.length >= FRAME_MIN_BYTES) {
        const file = path.join(OUT, `${id}@${nextFrame + 1}.png`);
        writeFileSync(file, buffer);
        entry.frames.push({ file, at: new Date().toISOString(), bytes: buffer.length });
      }
      nextFrame += 1;
    }
  }

  // Final re-check, after the full window, with a fresh interaction.
  await clickStart(page).catch(() => {});
  await page.waitForTimeout(4000).catch(() => {});
  entry.finalState = await probeState(page);
  const finalShot = path.join(OUT, `${id}@final.png`);
  const finalBuffer = await page.screenshot({ path: finalShot }).catch(() => null);
  entry.finalShot = finalShot;
  entry.finalBytes = finalBuffer ? finalBuffer.length : 0;
  entry.elapsedMs = Date.now() - started;
  entry.observedSeconds = Math.round(entry.elapsedMs / 1000);
  entry.endedAt = new Date().toISOString();
  entry.changed = Boolean(
    initialBuffer && finalBuffer && (initialBuffer.length !== finalBuffer.length || !initialBuffer.equals(finalBuffer))
  );
  entry.consoleErrors = entry.consoleErrors.slice(0, 25);
  entry.failedRequests = entry.failedRequests.slice(0, 25);

  // Only a written frame proves the build rendered its own content. A pixel
  // change on its own proves nothing: clicking a wrapper's PLAY button removes
  // that button and changes the frame without the game ever starting.
  const gateText = [
    entry.initial?.text,
    entry.initial?.buttons?.join(' '),
    lastProbe?.text,
    lastProbe?.buttons?.join(' '),
  ].filter(Boolean).join(' ');
  const gate = /\bplay\b|\bstart\b|click to|press/i.test(gateText);
  if (entry.gotoError && !entry.initial?.bodyChildren) entry.classification = 'launched-error';
  else if (entry.frames.length > 0) entry.classification = 'rendered';
  else if (gate) entry.classification = 'start-gate-only';
  else entry.classification = 'blank-after-observation';

  await context.close().catch(() => {});
  report[id] = entry;
  save();
  return entry;
}

let cursor = 0;
const results = [];
async function worker() {
  while (cursor < queue.length) {
    const id = queue[cursor++];
    try {
      results.push(await investigate(id));
    } catch (error) {
      report[id] = { id, classification: 'launched-error', error: String(error).slice(0, 300), at: new Date().toISOString() };
      save();
      results.push(report[id]);
    }
  }
}

console.log(JSON.stringify({ queued: queue.length, concurrency: CONCURRENCY, seconds: SECONDS, out: OUT }));
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
await browser.close().catch(() => {});
save();
const totals = results.reduce((acc, entry) => {
  acc[entry.classification] = (acc[entry.classification] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ investigated: results.length, totals, report: REPORT }));
