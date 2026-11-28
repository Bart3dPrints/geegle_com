import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SHORTCUT,
  isAllowedShortcutKey,
  isEditableTarget,
  parseDestination,
  parseShortcut,
  shortcutMatches,
} from '../src/lib/navigationShortcut.ts';

test('the default shortcut is a single backslash to the configured site', () => {
  assert.equal(DEFAULT_SHORTCUT.key, '\\');
  assert.equal(DEFAULT_SHORTCUT.enabled, true);
  assert.equal(DEFAULT_SHORTCUT.destination, 'https://manhasset.instructure.com/');
});

test('destinations gain exactly one https scheme', () => {
  assert.equal(parseDestination('manhasset.instructure.com'), 'https://manhasset.instructure.com/');
  assert.equal(parseDestination('https://manhasset.instructure.com/'), 'https://manhasset.instructure.com/');
  assert.equal(parseDestination('http://example.com/path'), 'https://example.com/path');
  assert.equal(parseDestination('https://https://example.com'), null);
});

test('destinations reject malformed or unsafe values', () => {
  assert.equal(parseDestination(''), null);
  assert.equal(parseDestination('javascript:alert(1)'), null);
  assert.equal(parseDestination('file:///etc/passwd'), null);
  assert.equal(parseDestination('https://user:pass@example.com'), null);
  assert.equal(parseDestination('localhost'), null);
});

test('only single printable symbol keys are assignable', () => {
  assert.equal(isAllowedShortcutKey('\\'), true);
  assert.equal(isAllowedShortcutKey('`'), true);
  assert.equal(isAllowedShortcutKey('/'), true);
  assert.equal(isAllowedShortcutKey('a'), false);
  assert.equal(isAllowedShortcutKey('Enter'), false);
  assert.equal(isAllowedShortcutKey(' '), false);
  assert.equal(isAllowedShortcutKey('Shift'), false);
});

test('parsing keeps valid values and repairs invalid ones', () => {
  assert.deepEqual(parseShortcut(null), DEFAULT_SHORTCUT);
  assert.deepEqual(
    parseShortcut({ enabled: false, key: '/', destination: 'example.com/class' }),
    { enabled: false, key: '/', destination: 'https://example.com/class' }
  );
  assert.deepEqual(parseShortcut({ key: 'Enter', destination: 'nope' }), DEFAULT_SHORTCUT);
});

test('a disabled shortcut never matches', () => {
  const event = { key: '\\', ctrlKey: false, metaKey: false, altKey: false };
  assert.equal(shortcutMatches(event, DEFAULT_SHORTCUT), true);
  assert.equal(shortcutMatches(event, { ...DEFAULT_SHORTCUT, enabled: false }), false);
  assert.equal(shortcutMatches({ ...event, ctrlKey: true }, DEFAULT_SHORTCUT), false);
  assert.equal(shortcutMatches({ ...event, metaKey: true }, DEFAULT_SHORTCUT), false);
  assert.equal(shortcutMatches({ ...event, key: '/' }, DEFAULT_SHORTCUT), false);
});

test('typing surfaces are treated as editable', () => {
  for (const tag of ['input', 'textarea', 'select']) {
    assert.equal(isEditableTarget({ tagName: tag.toUpperCase(), isContentEditable: false }), true);
  }
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: false }), false);
  assert.equal(isEditableTarget(null), false);
});
