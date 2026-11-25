#!/usr/bin/env node
// Duplicate audit: flags catalog ids pointing at files whose content loads the
// identical remote build (same CDN URL/commit), which are confirmed
// duplicates. Distinct builds are NOT flagged. Run with: node scripts/audit-duplicates.mjs

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gamesDir = path.join(root, 'public', 'games');
const rawDir = path.join(root, 'src', 'data', 'raw');

// 1. Load catalog ids + their launch file names.
const ids = new Map();
for (const file of await readdir(rawDir)) {
  if (!file.endsWith('.txt') || file === 'path-exceptions.txt') continue;
  const content = await readFile(path.join(rawDir, file), 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const bar = trimmed.indexOf('|');
    if (bar > 0) ids.set(trimmed.slice(0, bar), true);
  }
}

// 2. Extract the primary remote build URL from each game HTML.
const builds = new Map(); // buildUrl -> [ids]
const fileToId = new Map();
for (const id of ids.keys()) {
  const decoded = decodeURIComponent(id);
  fileToId.set(decoded, id);
}

for (const file of await readdir(gamesDir)) {
  if (!/\.html?$/i.test(file)) continue;
  const id = fileToId.get(file.replace(/\.html?$/i, ''));
  if (!id) continue;
  const content = await readFile(path.join(gamesDir, file), 'utf8').catch(() => '');
  if (!content) continue;

  // The first CDN URL referencing a game build (jsdelivr/gh with repo@commit)
  // is the build fingerprint.
  const m = content.match(
    /https:\/\/cdn\.jsdelivr\.net\/gh\/([^"'\s]+?)@[0-9a-f]{40}([^"'\s]*)/
  );
  if (m) {
    const key = `${m[1]}@${m[2] || ''}`;
    if (!builds.has(key)) builds.set(key, []);
    builds.get(key).push(id);
  }
}

// 3. Report groups where multiple catalog ids share one build.
let duplicatesFound = 0;
for (const [build, group] of builds) {
  if (group.length > 1) {
    duplicatesFound++;
    console.log(`\nCONFIRMED DUPLICATE (same build ${build}):`);
    for (const id of group) console.log(`  - ${id}`);
  }
}

if (duplicatesFound === 0) {
  console.log('No same-build duplicates found among catalog entries.');
}
