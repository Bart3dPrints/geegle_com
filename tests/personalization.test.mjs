// Personalization guards: defaults stay neutral, invalid records fall back,
// custom colours keep readable text, wallpapers are validated, and Settings has
// one fixed window size with the required sections and resets.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

async function load(entry) {
  const { outputFiles: [{ text }] } = await build({
    stdin: { resolveDir: process.cwd(), contents: entry },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}

const personalization = await load("export * from './src/lib/personalization.ts';");
const userData = await load("export { parseAppearanceSettings, DEFAULT_APPEARANCE_SETTINGS } from './src/lib/userData.ts';");

test('the default personalization is the current neutral appearance', () => {
  assert.deepEqual(personalization.DEFAULT_PERSONALIZATION, {
    accent: null,
    font: 'default',
    fontColor: null,
    wallpaper: null,
    clock: false,
    date: false,
  });
});

test('invalid stored values never become an applied preference', () => {
  const parsed = personalization.parsePersonalization({
    accent: 'not-a-colour',
    font: 'comic',
    fontColor: '#12',
    wallpaper: 'javascript:alert(1)',
    clock: 'yes',
    date: 1,
  });
  assert.deepEqual(parsed, personalization.DEFAULT_PERSONALIZATION);
});

test('valid values round-trip and unknown keys are dropped', () => {
  const parsed = personalization.parsePersonalization({
    accent: '#15803d',
    font: 'serif',
    fontColor: '#222222',
    clock: true,
    date: false,
    unexpected: 'x',
  });
  assert.equal(parsed.accent, '#15803d');
  assert.equal(parsed.font, 'serif');
  assert.equal(parsed.fontColor, '#222222');
  assert.equal(parsed.clock, true);
  assert.equal(parsed.date, false);
  assert.deepEqual(Object.keys(parsed).sort(), ['accent', 'clock', 'date', 'font', 'fontColor', 'wallpaper']);
});

test('accent text switches to stay readable', () => {
  assert.equal(personalization.contrastText('#171717'), '#ffffff');
  assert.equal(personalization.contrastText('#1d4ed8'), '#ffffff');
  assert.equal(personalization.contrastText('#f5f5f5'), '#111111');
  assert.equal(personalization.contrastText('#fde047'), '#111111');
  assert.equal(personalization.contrastText('nonsense'), '#ffffff');
});

test('every font option resolves to a self-hosted or system stack', () => {
  for (const option of personalization.FONT_OPTIONS) {
    assert.ok(option.stack.length > 5, option.key);
    assert.ok(!/https?:/.test(option.stack), `${option.key} adds no network dependency`);
  }
  assert.equal(personalization.fontStack('mono'), personalization.FONT_OPTIONS[3].stack);
  assert.equal(personalization.fontStack('missing'), personalization.FONT_OPTIONS[0].stack);
});

test('wallpaper files are type and size checked before decoding', () => {
  assert.equal(personalization.wallpaperFileProblem(null), 'Choose an image first.');
  assert.match(personalization.wallpaperFileProblem({ type: 'image/svg+xml', size: 100 }), /PNG, JPEG or WebP/);
  assert.match(personalization.wallpaperFileProblem({ type: 'image/png', size: 0 }), /empty/);
  assert.match(personalization.wallpaperFileProblem({ type: 'image/png', size: 9 * 1024 * 1024 }), /8 MB/);
  assert.equal(personalization.wallpaperFileProblem({ type: 'image/png', size: 2048 }), null);
});

test('only raster data URLs are accepted as a stored wallpaper', () => {
  assert.equal(personalization.isWallpaperDataUrl('data:image/webp;base64,UklGRg=='), true);
  assert.equal(personalization.isWallpaperDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(personalization.isWallpaperDataUrl('data:text/html;base64,PHNjcmlwdD4='), false);
  assert.equal(personalization.isWallpaperDataUrl('https://example.com/a.webp'), false);
  assert.equal(personalization.isWallpaperDataUrl(null), false);
});

test('the stored appearance keeps every personalization field', () => {
  const parsed = userData.parseAppearanceSettings({
    mode: 'dark',
    background: '#ffffff',
    card: '#000000',
    accent: '#be123c',
    font: 'poppins',
    fontColor: '#005500',
    clock: true,
    date: true,
  });
  assert.equal(parsed.mode, 'dark');
  assert.equal(parsed.background, '#ffffff');
  assert.equal(parsed.card, '#000000');
  assert.equal(parsed.accent, '#be123c');
  assert.equal(parsed.font, 'poppins');
  assert.equal(parsed.fontColor, '#005500');
  assert.equal(parsed.clock, true);
  assert.equal(parsed.date, true);
  assert.equal(userData.DEFAULT_APPEARANCE_SETTINGS.accent, null);
});

const settings = readFileSync('src/components/Settings.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

test('the Settings window keeps one external size and scrolls internally', () => {
  assert.match(settings, /height:\s*'min\(640px, calc\(100vh - 2rem\)\)'/);
  assert.match(settings, /overflow-hidden/);
  assert.match(settings, /min-h-0 min-w-0 flex-1 overflow-y-auto/);
  assert.ok(!/max-h-\[calc\(100vh-2rem\)\][^"]*overflow-y-auto p-6/.test(settings), 'no content-sized window');
});

test('Settings has Theme, Appearance, Preferences, Tab appearance and a final Changelog', () => {
  const tabs = settings.slice(settings.indexOf('const TABS = ['), settings.indexOf('] as const'));
  const labels = [...tabs.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(labels, ['Theme', 'Appearance', 'Preferences', 'Tab appearance', 'Changelog']);
});

test('personalization groups are individually resettable and resettable together', () => {
  for (const field of ['accent', 'font', 'wallpaper', 'clock', 'date', 'background']) {
    assert.ok(new RegExp(`${field}:`).test(settings), `a control exists for ${field}`);
  }
  const resets = settings.match(/resetLabel=/g) ?? [];
  assert.ok(resets.length >= 5, `only ${resets.length} group resets`);
  assert.match(settings, /Reset all personalization/);
  assert.match(settings, /queue\(\{ \.\.\.DEFAULT_APPEARANCE_SETTINGS \}\)/);
  assert.ok(!/favorites|cloud save|sign out.*reset/i.test(settings.slice(settings.indexOf('resetAll'), settings.indexOf('return ('))), 'resetting appearance does not touch saved data');
});

test('wallpaper upload validates before storing and offers removal', () => {
  assert.match(settings, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(settings, /prepareWallpaper/);
  assert.match(settings, /applyDraft\(\{ wallpaper: null \}\)/);
});

test('settings changes are saved without a success toast', () => {
  assert.ok(!/Appearance saved/.test(settings), 'no routine success notification');
  assert.match(settings, /Could not save your appearance/);
  assert.match(settings, /setTimeout\(\(\) => void persist\(next\), 600\)/, 'saves are batched');
});

test('the account dropdown offers Preferences above Sign out', () => {
  const start = app.indexOf('role="menu"');
  const block = app.slice(start, app.indexOf('</motion.div>', start));
  const items = block.match(/role="menuitem"/g) ?? [];
  assert.equal(items.length, 2);
  const preferences = block.indexOf('Preferences');
  const signOut = block.indexOf('Sign out');
  assert.ok(preferences > 0 && signOut > preferences, 'Preferences comes first');
  assert.match(block, /setSettingsTab\('preferences'\)/);
});
