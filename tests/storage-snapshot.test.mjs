import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export { encodeValue, decodeValue } from './src/lib/storageSnapshot.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { encodeValue, decodeValue } = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);

const roundTrip = async (value) => decodeValue(await encodeValue(value));

test('primitives, dates and special numbers survive a round trip', async () => {
  for (const value of ['text', 0, -0, 42.5, Number.NaN, Infinity, -Infinity, true, false, null, undefined, 12n]) {
    const restored = await roundTrip(value);
    assert.deepEqual(restored, value);
    if (typeof value === 'number') assert.ok(Object.is(restored, value), `expected ${value} to round trip exactly`);
  }
  const date = new Date('2026-11-25T12:34:56.000Z');
  assert.equal((await roundTrip(date)).toISOString(), date.toISOString());
});

test('binary values keep their exact bytes and view type', async () => {
  const buffer = new Uint8Array([0, 1, 2, 250, 255]).buffer;
  assert.deepEqual(new Uint8Array(await roundTrip(buffer)), new Uint8Array(buffer));

  const typed = new Float32Array([1.5, -2.25, 0]);
  const restoredTyped = await roundTrip(typed);
  assert.ok(restoredTyped instanceof Float32Array);
  assert.deepEqual([...restoredTyped], [...typed]);

  const view = new DataView(new Uint8Array([9, 8, 7]).buffer);
  const restoredView = await roundTrip(view);
  assert.ok(restoredView instanceof DataView);
  assert.deepEqual([...new Uint8Array(restoredView.buffer)], [9, 8, 7]);
});

test('Blobs keep their bytes and MIME type', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' });
  const restored = await roundTrip(blob);
  assert.ok(restored instanceof Blob);
  assert.equal(restored.type, 'application/octet-stream');
  assert.deepEqual([...new Uint8Array(await restored.arrayBuffer())], [1, 2, 3, 4]);
});

test('nested records, maps and sets round trip without losing structure', async () => {
  const value = {
    inventory: [{ id: 'sword', count: 2 }, { id: 'shield', count: 1 }],
    flags: { hardMode: false },
    scores: new Map([['level1', 120]]),
    tags: new Set(['a', 'b']),
    nested: { buffer: new Uint16Array([7, 8]) },
  };
  const restored = await roundTrip(value);
  assert.deepEqual(restored.inventory, value.inventory);
  assert.equal(restored.scores.get('level1'), 120);
  assert.deepEqual([...restored.tags], ['a', 'b']);
  assert.deepEqual([...restored.nested.buffer], [7, 8]);
});

test('unserializable values are rejected instead of silently lost', async () => {
  class Custom { constructor() { this.value = 1; } }
  await assert.rejects(encodeValue(new Custom()), /Cannot store/);
  await assert.rejects(encodeValue(() => 1), /Cannot store/);
  const circular = {};
  circular.self = circular;
  await assert.rejects(encodeValue(circular), /circular/);
});
