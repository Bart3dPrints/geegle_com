import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  DEFAULT_APPEARANCE,
  PRESETS,
  compressBackground,
  darkInk,
  parseAppearance,
  readCachedAppearance,
  readAppearance,
  writeAppearance,
} from '../src/landing/appearance.ts';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

describe('landing appearance parsing', () => {
  it('accepts a valid value and returns only the versioned fields', () => {
    assert.deepEqual(parseAppearance({ ...DEFAULT_APPEARANCE, mode: 'dark', color: '#123456', extra: true }), {
      version: 1,
      mode: 'dark',
      color: '#123456',
      image: null,
    });
  });

  it('rejects malformed versions, modes, and values', () => {
    for (const value of [
      null,
      [],
      {},
      { ...DEFAULT_APPEARANCE, version: 2 },
      { ...DEFAULT_APPEARANCE, mode: 'sepia' },
      { ...DEFAULT_APPEARANCE, color: 5 },
      { ...DEFAULT_APPEARANCE, color: '#abc' },
      { ...DEFAULT_APPEARANCE, color: 'red' },
      { ...DEFAULT_APPEARANCE, color: 'url(https://example.com)' },
      { ...DEFAULT_APPEARANCE, image: 'https://example.com/image.webp' },
      { ...DEFAULT_APPEARANCE, image: 'url(https://example.com)' },
      { ...DEFAULT_APPEARANCE, image: 'data:image/png;base64,iVBORw0KGgo=' },
      { ...DEFAULT_APPEARANCE, image: 'data:image/webp;base64,not base64' },
      { ...DEFAULT_APPEARANCE, image: 'data:image/jpeg;base64,UklGRg==' },
      { ...DEFAULT_APPEARANCE, image: 'data:image/webp;base64,UklG' },
      { ...DEFAULT_APPEARANCE, image: `data:image/webp;base64,UklGR${'A'.repeat(1_000_001)}` },
    ]) {
      assert.equal(parseAppearance(value), null);
    }
  });

  it('accepts bounded WebP and JPEG data URIs produced by the image compressor', () => {
    assert.notEqual(parseAppearance({ ...DEFAULT_APPEARANCE, color: '#aB12fF', image: 'data:image/webp;base64,UklGRg==' }), null);
    assert.notEqual(parseAppearance({ ...DEFAULT_APPEARANCE, image: 'data:image/jpeg;base64,/9j/AA==' }), null);
  });

  it('exposes immutable preset data', () => {
    // Neutral presets only: authored UI must have R=G=B.
    assert.deepEqual(PRESETS.map(({ name }) => name), [
      'White',
      'Off white',
      'Light gray',
      'Gray',
      'Charcoal',
      'Near black',
    ]);
    for (const { color } of PRESETS) {
      const channels = color.slice(1).match(/../g);
      assert.equal(new Set(channels.map((channel) => channel.toLowerCase())).size, 1, `${color} is neutral`);
    }
    assert.ok(PRESETS.every(({ name, color }) => typeof name === 'string' && /^#[\da-f]{6}$/i.test(color)));
    assert.equal(Object.isFrozen(PRESETS), true);
    assert.ok(PRESETS.every(Object.isFrozen));
  });
});

describe('landing appearance storage', () => {
  it('uses separate guest and per-account keys', () => {
    const entries = new Map();
    globalThis.localStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    };
    const guest = { ...DEFAULT_APPEARANCE, mode: 'light' };
    const account = { ...DEFAULT_APPEARANCE, mode: 'dark' };

    writeAppearance(guest);
    writeAppearance(account, 'user/one');
    assert.deepEqual(readAppearance(), guest);
    assert.deepEqual(readAppearance('user/one'), account);
    assert.equal(entries.size, 2);
  });

  it('distinguishes a missing cache from the default appearance', () => {
    const entries = new Map();
    globalThis.localStorage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    };
    assert.equal(readCachedAppearance(), null);
    assert.deepEqual(readAppearance(), DEFAULT_APPEARANCE);
    writeAppearance({ ...DEFAULT_APPEARANCE, color: '#123456' });
    assert.deepEqual(readCachedAppearance(), { ...DEFAULT_APPEARANCE, color: '#123456' });
  });

  it('returns the default for invalid stored data and throws when writes are unavailable', () => {
    globalThis.localStorage = {
      getItem: () => '{not json',
      setItem: () => { throw new Error('quota'); },
    };
    assert.deepEqual(readAppearance(), DEFAULT_APPEARANCE);
    assert.throws(() => writeAppearance(DEFAULT_APPEARANCE), /Unable to save/);
    delete globalThis.localStorage;
    assert.throws(() => writeAppearance(DEFAULT_APPEARANCE), /Unable to save/);
  });
});

describe('appearance color and image helpers', () => {
  it('chooses dark ink based on relative luminance', () => {
    assert.equal(darkInk('#fff'), true);
    assert.equal(darkInk('#000000'), false);
    assert.equal(darkInk('rgb(255, 255, 255)'), true);
    assert.equal(darkInk('rgba(0, 0, 0, 0.5)'), false);
    assert.equal(darkInk('not a color'), false);
  });

  it('rejects unsafe image types, oversized files, and excessive pixel dimensions before decoding', async () => {
    await assert.rejects(compressBackground(new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' })), /JPEG, PNG, or WebP/);
    await assert.rejects(compressBackground(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })), /10 MB/);

    const header = new Uint8Array(24);
    header.set([0x89, 0x50, 0x4e, 0x47], 0);
    header.set([0x49, 0x48, 0x44, 0x52], 12);
    new DataView(header.buffer).setUint32(16, 8000);
    new DataView(header.buffer).setUint32(20, 8000);
    const originalDecode = globalThis.createImageBitmap;
    globalThis.createImageBitmap = () => { throw new Error('decode should not run'); };
    try {
      await assert.rejects(compressBackground(new File([header], 'large.png', { type: 'image/png' })), /dimensions are too large/);
    } finally {
      if (originalDecode) globalThis.createImageBitmap = originalDecode;
      else delete globalThis.createImageBitmap;
    }
  });
});
