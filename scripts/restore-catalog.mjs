#!/usr/bin/env node
// Restoration of catalog entries that earlier dedupe passes dropped.
//
// The owner reversed the dedupe direction: entries removed only because their
// file, title or hash matched another entry belong in the catalog with their
// original stable IDs, including alternate builds of the same game. This script
// reads the pre-overhaul catalog (commit 2d09055) from the local git object
// store, recovers deleted game files from history where possible, and writes
// the restored rows plus any non-standard launch paths.
//
// Idempotency rules (the previous version broke both):
//   1. restored.txt is OUTPUT, never input. Previously restored rows are read
//      and carried forward instead of being treated as existing catalog rows
//      that a re-run then overwrote.
//   2. A row is only added; the script never deletes a row or a path exception.
//
// Run: node scripts/restore-catalog.mjs
// Output: src/data/raw/restored.txt, plus path-exceptions entries.
//
// The only intentional exclusion of a historical entry is the owner-authorized
// Poly Track removal (EXPLICIT_EXCLUSIONS); every other EXCLUDE id is a
// non-game (app, proxy, theme, removed chatbot) or an outdated alias.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HISTORICAL = '2d09055cf7e7f7031a9d0b24e78670b428782ed8';
const gamesDir = path.join(root, 'public', 'games');
const rawDir = path.join(root, 'src', 'data', 'raw');
const restoredFile = path.join(rawDir, 'restored.txt');

// Not games: legitimate apps already in the Apps section, removed chatbots
// (the contract forbids resurrecting them), proxy pages (their own section),
// and page/theme files that were never games.
const EXCLUDE = new Set([
  'suggestions', 'code-editor', 'soundboard', 'chat-bot',
  'celestial', 'doge', 'heilos', 'lucide', 'xylora', 'vapor', 'voidproxy1',
  'proxy1', 'proxy2', 'proxy3', 'default', 'liquidglass', 'claymorphism',
  'aurora', 'neubrutalism', 'abstract3d', 'dynamic', 'interactive', 'solid',
  'neural', 'circuit', 'packets', 'matrix', 'hologrid', 'smoke', 'flow',
  'radar', 'glitch', 'codefrag', 'terminal', 'aicore', 'gravity', 'hud',
  'peach', 'nikehub',
]);

// Owner-authorized exception to the restore-everything policy: only
// "Polytrack (working)" (clpolytrackworksnow) may be visible. These IDs and
// their files must never return to the catalog.
const EXPLICIT_EXCLUSIONS = new Set([
  'clpolytrackbutnotflagged',
  'clpolytrackbutnotflagged-1',
  'clpolytrackbutnotflagged(1)',
]);

const historical = execFileSync('git', ['show', `${HISTORICAL}:src/App.tsx`], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const entries = [...historical.matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*url:\s*'([^']+)'/g)].map(
  (match) => ({ id: match[1], title: match[2], url: match[3] }),
);

const readRows = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('|'));

// Previously restored rows are carried forward verbatim.
const restoredRows = existsSync(restoredFile) ? readRows(restoredFile) : [];
const restoredIds = new Set(restoredRows.map(([id]) => id));

// Everything else in raw/*.txt is the existing catalog. restored.txt is
// deliberately skipped: it is this script's output.
const existingRows = readdirSync(rawDir)
  .filter((file) => file.endsWith('.txt') && file !== 'path-exceptions.txt' && file !== 'restored.txt')
  .flatMap((file) => readRows(path.join(rawDir, file)));
const existingIds = new Set(existingRows.map(([id]) => id));

const files = readdirSync(gamesDir);
const byLower = new Map(files.map((file) => [file.toLowerCase(), file]));

/** Recover a deleted build from the repository history, if it was ever committed. */
function recoverFromHistory(decoded) {
  let commits = [];
  try {
    commits = execFileSync(
      'git',
      ['log', '--all', '--format=%H', '--', `public/games/${decoded}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    )
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return null;
  }
  for (const commit of commits) {
    try {
      const content = execFileSync('git', ['show', `${commit}:public/games/${decoded}`], {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
      });
      writeFileSync(path.join(gamesDir, decoded), content);
      return decoded;
    } catch {
      // Commit did not contain this exact path; try the next one.
    }
  }
  return null;
}

function localFile(url) {
  if (!url.startsWith('/games/')) return null;
  const decoded = decodeURIComponent(url.slice('/games/'.length));
  if (decoded.includes('/') || decoded.includes('\\')) return null;
  if (existsSync(path.join(gamesDir, decoded))) return decoded;
  const match = byLower.get(decoded.toLowerCase());
  if (match) return match;
  return recoverFromHistory(decoded);
}

const categoriesFor = (title) => {
  if (/pok[eé]mon/i.test(title)) return 'pokemon,retro,adventure';
  if (/mario|zelda|sonic|metroid|kirby|mega ?man|castlevania|donkey kong/i.test(title)) return 'retro,platformer';
  if (/riddle|factory balls|puzzle/i.test(title)) return 'puzzle,casual';
  if (/minecraft|fallout/i.test(title)) return 'adventure,sandbox';
  if (/snow/i.test(title)) return 'arcade,casual';
  return 'arcade';
};

const restored = [];
const pathExceptions = [];
const blocked = [];
for (const entry of entries) {
  if (EXCLUDE.has(entry.id) || EXPLICIT_EXCLUSIONS.has(entry.id)) continue;
  if (existingIds.has(entry.id) || restoredIds.has(entry.id)) continue;
  const file = localFile(entry.url);
  if (!file) {
    blocked.push(entry);
    continue;
  }
  restored.push({ ...entry, categories: categoriesFor(entry.title) });
  const defaultPath = `/games/${entry.id}.html`;
  if (file !== `${entry.id}.html`) {
    pathExceptions.push(`${entry.id}|/games/${encodeURIComponent(file)}`);
  }
}

// Union: keep every previously restored row, append genuinely new ones.
const byId = new Map(restoredRows.map((row) => [row[0], row]));
for (const entry of restored) {
  byId.set(entry.id, [entry.id, entry.title, entry.categories]);
}
const finalRows = [...byId.values()].sort((a, b) => a[1].localeCompare(b[1]));

writeFileSync(
  restoredFile,
  '# Restored after the owner reversed the duplicate-removal direction.\n' +
    '# id|title|categories\n' +
    finalRows.map((row) => row.join('|')).join('\n') +
    '\n',
);

if (pathExceptions.length > 0) {
  const exceptionsPath = path.join(rawDir, 'path-exceptions.txt');
  const current = readFileSync(exceptionsPath, 'utf8');
  const present = new Set(current.split('\n').map((line) => line.split('|')[0]));
  const additions = pathExceptions.filter(
    (line) => !present.has(line.split('|')[0]) && !EXPLICIT_EXCLUSIONS.has(line.split('|')[0])
  );
  if (additions.length > 0) {
    writeFileSync(exceptionsPath, current.replace(/\n*$/, '\n') + additions.join('\n') + '\n');
  }
}

console.log(`restored ${restored.length} new entries; ${finalRows.length} total restored rows`);
console.log(`blocked (file never committed): ${blocked.length}`);
for (const entry of blocked) console.log(`  - ${entry.id} :: /games/${entry.title}`);
console.log(
  'snow rider:',
  ['clsnowrider', 'snow-rider', 'clsnowridergoodygumdrops', 'clsnowriderrrr']
    .map((id) => `${id}=${restored.some((entry) => entry.id === id) || existingIds.has(id) || restoredIds.has(id)}`)
    .join(' ')
);
