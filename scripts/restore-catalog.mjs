#!/usr/bin/env node
// One-time restoration of catalog entries that an earlier dedupe pass dropped.
//
// The owner reversed the dedupe direction: entries that were removed only
// because their file, title or hash matched another entry must stay in the
// catalog with their original stable IDs. This script reads the pre-overhaul
// catalog (commit 2d09055) from the local git object store, keeps every game
// entry whose local HTML build is still on disk, and writes the restored rows
// plus any non-standard launch paths.
//
// Run: node scripts/restore-catalog.mjs
// Output: src/data/raw/restored.txt, plus path-exceptions entries.
// It never deletes a row and never rewrites an existing catalog file.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HISTORICAL = '2d09055cf7e7f7031a9d0b24e78670b428782ed8';
const gamesDir = path.join(root, 'public', 'games');
const rawDir = path.join(root, 'src', 'data', 'raw');

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

const historical = execFileSync('git', ['show', `${HISTORICAL}:src/App.tsx`], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const entries = [...historical.matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*url:\s*'([^']+)'/g)].map(
  (match) => ({ id: match[1], title: match[2], url: match[3] }),
);

const existingRows = readdirSync(rawDir)
  .filter((file) => file.endsWith('.txt') && file !== 'path-exceptions.txt')
  .flatMap((file) => readFileSync(path.join(rawDir, file), 'utf8').split('\n'))
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split('|'));
const existingIds = new Set(existingRows.map(([id]) => id));

const files = readdirSync(gamesDir);
const byLower = new Map(files.map((file) => [file.toLowerCase(), file]));

function localFile(url) {
  if (!url.startsWith('/games/')) return null;
  const decoded = decodeURIComponent(url.slice('/games/'.length));
  if (decoded.includes('/') || decoded.includes('\\')) return null;
  if (existsSync(path.join(gamesDir, decoded))) return decoded;
  return byLower.get(decoded.toLowerCase()) ?? null;
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
for (const entry of entries) {
  if (EXCLUDE.has(entry.id) || existingIds.has(entry.id)) continue;
  const file = localFile(entry.url);
  if (!file) continue;
  restored.push({ ...entry, categories: categoriesFor(entry.title) });
  const defaultPath = `/games/${entry.id}.html`;
  if (file !== `${entry.id}.html`) pathExceptions.push(`${entry.id}|/games/${encodeURIComponent(file)}`);
}

restored.sort((a, b) => a.title.localeCompare(b.title));
writeFileSync(
  path.join(rawDir, 'restored.txt'),
  '# Restored after the owner reversed the duplicate-removal direction.\n' +
    '# id|title|categories\n' +
    restored.map((entry) => `${entry.id}|${entry.title}|${entry.categories}`).join('\n') + '\n',
);

if (pathExceptions.length > 0) {
  const exceptionsPath = path.join(rawDir, 'path-exceptions.txt');
  const current = readFileSync(exceptionsPath, 'utf8');
  const present = new Set(current.split('\n').map((line) => line.split('|')[0]));
  const additions = pathExceptions.filter((line) => !present.has(line.split('|')[0]));
  if (additions.length > 0) {
    writeFileSync(exceptionsPath, current.replace(/\n*$/, '\n') + additions.join('\n') + '\n');
  }
}

console.log(`restored ${restored.length} entries; ${pathExceptions.length} path exceptions`);
console.log('snow rider:', ['clsnowrider', 'snow-rider', 'clsnowridergoodygumdrops', 'clsnowriderrrr'].map((id) => `${id}=${restored.some((entry) => entry.id === id) || existingIds.has(id)}`).join(' '));
