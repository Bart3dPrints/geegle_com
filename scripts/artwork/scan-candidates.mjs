#!/usr/bin/env node
// Find artwork a game wrapper already ships for itself.
//
// Priority order from the mission: official icon, official logo, then existing
// game assets. Wrappers frequently carry an OpenGraph image or a logo file that
// belongs to the game itself, which is the most accurate thumbnail available
// without inventing anything. Writes scripts/artwork/candidates.json.
//
// Usage: node scripts/artwork/scan-candidates.mjs
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { catalogRoot, localFilename, readCatalogRows } from '../catalog-data.mjs';

const gamesDir = new URL('public/games/', catalogRoot);
const outFile = new URL('./candidates.json', import.meta.url);

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const LIKELY = /(logo|title|icon|banner|cover|splash|preview|thumb|favicon|screenshot|og[-_]?image)/i;

function absoluteLocal(raw, file) {
  if (!raw || /^(data:|blob:|javascript:)/i.test(raw)) return null;
  let value = raw.trim().replace(/^['"]|['"]$/g, '');
  if (/^https?:\/\//i.test(value)) return { remote: value };
  value = value.split('#')[0].split('?')[0];
  if (!value || value.startsWith('//')) return null;
  // Resolve relative to public/games/, which is how the wrapper is served.
  const base = new URL(`public/games/${file}`, catalogRoot);
  let resolved;
  try {
    resolved = new URL(value.replace(/^\//, ''), base);
  } catch {
    return null;
  }
  const root = new URL('public/', catalogRoot);
  if (!resolved.href.startsWith(root.href)) return null;
  const local = decodeURIComponent(resolved.pathname.slice(new URL(catalogRoot).pathname.length));
  if (!existsSync(new URL(local, catalogRoot))) return null;
  const stats = statSync(new URL(local, catalogRoot));
  if (!stats.isFile() || stats.size < 2048 || stats.size > 8 * 1024 * 1024) return null;
  return { local };
}

const entries = new Map();
for (const row of readCatalogRows()) {
  const file = localFilename(row.path);
  if (file && !entries.has(row.id)) entries.set(row.id, { row, file });
}

const candidates = {};
const stats = { games: entries.size, withCandidate: 0, remote: 0, local: 0 };

for (const [id, { file }] of entries) {
  const path = new URL(file, gamesDir);
  if (!path.href.startsWith(gamesDir.href)) continue;
  let html;
  try {
    html = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  const found = [];
  const push = (raw, kind) => {
    const resolved = absoluteLocal(raw, file);
    if (resolved) found.push({ kind, ...resolved });
  };

  for (const match of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|og:image:url|twitter:image)["'][^>]*>/gi)) {
    const content = match[0].match(/content=["']([^"']+)["']/i);
    if (content) push(content[1], 'official-og');
  }
  for (const match of html.matchAll(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi)) {
    const href = match[0].match(/href=["']([^"']+)["']/i);
    if (href) push(href[1], 'official-icon');
  }
  for (const match of html.matchAll(/(?:src|href|content)=["']([^"']+)["']/gi)) {
    const value = match[1];
    if (!IMAGE.test(value) || !LIKELY.test(value)) continue;
    push(value, 'game-asset');
  }

  // Prefer declared official imagery, then likely logos, then any asset.
  const rank = { 'official-og': 0, 'official-icon': 1, 'game-asset': 2 };
  found.sort((a, b) => rank[a.kind] - rank[b.kind]);
  const seen = new Set();
  const unique = found.filter((item) => {
    const key = item.local ?? item.remote;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) continue;

  candidates[id] = { title: entries.get(id).row.title, file, candidates: unique.slice(0, 4) };
  stats.withCandidate += 1;
  if (unique[0].remote) stats.remote += 1;
  else stats.local += 1;
}

mkdirSync(new URL('.', import.meta.url), { recursive: true });
writeFileSync(outFile, JSON.stringify({ generated: 'scripts/artwork/scan-candidates.mjs', stats, candidates }, null, 2));
console.log(JSON.stringify({ ...stats, uniqueGames: Object.keys(candidates).length }, null, 2));
