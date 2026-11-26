#!/usr/bin/env node
// Collect authentic artwork that each local game build already declares.
//
// Tier 3 of the artwork policy: assets bundled with the game itself. The
// wrapper's own <link rel="icon"> / og:image is the strongest evidence of the
// title's identity that needs no network research, so it is collected before
// screenshots. Every candidate must resolve to a real local file with an image
// extension and a plausible byte size; nothing is invented.
//
// Output: scripts/artwork/wrapper-art.json
// Run: node scripts/artwork/scan-wrapper-art.mjs

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gamesDir = path.join(root, 'public', 'games');
const rawDir = path.join(root, 'src', 'data', 'raw');

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|ico)$/i;
const MIN_BYTES = 2048;
const MAX_BYTES = 6 * 1024 * 1024;

function catalog() {
  const rows = readdirSync(rawDir)
    .filter((file) => file.endsWith('.txt') && file !== 'path-exceptions.txt')
    .sort()
    .flatMap((file) => readFileSync(path.join(rawDir, file), 'utf8').split('\n'))
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('|'));
  const exceptions = new Map(
    readFileSync(path.join(rawDir, 'path-exceptions.txt'), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('|')), line.slice(line.indexOf('|') + 1)]),
  );
  const seen = new Set();
  return rows
    .filter(([id, title, categories]) => {
      if (!id || !title || !categories || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(([id, title]) => ({
      id,
      title,
      path: exceptions.get(id) ?? `/games/${encodeURIComponent(id)}.html`,
    }))
    .filter((entry) => entry.path.startsWith('/games/'));
}

function readHead(file) {
  const buffer = readFileSync(file);
  return buffer.subarray(0, Math.min(buffer.length, 400_000)).toString('utf8');
}

function candidates(html) {
  const found = [];
  const push = (value) => {
    if (value) found.push(value.replace(/&amp;/g, '&'));
  };
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/rel\s*=\s*["']?[^"'>]*(?:icon|image_src)/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    push(href);
  }
  for (const match of html.matchAll(/<meta\b[^>]*(?:og:image|twitter:image)[^>]*>/gi)) {
    const content = match[0].match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    push(content);
  }
  return found;
}

const results = [];
const skipped = [];
const usedFiles = new Set();

for (const entry of catalog()) {
  const fileName = decodeURIComponent(entry.path.slice('/games/'.length));
  const filePath = path.join(gamesDir, fileName);
  let html;
  try {
    html = readHead(filePath);
  } catch {
    continue;
  }
  let chosen = null;
  for (const raw of candidates(html)) {
    if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('#')) {
      skipped.push({ id: entry.id, title: entry.title, reason: 'remote-or-inline', value: raw.slice(0, 120) });
      continue;
    }
    const clean = raw.split(/[?#]/)[0];
    const resolved = path.resolve(path.dirname(filePath), decodeURIComponent(clean));
    if (!resolved.startsWith(gamesDir + path.sep)) continue;
    if (!IMAGE_EXT.test(resolved)) continue;
    let stats;
    try {
      stats = statSync(resolved);
    } catch {
      skipped.push({ id: entry.id, title: entry.title, reason: 'missing-file', value: clean });
      continue;
    }
    if (stats.size < MIN_BYTES || stats.size > MAX_BYTES) {
      skipped.push({ id: entry.id, title: entry.title, reason: 'implausible-size', value: `${clean} ${stats.size}` });
      continue;
    }
    const relative = '/games/' + path.relative(gamesDir, resolved).split(path.sep).map(encodeURIComponent).join('/');
    if (usedFiles.has(relative)) {
      skipped.push({ id: entry.id, title: entry.title, reason: 'shared-file', value: relative });
      continue;
    }
    chosen = { url: relative, bytes: stats.size, declared: clean };
    break;
  }
  if (chosen) {
    usedFiles.add(chosen.url);
    results.push({
      id: entry.id,
      title: entry.title,
      url: chosen.url,
      source: `${entry.path} (game build declares ${chosen.declared})`,
      type: 'bundled-icon',
      identityEvidence: 'The game build served at this path declares this image as its own icon or social image.',
      reuseEvidence: 'Bundled with the game build already published in this repository.',
      reviewStatus: 'identity-checked',
    });
  }
}

writeFileSync(
  path.join(root, 'scripts', 'artwork', 'wrapper-art.json'),
  JSON.stringify(
    {
      generatedFrom: 'local game builds',
      summary: skipped.reduce((all, item) => ({ ...all, [item.reason]: (all[item.reason] ?? 0) + 1 }), {}),
      entries: results,
      skipped: skipped.slice(0, 40),
    },
    null,
    2,
  ) + '\n',
);
console.log(`wrapper artwork: ${results.length} entries, ${skipped.length} skipped`);
const reasons = skipped.reduce((all, item) => ({ ...all, [item.reason]: (all[item.reason] ?? 0) + 1 }), {});
console.log(reasons);
