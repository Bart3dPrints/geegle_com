#!/usr/bin/env node
// Compare local launch paths with the pre-overhaul catalog. Prints candidates; never rewrites data.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { catalogRoot as root, localFilename, readCatalogRows } from './catalog-data.mjs';

const rows = readCatalogRows();
const entries = new Map();
for (const row of rows) if (!entries.has(row.id)) entries.set(row.id, row);

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

const missing = [];
const restore = [];
let external = 0;
const referenced = new Set();
for (const { id, path } of entries.values()) {
  const file = localFilename(path);
  if (file === null) {
    if (path.startsWith('https://')) external++;
    else missing.push({ id, path });
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
  rows: rows.length, games: entries.size, duplicateIdRows: rows.length - entries.size,
  ...(ref ? {
    originalCatalogIds: originals.size,
    addedIds: [...entries.keys()].filter((id) => !originals.has(id)).sort(),
    originalIdsNotInGames: [...originals.keys()].filter((id) => !entries.has(id)).sort(),
  } : {}),
  localExisting: entries.size - external - missing.length,
  distinctLocalPaths: referenced.size,
  external,
  unreferencedHtml: [...files].filter((file) => file.endsWith('.html') && !referenced.has(file)).length,
  missing, restore,
}, null, 2));
