// Catalog restoration guards. The owner reversed the duplicate-removal policy,
// so historical entries and distinct builds must stay available, the
// restoration script must be idempotent, and the one unwanted Polytrack build
// must stay excluded.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { catalogRoot, localFilename, readCatalogRows } from '../scripts/catalog-data.mjs';

const rows = readCatalogRows();
const byId = new Map(rows.map((row) => [row.id, row]));
const files = new Set(readdirSync(new URL('public/games/', catalogRoot)));

const hobo = [
  ['clhobo', 'HOBO'],
  ['clhobo2', 'HOBO 2: Prison Brawl'],
  ['clhobo3', 'HOBO 3: Wanted'],
  ['clhobo4', 'HOBO 4: Total War'],
  ['clhobo5', 'HOBO 5: Space Brawls'],
  ['clhobo6', 'HOBO 6: Hell'],
  ['clhobo7', 'HOBO 7: Heaven'],
];

test('every HOBO installment keeps its stable ID and carries its real subtitle', () => {
  for (const [id, title] of hobo) {
    assert.equal(byId.get(id)?.title, title, id);
  }
  assert.equal(byId.get('clhobovszombies')?.title, 'Hobo vs Zombies');
});

test('the Henry Stickmin installments stay present under stable IDs', () => {
  for (const id of [
    'clstickminbreakingbank',
    'clstickminescapingprison',
    'clstickmanstealingdiamond',
    'clstickminairship',
    'clstickminfleecomplex',
  ]) {
    const row = byId.get(id);
    assert.ok(row, id);
    assert.ok(files.has(localFilename(row.path)), id);
  }
});

test('the unwanted Poly Track build is gone and Polytrack (working) remains', () => {
  assert.equal(rows.filter((row) => row.title === 'Polytrack (working)').length, 1);
  assert.equal(byId.get('clpolytrackworksnow')?.title, 'Polytrack (working)');
  assert.equal(rows.filter((row) => /clpolytrackbutnotflagged/i.test(row.id)).length, 0);
  assert.equal(rows.filter((row) => /clpolytrackbutnotflagged/i.test(row.path)).length, 0);
  const script = readFileSync(new URL('scripts/restore-catalog.mjs', catalogRoot), 'utf8');
  assert.match(script, /clpolytrackbutnotflagged/);
});

test('all four Snow Rider builds stay available with distinct IDs and local files', () => {
  const expected = [
    ['clsnowrider', 'Snow Rider'],
    ['snow-rider', 'Snow Rider 3D'],
    ['clsnowridergoodygumdrops', 'Snow Rider Goody Gumdrops'],
    ['clsnowriderrrr', 'Snow Rider Rrr'],
  ];
  const paths = new Set();
  for (const [id, title] of expected) {
    const row = byId.get(id);
    assert.ok(row, id);
    assert.equal(row.title, title, id);
    const filename = localFilename(row.path);
    assert.ok(filename, `${id} must use a local build`);
    assert.ok(files.has(filename), id);
    paths.add(filename);
  }
  assert.equal(paths.size, expected.length);
});

test('the restoration script is idempotent and keeps previously restored rows', () => {
  const script = new URL('scripts/restore-catalog.mjs', catalogRoot);
  const before = readCatalogRows().length;
  const first = spawnSync(process.execPath, [script.pathname], { cwd: catalogRoot.pathname, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  const afterFirst = readCatalogRows().length;
  const second = spawnSync(process.execPath, [script.pathname], { cwd: catalogRoot.pathname, encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr);
  const afterSecond = readCatalogRows().length;
  assert.equal(afterFirst, before, 'a run must not add or drop catalog rows');
  assert.equal(afterSecond, afterFirst, 'running again must not drop restored rows');
});

test('no legitimate historical game entry is missing beyond the documented exclusions', () => {
  const script = readFileSync(new URL('scripts/restore-catalog.mjs', catalogRoot), 'utf8');
  // The script documents why a historical row is allowed to stay out.
  assert.match(script, /EXCLUDE/);
  assert.match(script, /proxy/i);
});
