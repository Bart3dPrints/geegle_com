#!/usr/bin/env node
// Internet research stage: find authentic icons, logos and game artwork that a
// title's own remote distribution publishes.
//
// Runs BEFORE any title-screen capture. For each catalog entry without verified
// artwork it:
//   1. derives the remote build/pages the local wrapper loads (`<base href>`,
//      iframe src, jsDelivr build root, direct host);
//   2. fetches those pages from the live internet and reads their declared
//      icon / apple-touch-icon / OpenGraph / Twitter / manifest artwork;
//   3. probes the build root for conventional logo and icon files when no
//      metadata exists;
//   4. downloads the best candidates for validation.
//
// Nothing is accepted here: scripts/artwork/accept-candidates.py validates the
// bytes and every accepted image is reviewed on a contact sheet. Each record
// lists the acquisition methods that were actually attempted.
//
//   node scripts/artwork/research-assets.mjs --out /tmp/artcandidates --limit 200
//   node scripts/artwork/research-assets.mjs --ids cl1on1soccer,cl2048
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readCatalogRows, localFilename } from '../catalog-data.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const outDir = path.resolve(arg('out', '/tmp/artcandidates'));
const limit = Number(arg('limit', '0'));
const only = new Set((arg('ids', '') || '').split(',').map((v) => v.trim()).filter(Boolean));
const concurrency = Math.max(1, Number(arg('concurrency', '8')));
const timeout = Number(arg('timeout', '9000'));
mkdirSync(outDir, { recursive: true });

const manifestPath = path.join(outDir, 'manifest.json');
let manifest = {};
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { manifest = {}; }

const cleared = JSON.parse(readFileSync(path.join(root, 'scripts/artwork-map.json'), 'utf8')).cleared ?? {};
const captured = JSON.parse(readFileSync(path.join(root, 'scripts/artwork/captured.json'), 'utf8'));
const done = new Set([...Object.keys(cleared), ...Object.keys(captured.assets ?? {}), ...Object.keys(captured.screens ?? {})]);

const IMAGE = /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i;
const GOOD = /(logo|icon|cover|thumbnail|thumb|preview|banner|og[-_]?image|social|title)/i;
const BAD = /(splash|presplash|loading|placeholder|spinner|favicon\.ico|apple-touch|mstile|screenshot[-_]?small)/i;
const PROBES = [
  'logo.png', 'logo.webp', 'logo.jpg', 'images/logo.png', 'img/logo.png', 'assets/logo.png',
  'icon.png', 'icon-512.png', 'icon-192.png', 'icon-256.png', 'images/icon.png', 'assets/icon.png',
  'thumbnail.png', 'thumb.png', 'cover.png', 'preview.png', 'og.png', 'og-image.png',
];

function readWrapper(file) {
  try { return readFileSync(path.join(root, 'public', 'games', decodeURIComponent(file)), 'utf8').slice(0, 800_000); } catch { return ''; }
}

function pageCandidates(html, wrapperFile) {
  const pages = [];
  const add = (raw) => {
    if (!raw) return;
    const value = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!/^https?:\/\//i.test(value)) return;
    if (/cdn\.jsdelivr\.net\/(?:npm\/@ruffle-rs|gh\/.*ruffle)/i.test(value)) return;
    try {
      const url = new URL(value);
      if (url.hostname === 'cdn.jsdelivr.net') {
        // A build file: use its directory with index.html and the directory itself.
        const dir = url.pathname.replace(/\/[^/]*$/, '/');
        pages.push(`https://cdn.jsdelivr.net${dir}index.html`);
        pages.push(`https://cdn.jsdelivr.net${dir}`);
      } else {
        pages.push(url.href);
        const dir = url.pathname.replace(/\/[^/]*$/, '/');
        if (dir !== url.pathname) pages.push(url.origin + dir);
      }
    } catch { /* ignore malformed URLs */ }
  };
  const base = html.match(/<base\b[^>]*href\s*=\s*["']([^"']+)["']/i);
  if (base) add(base[1]);
  for (const match of html.matchAll(/<iframe\b[^>]*src\s*=\s*["']([^"']+)["']/gi)) add(match[1]);
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["']/gi)) add(match[1]);
  // Build URLs are frequently configured inside inline scripts rather than in
  // tags (Ruffle and Unity wrappers do this).
  for (const match of html.matchAll(/https?:\/\/[^"'\s<>)]+\.(?:swf|js|json|html?|wasm)(?:\?[^"'\s<>)]*)?/gi)) add(match[0]);
  return [...new Set(pages)].slice(0, 4);
}

async function get(url, asText = true) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'GeegleArtwork/2.0' } });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    if (asText && !/text\/html|application\/xhtml|application\/json|text\/plain/i.test(type)) return null;
    return asText ? await response.text() : response;
  } catch {
    return null;
  }
}

