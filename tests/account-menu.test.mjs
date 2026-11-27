// Regression guards for the library header: the account dropdown holds
// Preferences and Sign out (in that order), Settings stays a separate header
// button, and the wordmark keeps its larger licensed typeface.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, statSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');

/** The dropdown region only: everything between the menu role and its close. */
function accountMenuBlock() {
  const start = app.indexOf('role="menu"');
  assert.ok(start > 0, 'the library renders an account menu');
  return app.slice(start, app.indexOf('</motion.div>', start));
}

test('the account dropdown has exactly two actions', () => {
  const block = accountMenuBlock();
  const items = block.match(/role="menuitem"/g) ?? [];
  assert.equal(items.length, 2);
});

test('Preferences opens account settings above "Sign out"', () => {
  const block = accountMenuBlock();
  const preferences = block.indexOf('Preferences');
  const signOut = block.indexOf('Sign out');
  assert.ok(preferences > 0, 'Preferences is offered');
  assert.ok(signOut > preferences, 'Sign out stays last');
  assert.match(block, /setSettingsTab\('preferences'\)/);
  assert.ok(!/Log out/.test(block), 'the dropdown must not keep the old logout wording');
});

test('the dropdown carries no duplicate Settings entry and no username line', () => {
  const block = accountMenuBlock();
  assert.ok(!/>\s*Settings\s*</.test(block), 'Settings belongs to the header, not the dropdown');
  assert.ok(!/auth\.username/.test(block), 'the dropdown must not repeat the username');
  assert.ok(!/<p[\s>]/.test(block), 'the dropdown holds no extra labels');
});

test('selecting Sign out runs the existing awaited logout', () => {
  const block = accountMenuBlock();
  assert.match(block, /handleSignOut\(\)/);
  const handler = app.slice(app.indexOf('const handleSignOut'), app.indexOf('const launch'));
  assert.match(handler, /await closeGame\(\)/, 'logout still flushes the running game save first');
  assert.match(handler, /await auth\.signOut\(\)/);
});

test('Settings stays a header button next to the wordmark', () => {
  const header = app.slice(app.indexOf('<header'), app.indexOf('</header>'));
  const brandIndex = header.indexOf('geegle-wordmark');
  const settingsIndex = header.indexOf('aria-label="Settings"');
  assert.ok(brandIndex > 0 && settingsIndex > brandIndex, 'Settings follows the wordmark');
  assert.ok(!/setAccountMenuOpen\(false\);\s*setSettingsOpen\(true\)/.test(accountMenuBlock()));
});

test('the wordmark is ~30-40% larger than the previous 16px label', () => {
  const rule = css.match(/\.geegle-wordmark\s*\{[\s\S]*?\}/);
  assert.ok(rule, 'the wordmark has its own rule');
  const size = Number(rule[0].match(/font-size:\s*(\d+)px/)?.[1]);
  assert.ok(size >= 21 && size <= 23, `size was ${size}px`);
  assert.match(rule[0], /line-height:\s*24px/, 'tight leading keeps the header height');
});

test('the wordmark typeface is self-hosted and licensed', () => {
  assert.match(css, /@font-face\s*\{[\s\S]*?font-family:\s*'Geegle Wordmark'/);
  assert.match(css, /url\('\/fonts\/poppins-500\.woff2'\)/);
  assert.ok(existsSync('public/fonts/poppins-500.woff2'));
  assert.ok(statSync('public/fonts/poppins-500.woff2').size > 1000);
  assert.match(readFileSync('public/fonts/POPPINS-OFL.txt', 'utf8'), /SIL Open Font License/);
});

test('the header brand is text only, with no circular badge', () => {
  const header = app.slice(app.indexOf('<header'), app.indexOf('</header>'));
  const brand = header.slice(header.indexOf('geegle-wordmark'), header.indexOf('</button>', header.indexOf('geegle-wordmark')));
  assert.match(brand, /\{SITE_TITLE\}/);
  assert.ok(!/<(span|svg|img)/.test(brand), 'no icon sits beside the wordmark');
});
