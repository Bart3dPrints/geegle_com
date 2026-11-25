#!/usr/bin/env node
// Compare local launch paths with the pre-overhaul catalog. Prints candidates; never rewrites data.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const raw = new URL('src/data/raw/', root);
const readRows = (file) => readFileSync(new URL(file, raw), 'utf8').split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split('|'));

const exceptionsFile = 'path-exceptions.txt';
const exceptions = new Map(readRows(exceptionsFile));
const ids = new Set();
let rows = 0;
for (const file of readdirSync(raw).sort()) {
  if (!file.endsWith('.txt') || file === exceptionsFile) continue;
  for (const [id, title, categories] of readRows(file)) {
    if (!id || !title || !categories) continue;
    ids.add(id);
    rows++;
  }
}

const originals = new Map();
const ref = process.argv[2];
if (ref) {
  const source = execFileSync('git', ['show', `${ref}:src/App.tsx`], { cwd: root, encoding: 'utf8' });
  const originalGames = source.match(/const games = \[\r?\n([\s\S]*?)\r?\n\];/)?.[1];
  if (!originalGames) throw new Error(`No pre-overhaul game array in ${ref}:src/App.tsx`);
  for (const [, , id, , , url] of originalGames.matchAll(/\{\s*id:\s*(["'])(.*?)\1,\s*name:\s*(["'])(?:\\.|.)*?\3,\s*url:\s*(["'])(.*?)\4/g)) {
    if (!originals.has(id)) originals.set(id, new Set());
    originals.get(id).add(url);
  }
}

const files = new Set(readdirSync(new URL('public/games/', root), { withFileTypes: true })
  .filter((file) => file.isFile())
  .map((file) => file.name));
const canonicalFiles = new Map();
for (const file of files) {
  const normalized = file.normalize('NFC');
  if (!canonicalFiles.has(normalized)) canonicalFiles.set(normalized, []);
  canonicalFiles.get(normalized).push(file);
}

function localFilename(path) {
  if (!path.startsWith('/games/')) return null;
  const name = decodeURIComponent(new URL(path, 'https://geegle.invalid').pathname.slice('/games/'.length));
  return name.includes('/') ? null : name;
}

const missing = [];
const restore = [];
let external = 0;
const referenced = new Set();
for (const id of ids) {
  const path = exceptions.get(id) ?? `/games/${encodeURIComponent(id)}.html`;
  const file = localFilename(path);
  if (file === null) {
    external++;
    continue;
  }
  if (files.has(file)) {
    referenced.add(file);
    continue;
  }
  missing.push({ id, path });
  const previous = originals.get(id);
  if (previous?.size !== 1) continue;
  const [original] = previous;
  const originalFile = localFilename(original);
  if (files.has(originalFile)) {
    restore.push([id, original]);
  } else if (originalFile) {
    const equivalents = canonicalFiles.get(originalFile.normalize('NFC'));
    if (equivalents?.length === 1) restore.push([id, `/games/${encodeURIComponent(equivalents[0])}`]);
  }
}

console.log(JSON.stringify({
  rows, games: ids.size, duplicateIdRows: rows - ids.size,
  ...(ref ? {
    originalCatalogIds: originals.size,
    addedIds: [...ids].filter((id) => !originals.has(id)).sort(),
    originalIdsNotInGames: [...originals.keys()].filter((id) => !ids.has(id)).sort(),
  } : {}),
  localExisting: ids.size - external - missing.length, external,
  unreferencedHtml: [...files].filter((file) => file.endsWith('.html') && !referenced.has(file)).length,
  missing, restore,
}, null, 2));