function resolve(base, raw) {
  try { return new URL(raw.replace(/&amp;/g, '&'), base).href; } catch { return null; }
}

function parseArt(html, pageUrl) {
  const found = [];
  const push = (raw, method) => {
    if (!raw) return;
    const url = resolve(pageUrl, raw);
    if (!url || !/^https?:/i.test(url)) return;
    if (!IMAGE.test(url) || BAD.test(url)) return;
    found.push({ url, method });
  };
  for (const match of html.matchAll(/<meta\b[^>]*(?:property|name)\s*=\s*["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]*>/gi)) {
    const content = match[0].match(/content\s*=\s*["']([^"']+)["']/i);
    if (content) push(content[1], 'official-og');
  }
  for (const match of html.matchAll(/<link\b[^>]*rel\s*=\s*["'][^"']*(?:icon|apple-touch-icon|image_src)[^"']*["'][^>]*>/gi)) {
    const href = match[0].match(/href\s*=\s*["']([^"']+)["']/i);
    if (href) push(href[1], 'official-icon');
  }
  for (const match of html.matchAll(/<img\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (GOOD.test(match[1])) push(match[1], 'game-asset');
  }
  return found;
}

async function download(url, file) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'GeegleArtwork/2.0' } });
    if (!response.ok) return 0;
    const type = response.headers.get('content-type') ?? '';
    if (type && !/image\/|svg|octet-stream/i.test(type)) return 0;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1024 || bytes.length > 6 * 1024 * 1024) return 0;
    writeFileSync(file, bytes);
    return bytes.length;
  } catch {
    return 0;
  }
}

const rows = readCatalogRows();
const seen = new Set();
const todo = [];
for (const row of rows) {
  if (seen.has(row.id)) continue;
  seen.add(row.id);
  if (done.has(row.id) || manifest[row.id]) continue;
  if (!localFilename(row.path)) continue;
  if (only.size && !only.has(row.id)) continue;
  todo.push(row);
}
todo.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const batch = limit > 0 ? todo.slice(0, limit) : todo;
console.log(`[research] ${batch.length} of ${todo.length} entries`);

let cursor = 0;
let researched = 0;
let withCandidates = 0;
let files = 0;

async function research(row) {
  const html = readWrapper(localFilename(row.path));
  const methods = [];
  const sources = [];
  const record = { id: row.id, title: row.title, methods, sources, candidates: [] };
  const pages = pageCandidates(html, row.path);
  if (!pages.length) {
    methods.push('no reachable remote distribution found');
    return record;
  }
  const found = [];
  for (const page of pages.slice(0, 3)) {
    const body = await get(page);
    if (!body) continue;
    sources.push(page);
    const parsed = parseArt(body, page);
    methods.push(`fetched ${new URL(page).hostname} page metadata`);
    for (const item of parsed) found.push(item);
    if (found.length >= 4) break;
  }
  // Probe conventional asset paths next to the strongest build root.
  if (found.length < 2 && pages.length) {
    const first = pages[0];
    const baseDir = first.replace(/[^/]*$/, '');
    for (const probe of PROBES.slice(0, 10)) {
      const url = baseDir + probe;
      const response = await get(url, false);
      if (!response) continue;
      const type = response.headers.get('content-type') ?? '';
      if (!/image\/|svg/i.test(type)) continue;
      found.push({ url, method: 'game-asset' });
      methods.push('probed build asset paths');
      if (found.length >= 3) break;
    }
  }
  // Deduplicate and prefer declared OpenGraph/icon over generic assets.
  const rank = { 'official-og': 0, 'official-icon': 1, 'game-asset': 2 };
  const unique = new Map();
  for (const item of found) {
    if (!unique.has(item.url)) unique.set(item.url, item);
  }
  const picks = [...unique.values()].sort((a, b) => rank[a.method] - rank[b.method]).slice(0, 3);
  for (const [index, item] of picks.entries()) {
    const dir = path.join(outDir, row.id);
    mkdirSync(dir, { recursive: true });
    const ext = (item.url.split('?')[0].split('.').pop() || 'png').toLowerCase().slice(0, 4);
    const file = path.join(dir, `${index + 1}.${ext}`);
    const size = await download(item.url, file);
    if (!size) continue;
    record.candidates.push({ file, url: item.url, bytes: size, method: item.method });
    files += 1;
  }
  if (record.candidates.length) withCandidates += 1;
  return record;
}

await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < batch.length) {
    const row = batch[cursor++];
    try {
      manifest[row.id] = await research(row);
    } catch (error) {
      manifest[row.id] = { id: row.id, title: row.title, methods: [`research error: ${String(error).slice(0, 80)}`], sources: [], candidates: [] };
    }
    researched += 1;
    if (researched % 20 === 0) {
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
      console.log(`[research] ${researched}/${batch.length}`);
    }
  }
}));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({ researched, withCandidates, files }));
