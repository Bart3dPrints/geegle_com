// The save-support manifest must not claim more than the project has evidence
// for. These tests fail if an injectable wrapper is ever described as verified,
// or if a game with no detected storage mechanism is described as automatically
// supported.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/lib/saveManifest.ts';" +
      "export { CROSS_ORIGIN_GAMES, OVERSIZE_GAMES, INJECTABLE_GAMES, ENGINE_BY_GAME } from './src/data/saveCoverage.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});

const {
  saveSupportFor,
  supportLabel,
  attemptsAutomaticSave,
  VERIFIED_GAMES,
  CROSS_ORIGIN_GAMES,
  OVERSIZE_GAMES,
  INJECTABLE_GAMES,
  ENGINE_BY_GAME,
} = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);

const entry = (id, kind) => ({ id, path: `/games/${id}.html`, kind });

test('a game is only "verified" when it is in the recorded evidence list', () => {
  for (const id of VERIFIED_GAMES) {
    assert.equal(saveSupportFor(entry(id)), 'verified', `${id} should be verified`);
  }
});

// cl2048 shipped without any persistence: its wrapper loads every script from a
// CDN and includes no storage manager. It must never be advertised as verified
// again on the strength of a key the test wrote itself.
test('2048 is not advertised as individually verified', () => {
  assert.equal(VERIFIED_GAMES.has('cl2048'), false);
  assert.notEqual(saveSupportFor(entry('cl2048')), 'verified');
});

test('an injectable game with a detected mechanism is engine-compatible, not verified', () => {
  const id = Object.keys(ENGINE_BY_GAME).find((gameId) => !VERIFIED_GAMES.has(gameId));
  assert.ok(id, 'expected at least one engine-detected game');
  const support = saveSupportFor(entry(id));
  assert.equal(support, 'engine-compatible');
  assert.match(supportLabel(support, entry(id)), /not individually played/);
});

test('an injectable game with no detected mechanism is experimental, never automatic', () => {
  const id = [...INJECTABLE_GAMES].find(
    (gameId) =>
      !VERIFIED_GAMES.has(gameId) &&
      !CROSS_ORIGIN_GAMES.has(gameId) &&
      !OVERSIZE_GAMES.has(gameId) &&
      !Object.prototype.hasOwnProperty.call(ENGINE_BY_GAME, gameId),
  );
  assert.ok(id, 'expected at least one injectable game without a detected mechanism');
  const support = saveSupportFor(entry(id));
  assert.equal(support, 'injectable');
  assert.doesNotMatch(supportLabel(support, entry(id)), /automatic/i);
  assert.match(supportLabel(support, entry(id)), /not verified/i);
});

test('cross-origin, oversize, external and unknown games make no save claim', () => {
  const crossOrigin = [...CROSS_ORIGIN_GAMES][0];
  const oversize = [...OVERSIZE_GAMES][0];
  assert.equal(saveSupportFor(entry(crossOrigin)), 'external-service');
  assert.equal(saveSupportFor(entry(oversize)), 'unsupported');
  assert.equal(saveSupportFor(entry('cl2048', 'proxy')), 'external-service');
  assert.equal(saveSupportFor(entry('cl2048', 'stream')), 'external-service');
  assert.equal(saveSupportFor(entry('clnotarealgame')), 'unsupported');
  assert.equal(saveSupportFor({ id: 'clexternal', path: 'https://example.com/game' }), 'unsupported');
});

test('automatic capture is attempted for unverified injectable games, reported honestly', () => {
  assert.equal(attemptsAutomaticSave('verified'), true);
  assert.equal(attemptsAutomaticSave('engine-compatible'), true);
  assert.equal(attemptsAutomaticSave('injectable'), true);
  assert.equal(attemptsAutomaticSave('manual'), false);
  assert.equal(attemptsAutomaticSave('unsupported'), false);
  assert.equal(attemptsAutomaticSave('external-service'), false);
  // Every label is distinct so no two evidence levels look the same in the UI.
  const labels = ['verified', 'engine-compatible', 'injectable', 'manual', 'unsupported', 'external-service'].map(
    (support) => supportLabel(support),
  );
  assert.equal(new Set(labels).size, labels.length);
});

test('no injectable game outside the evidence list is reported as verified', () => {
  let verified = 0;
  for (const id of INJECTABLE_GAMES) {
    if (saveSupportFor(entry(id)) === 'verified') verified += 1;
  }
  assert.equal(verified, [...VERIFIED_GAMES].filter((id) => INJECTABLE_GAMES.has(id)).length);
});
