#!/usr/bin/env node
// Exact paths and wrapper bytes are evidence. Matching titles or asset URLs
// are review candidates and never establish that two entries are the same game.
import { createHash } from 'node:crypto';
import { open, readdir, readFile, stat } from 'node:fs/promises';
import { catalogRoot as root, localFilename, readCatalogRows } from './catalog-data.mjs';

function add(collection, key, value) {
  const list = collection.get(key) ?? [];
  list.push(value);
  collection.set(key, list);
}

function multiples(collection) {
  return [...collection].filter(([, entries]) => entries.length > 1);
}

function titleKey(title) {
  return title.normalize('NFKD').toLowerCase().replace(/\p{M}|[^\p{L}\p{N}]/gu, '');
}

function referencedAssets(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, '');
  const assets = new Set();
  for (const matched of source.matchAll(/https:\/\/[^"'\x60\s<>]+\.(?:swf|chd|gba|gbc|nes|sfc|nds|z64|zip|7z)(?=["'\x60\s<])/gi)) {
    assets.add(matched[0]);
  }
  const base = source.match(/<base\s+href=["'](https:\/\/[^"']+)["']/i)?.[1];
  // Generic CDN repository roots may serve multiple unrelated games.
  if (base && /\/gh\/[^/]+\/[^/]+\/[^/]/.test(base)) assets.add(base);
  return [...assets].sort();
}

const gamesDir = new URL('public/games/', root);
const existing = new Set((await readdir(gamesDir, { withFileTypes: true }))
  .filter(entry => entry.isFile()).map(entry => entry.name));
const firstById = new Map();
for (const row of readCatalogRows()) if (!firstById.has(row.id)) firstById.set(row.id, row);

const byPath = new Map();
const byTitle = new Map();
const byFilename = new Map();
for (const entry of firstById.values()) {
  add(byPath, entry.path, entry.id);
  add(byTitle, titleKey(entry.title), entry.id);
  const file = localFilename(entry.path);
  if (file && existing.has(file)) add(byFilename, file, entry.id);
}

const bySize = new Map();
const byAssets = new Map();
const fileUrls = new Map();
for (const [filename, ids] of byFilename) {
  const file = new URL(encodeURIComponent(filename), gamesDir);
  fileUrls.set(filename, file);
  add(bySize, (await stat(file)).size, filename);
  const handle = await open(file);
  const head = Buffer.alloc(196608);
  let bytesRead;
  try {
    ({ bytesRead } = await handle.read(head, 0, head.length));
  } finally {
    await handle.close();
  }
  const fingerprint = referencedAssets(head.subarray(0, bytesRead).toString());
  if (fingerprint.length) add(byAssets, JSON.stringify(fingerprint), { filename, ids });
}

const byHash = new Map();
for (const [, files] of multiples(bySize)) {
  for (const filename of files) {
    const bytes = await readFile(fileUrls.get(filename));
    const sha = createHash('sha256').update(bytes).digest('hex');
    add(byHash, sha, { filename, ids: byFilename.get(filename) });
  }
}
const byteMatches = multiples(byHash);
const pathMatches = multiples(byPath);
const titleMatches = multiples(byTitle);
const assetMatches = multiples(byAssets);
const summary = {
  catalogIds: firstById.size,
  distinctLaunchPaths: byPath.size,
  distinctExistingLocalPaths: byFilename.size,
  distinctLocalWrapperBytes: byFilename.size - byteMatches.reduce((total, [, files]) => total + files.length - 1, 0),
  samePathGroups: pathMatches.length,
  identicalLocalWrapperGroups: byteMatches.length,
  similarTitleReviewGroups: titleMatches.length,
  sharedAssetReferenceReviewGroups: assetMatches.length,
};

console.log(JSON.stringify(process.argv.includes('--summary') ? summary : {
  ...summary,
  samePath: Object.fromEntries(pathMatches),
  identicalLocalWrappers: Object.fromEntries(byteMatches),
  similarTitleCandidates: Object.fromEntries(titleMatches),
  sharedAssetReferenceCandidates: assetMatches.map(([key, files]) => ({
    assets: JSON.parse(key).map(url => {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    }),
    files,
  })),
}, null, 2));
