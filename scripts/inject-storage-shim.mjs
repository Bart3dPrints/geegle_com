#!/usr/bin/env node
// Inject the per-account storage shim into every local game wrapper.
//
// The shim scopes localStorage, sessionStorage and IndexedDB, so it must be
// present in any wrapper whose engine might persist progress (HTML5, Unity
// WebGL, Ruffle, Emscripten, Construct). Injecting into all of them keeps the
// coverage table honest: a wrapper either carries the shim or is reported as
// unsupported. Deterministic and idempotent: rerunning never adds a second
// copy, and wrappers that already scope keys themselves are skipped.
//
// Usage: node scripts/inject-storage-shim.mjs [--dry-run]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { catalogRoot, localFilename, readCatalogRows } from './catalog-data.mjs';

const dryRun = process.argv.includes('--dry-run');
const gamesDir = new URL('public/games/', catalogRoot);
const TAG = 'data-geegle-storage';
const SRC = '/games/geegle-storage-shim.js';

// catalog path -> stable id, so the shim namespaces by catalog id rather than
// by filename (several filenames carry spaces, "copy" suffixes or casing).
const idsByFile = new Map();
for (const row of readCatalogRows()) {
  const file = localFilename(row.path);
  if (file && !idsByFile.has(file)) idsByFile.set(file, row.id);
}

const report = { scanned: 0, injected: 0, alreadyScoped: 0, skippedNoMarker: 0 };

for (const dirent of readdirSync(gamesDir, { withFileTypes: true })) {
  if (!dirent.isFile() || !dirent.name.toLowerCase().endsWith('.html')) continue;
  report.scanned += 1;
  const file = new URL(dirent.name, gamesDir);
  const html = readFileSync(file, 'utf8');
  if (html.includes(TAG)) { report.alreadyScoped += 1; continue; }
  // These wrappers already namespace every key themselves via geegleSaveKey.
  if (html.includes('geegleSaveKey')) { report.alreadyScoped += 1; continue; }

  const id = idsByFile.get(dirent.name) ?? dirent.name.replace(/\.html$/i, '');
  const tag = `<script src="${SRC}" ${TAG} data-game="${id.replace(/"/g, '&quot;')}"></script>`;

  let next;
  const head = html.match(/<head(\s[^>]*)?>/i);
  if (head) {
    const at = head.index + head[0].length;
    next = html.slice(0, at) + tag + html.slice(at);
  } else if (/<html(\s[^>]*)?>/i.test(html)) {
    next = html.replace(/<html(\s[^>]*)?>/i, (match) => match + tag);
  } else {
    // Bare fragment wrappers: the shim must run before any game script.
    next = tag + html;
    report.skippedNoMarker += 1;
  }
  report.injected += 1;
  if (!dryRun) writeFileSync(file, next);
}

console.log(JSON.stringify({ root: 'public/games', dryRun, ...report }, null, 2));
