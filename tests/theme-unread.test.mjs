// Unread totals drive the Chat tab badge, and theme presets drive every
// authored surface. Both are pure functions, so the rules from the brief are
// pinned here: public unread never adds to the number, numbers cap at 99+, and
// every preset carries a complete, readable palette with distinct surfaces.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

async function load(entry) {
  const {
    outputFiles: [{ text }],
  } = await build({
    stdin: { resolveDir: process.cwd(), contents: entry },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}

const chat = await load("export * from './src/lib/chat.ts';");
const palette = await load("export * from './src/theme/palette.ts';");
const apply = await load("export * from './src/theme/apply.ts';");

function conversation(kind, unread) {
  return { id: `${kind}-${unread}`, kind, unread };
}

test('public unread alone uses a dot, never a number', () => {
  assert.deepEqual(chat.summarizeUnread([conversation('public', 14)]), {
    publicUnread: 14,
    privateUnread: 0,
  });
  assert.equal(chat.unreadBadge(chat.summarizeUnread([conversation('public', 14)]).privateUnread), null);
});

test('private and group unread combine and ignore public messages', () => {
  const summary = chat.summarizeUnread([
    conversation('public', 20),
    conversation('dm', 3),
    conversation('group', 8),
  ]);
  assert.equal(summary.publicUnread, 20);
  assert.equal(summary.privateUnread, 11);
  assert.equal(chat.unreadBadge(summary.privateUnread), '11');
});

test('the numeric badge wins over the dot when both kinds are unread', () => {
  const summary = chat.summarizeUnread([conversation('public', 4), conversation('dm', 2)]);
  assert.equal(chat.unreadBadge(summary.privateUnread), '2');
});

test('counts above ninety-nine display as 99+', () => {
  assert.equal(chat.unreadBadge(99), '99');
  assert.equal(chat.unreadBadge(100), '99+');
  assert.equal(chat.unreadBadge(4321), '99+');
  assert.equal(chat.unreadBadge(0), null);
});

test('summaries never go negative on malformed rows', () => {
  const summary = chat.summarizeUnread([{ id: 'x', kind: 'dm', unread: -5 }]);
  assert.equal(summary.privateUnread, 0);
});

test('every preset is a complete palette with hierarchy', () => {
  assert.ok(palette.THEME_PRESETS.length >= 20, `only ${palette.THEME_PRESETS.length} presets`);
  const families = palette.THEME_PRESETS.map((preset) => preset.id);
  for (const required of ['neutral', 'white', 'black', 'gray', 'sky', 'blue', 'red', 'green', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'teal', 'indigo', 'navy', 'brown', 'beige']) {
    assert.ok(families.includes(required), `missing preset ${required}`);
  }
  const keys = [
    'header', 'bg', 'card', 'elevated', 'border', 'text', 'muted', 'accent', 'accentInk',
    'hover', 'selected', 'chat', 'bubbleOut', 'bubbleOutInk', 'bubbleIn', 'bubbleInInk',
    'scrim', 'neutral',
  ];
  for (const preset of palette.THEME_PRESETS) {
    const colors = palette.resolveTheme(preset.id, false);
    for (const key of keys) assert.ok(colors[key], `${preset.id} is missing ${key}`);
    assert.notEqual(colors.header, colors.bg, `${preset.id} header equals background`);
    assert.notEqual(colors.card, colors.bg, `${preset.id} cards equal background`);
    assert.notEqual(colors.chat, colors.bg, `${preset.id} chat equals background`);
    const stops = Object.keys(colors.neutral);
    assert.equal(stops.length, 11, `${preset.id} neutral ramp is incomplete`);
  }
});

test('text keeps a readable contrast against every surface it sits on', () => {
  const channels = (color) => {
    if (color.startsWith('hsl')) {
      const [h, s, l] = color
        .slice(color.indexOf('(') + 1, color.lastIndexOf(')'))
        .split(/\s+/)
        .map((part) => parseFloat(part));
      const sat = s / 100;
      const light = l / 100;
      const c = (1 - Math.abs(2 * light - 1)) * sat;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = light - c / 2;
      const table = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
      return table[Math.floor(h / 60) % 6].map((v) => v + m);
    }
    const value = color.replace('#', '');
    const full = value.length === 3 ? value.split('').map((ch) => ch + ch).join('') : value;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  };
  const luminance = (color) =>
    channels(color)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  for (const theme of ['light', 'dark']) {
    for (const preset of palette.THEME_PRESETS) {
      const colors = palette.resolveTheme(preset.id, theme === 'dark');
      for (const [name, surface] of [
        ['bg', colors.bg],
        ['card', colors.card],
        ['header', colors.header],
        ['chat', colors.chat],
      ]) {
        const readable = Math.max(ratio(colors.text, surface), ratio(`hsl(${colors.neutral[100]})`, surface));
        assert.ok(readable >= 4.5, `${preset.id} ${theme} text on ${name} is ${readable.toFixed(2)}:1`);
      }
      assert.ok(ratio(colors.bubbleOutInk, colors.bubbleOut) >= 4.5, `${preset.id} outgoing bubble ink`);
      assert.ok(ratio(colors.bubbleInInk, colors.bubbleIn) >= 4.5, `${preset.id} incoming bubble ink`);
      assert.ok(ratio(colors.accentInk, colors.accent) >= 4.5, `${preset.id} accent ink`);
    }
  }
});

test('theme variables cover the semantic surface set', () => {
  const colors = palette.resolveTheme('purple', false);
  const vars = apply.themeVariables(colors);
  for (const name of ['--geegle-bg', '--geegle-header', '--geegle-card', '--geegle-text', '--geegle-muted', '--geegle-accent', '--geegle-bubble-out', '--geegle-bubble-in', '--geegle-n-950']) {
    assert.ok(vars[name], `missing ${name}`);
  }
  assert.equal(vars['--geegle-accent-contrast'], vars['--geegle-accent-ink']);
});

test('an unknown preset falls back to the default palette', () => {
  const colors = palette.resolveTheme('not-a-theme', false);
  const fallback = palette.resolveTheme(palette.DEFAULT_THEME_ID, false);
  assert.deepEqual(colors, fallback);
  assert.equal(palette.themePreset('not-a-theme').id, palette.DEFAULT_THEME_ID);
});
