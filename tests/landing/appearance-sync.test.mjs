import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APPEARANCE, confirmAppearanceSync, readAppearance, writeAppearance } from '../../src/landing/appearance.ts';

function device() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), clear: () => values.clear() };
}
const A = {...DEFAULT_APPEARANCE, color:'#123abc'};
const B = {...DEFAULT_APPEARANCE, mode:'dark'};

test('a synced device adopts another device’s published change, including after storage loss', () => {
  const one = device(), two = device();
  globalThis.localStorage = one;
  confirmAppearanceSync('owner', writeAppearance(A, 'owner'));
  globalThis.localStorage = two;
  assert.deepEqual(readAppearance('owner', A), A);
  confirmAppearanceSync('owner', writeAppearance(B, 'owner'));
  globalThis.localStorage = one;
  assert.deepEqual(readAppearance('owner', B), B);
  assert.deepEqual(readAppearance('owner', undefined), A, 'unavailable server permits offline cache');
  assert.deepEqual(readAppearance('owner', null), DEFAULT_APPEARANCE, 'confirmed remote removal wins');
  one.clear();
  assert.deepEqual(readAppearance('owner', B), B);
});

test('local-only or failed edits survive remote changes; late confirmation cannot clear a newer edit', () => {
  globalThis.localStorage = device();
  const upload = writeAppearance(A, 'owner');
  writeAppearance(B, 'owner');
  confirmAppearanceSync('owner', upload);
  assert.deepEqual(readAppearance('owner', A), B);
  assert.deepEqual(readAppearance('other', null), DEFAULT_APPEARANCE);
});

test('legacy unmarked cache remains local-only until explicitly synced', () => {
  globalThis.localStorage = device();
  globalThis.localStorage.setItem('geegle-landing-appearance:v1:account:owner', JSON.stringify(A));
  assert.deepEqual(readAppearance('owner', B), A);
  confirmAppearanceSync('owner', writeAppearance(A, 'owner'));
  assert.deepEqual(readAppearance('owner', B), B);
});
