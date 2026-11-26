#!/usr/bin/env node
// Build-time catalog generator for Geegle.
//
// Scans public/games and public/apps for .html files, applies the curated
// overrides in scripts/catalog-overrides.json, detects byte-identical
// duplicate and "copy" files, and emits src/data/generated-catalog.ts.
//
// This guarantees every game file on disk gets a catalog entry, so nothing
// that previously launched can be orphaned by the redesign.
//
// Runs automatically before `npm run build` (prebuild hook).

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const overridesPath = path.join(root, 'scripts', 'catalog-overrides.json');
const outPath = path.join(root, 'src', 'data', 'generated-catalog.ts');

const SCAN_DIRS = [
  { dir: path.join(root, 'public', 'games'), mount: '/games', app: false },
  { dir: path.join(root, 'public', 'apps'), mount: '/apps', app: true },
];

const overrides = JSON.parse(await readFile(overridesPath, 'utf8'));

// Keyword-based category inference for titles without curated metadata.
const CATEGORY_KEYWORDS = [
  [/pok[eé]mon/i, ['pokemon', 'retro', 'adventure']],
  [/mario|zelda|sonic|metroid|castlevania|tetris|pac-?man|galaga|bomberman|contra|donkey kong|kirby|bubble bobble/i, ['retro']],
  [/racing|drift|road|car|bike|moto|truck|kart/i, ['racing']],
  [/soccer|football|fifa|basket|tennis|golf|boxing|cricket|bowling|skate|snowboard/i, ['sports']],
  [/five nights|fnaf|horror|granny|creepy|backrooms|baldi/i, ['horror']],
  [/puzzle|2048|sudoku|mahjong|solitaire|escape|maze|brain|logic/i, ['puzzle']],
  [/chess|strategy|war|defense|defend|tower|empire|kingdom/i, ['strategy']],
  [/simulat|tycoon|city|farm|flight|business|idle/i, ['simulation']],
  [/vex|geometr|dash|jump|ninja|parkour/i, ['platformer']],
  [/\.io\b|multiplayer|player [234]|2 player|1v1/i, ['multiplayer']],
  [/clicker|merge|snake|tiles|bubble|casual/i, ['casual']],
  [/shoot|doom|wolfenstein|battle|combat|fight|strike|warrior|gun|fps/i, ['action']],
  [/quest|adventure|rpg|story/i, ['adventure']],
  [/nes|snes|n64|sega|atari|arcade|classic/i, ['retro', 'arcade']],
];

function inferCategories(title) {
  const found = [];
  for (const [re, cats] of CATEGORY_KEYWORDS) {
    if (re.test(title)) found.push(...cats);
  }
  return [...new Set(found)];
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'in', 'of', 'or', 'the', 'vs', 'to', 'on', 'for']);

function prettifyName(filename) {
  let base = filename.replace(/\.html?$/i, '');
  base = base.replace(/^cl/i, ''); // strip legacy prefix
  base = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  base = base.replace(/[_\-]+/g, ' ');
  base = base.replace(/\s+/g, ' ').trim();
  if (!base) base = 'Unnamed';
  return base
    .split(' ')
    .map((w, i) =>
      SMALL_WORDS.has(w.toLowerCase()) && i > 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(' ');
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]{2,120}?)<\/title>/i);
  if (!m) return null;
  const t = m[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  if (/^(index|untitled|home|vite app|new page|document)$/i.test(t)) return null;
  return t;
}

// Junk filename patterns: "Foo copy.html", "Foo (1).html", "Foo copy 2.html",
// "foo.txt"-style stray files are excluded earlier (extension filter).
const isCopyName = (name) =>
  /(^|\s)copy\b/i.test(name.replace(/\.html?$/i, '')) ||
  /\(\d+\)\.html?$/i.test(name);

/** Collect all entries first, then resolve duplicates. */
const collected = [];

for (const { dir, mount, app } of SCAN_DIRS) {
  let files;
  try {
    files = await readdir(dir);
  } catch {
    continue; // directory may not exist yet
  }
  for (const file of files.sort()) {
    if (!/\.html?$/i.test(file)) continue;
    const full = path.join(dir, file);
    const content = await readFile(full, 'utf8').catch(() => '');
    const sha = createHash('sha256').update(content).digest('hex');
    const override = overrides[file] ?? {};
    const title = override.title ?? extractTitle(content) ?? prettifyName(file);
    collected.push({
      file,
      mount,
      sha,
      title,
      categories: override.categories ?? null,
      aliases: override.aliases ?? [],
      isApp: app || Boolean(override.isApp),
      hiddenByOverride: Boolean(override.hidden),
      description: override.description ?? null,
    });
  }
}

/** Byte-identical build detection: report a canonical sibling, but never hide
 * an entry. The owner reversed the duplicate-removal policy, so alternate
 * builds, copy-named files and identical hashes all remain visible. */
const bySha = new Map();
for (const entry of collected) {
  if (!bySha.has(entry.sha)) bySha.set(entry.sha, []);
  bySha.get(entry.sha).push(entry);
}

// Prefer non-"copy" names, then shorter names.
const quality = (e) => (isCopyName(e.file) ? 1 : 0) - e.file.length / 1000;

const out = [];
for (const group of bySha.values()) {
  const ranked = [...group].sort((a, b) => quality(a) - quality(b));
  const canonical = ranked[0];
  for (const e of group) {
    const duplicate = e !== canonical;
    out.push({
      file: e.file,
      path: `${e.mount}/${encodeURIComponent(e.file)}`,
      title: e.title,
      categories: e.categories ?? inferCategories(e.title),
      aliases: e.aliases,
      isApp: e.isApp,
      hidden: e.hiddenByOverride,
      duplicateOf: duplicate ? canonical.file : null,
      description: e.description,
    });
  }
}

out.sort((a, b) => a.title.localeCompare(b.title));

const header = `// AUTO-GENERATED by scripts/generate-catalog.mjs — do not edit by hand.
// Regenerated on every build. Curated titles/categories/aliases live in
// scripts/catalog-overrides.json.
// Every scanned game file appears here, including hidden entries, so the UI
// can show a meaningful empty state instead of silently dropping games.

export interface GeneratedEntry {
  file: string;
  path: string;
  title: string;
  categories: string[];
  aliases: string[];
  isApp: boolean;
  hidden: boolean;
  duplicateOf: string | null;
  description: string | null;
}

export const GENERATED_CATALOG: GeneratedEntry[] = `;

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, header + JSON.stringify(out, null, 2) + ';\n', 'utf8');

const visible = out.filter((e) => !e.hidden).length;
const dups = out.filter((e) => e.duplicateOf).length;
console.log(`[catalog] ${out.length} files scanned, ${visible} visible entries, ${dups} identical builds kept visible.`);
