import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { catalogRoot, localFilename, readCatalogRows } from '../scripts/catalog-data.mjs';
import { KRILLION_BACKUP } from '../src/data/external.ts';

const rows = readCatalogRows();
const byId = new Map(rows.map(row => [row.id, row]));
const files = new Set(readdirSync(new URL('public/games/', catalogRoot)));
const unresolvedIds = new Set([
  'clkengriffeyjr',
  'clu-can-t-believe',
  'clgdwaveover100mb',
  'clprecisionclient',
  'clundertale-gameboy-1',
]);

test('catalog IDs are unique and local launch paths resolve by exact on-disk name', () => {
  assert.equal(byId.size, rows.length);
  for (const row of rows) {
    const filename = localFilename(row.path);
    if (!filename) {
      assert.equal(new URL(row.path).protocol, 'https:', row.id);
      continue;
    }
    if (!unresolvedIds.has(row.id)) assert.ok(files.has(filename), row.id);
  }
  assert.equal(localFilename(byId.get('clcartoonnetworktabletennis').path),
    'clCartoonNetworkTableTennisUltimateTournament.html');
});

test('previously misdirected series have distinct source evidence', () => {
  assert.equal(byId.get('clbridgerace').path, 'https://www.crazygames.com/game/bridge-race');
  assert.equal(byId.get('clcrossyroad').path, '/games/clcrossyroad.html');
  assert.equal(byId.get('clcrashbandicoot2').title, 'Crash Bandicoot: The Huge Adventure');
  for (const pack of [4, 5]) {
    const row = byId.get('clbloonspp' + pack);
    const html = readFileSync(new URL('public' + row.path, catalogRoot), 'utf8');
    assert.match(html, new RegExp('player\\.load\\("https://[^\"]+/bloonspp' + pack + '\\.swf"\\);'));
    assert.doesNotMatch(html, /player\.load\("\$1"\)|\/bloons\.swf/);
  }
  assert.equal(rows.filter(row => /^polytrack\b/i.test(row.title)).length, 1);
  assert.equal(byId.get('clpolytrackworksnow').title, 'Polytrack (working)');
  assert.equal(byId.get('snow-rider').path, 'https://gamebiz.com/game/snow-rider-3d');
  assert.equal(byId.get('clsnowrider').path, 'https://gamebiz.com/game/snow-rider-3d-nostalgia');
});

test('the Krillion Backup card uses the same ID and path across Games and Apps', () => {
  const game = byId.get(KRILLION_BACKUP.id);
  assert.ok(game);
  assert.equal(game.path, KRILLION_BACKUP.path);
  assert.equal(rows.filter(row => row.path === KRILLION_BACKUP.path).length, 1);
});
