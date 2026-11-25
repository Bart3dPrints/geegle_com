import { readdirSync, readFileSync } from 'node:fs';

export const catalogRoot = new URL('../', import.meta.url);
const rawDir = new URL('src/data/raw/', catalogRoot);
const exceptionsFile = 'path-exceptions.txt';

function readRows(file) {
  return readFileSync(new URL(file, rawDir), 'utf8').split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('|'));
}

export function readCatalogRows() {
  const exceptions = new Map(readRows(exceptionsFile));
  return readdirSync(rawDir).sort()
    .filter(file => file.endsWith('.txt') && file !== exceptionsFile)
    .flatMap(readRows)
    .filter(([id, title, categories]) => id && title && categories)
    .map(([id, title, categories]) => ({
      id, title, categories,
      path: exceptions.get(id) ?? `/games/${encodeURIComponent(id)}.html`,
    }));
}

export function localFilename(path) {
  if (!path.startsWith('/games/')) return null;
  const name = decodeURIComponent(new URL(path, 'https://geegle.invalid').pathname.slice('/games/'.length));
  return name && !name.includes('/') && !name.includes('\\') ? name : null;
}
