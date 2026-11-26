// Password visibility guards: every password field is hidden by default, has
// its own toggle that cannot submit the form, and is labelled for assistive
// technology.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const component = readFileSync('src/components/PasswordInput.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const settings = readFileSync('src/components/Settings.tsx', 'utf8');

test('password fields are hidden until the eye is pressed', () => {
  assert.match(component, /useState\(false\)/, 'visibility starts hidden');
  assert.match(component, /type=\{visible \? 'text' : 'password'\}/);
});

test('the eye is a real button that cannot submit the form', () => {
  assert.match(component, /type="button"/);
  assert.match(component, /onClick=\{\(\) => setVisible\(/);
});

test('the toggle is labelled Show password / Hide password', () => {
  assert.match(component, /'Show password'/);
  assert.match(component, /'Hide password'/);
  assert.match(component, /aria-pressed=\{visible\}/);
});

test('each field owns its visibility state, so fields toggle independently', () => {
  // State lives inside each component instance rather than being passed in.
  assert.match(component, /const \[visible, setVisible\] = useState\(false\)/);
  assert.ok(!/visible\??:/.test(component.split('return (')[0]), 'visibility is not a shared prop');
  assert.match(component, /EyeOff/);
  assert.match(component, /Eye/);
});

test('the sign-in and account creation form uses it', () => {
  const dialog = app.slice(app.indexOf('const renderAuthDialog'), app.indexOf('if (showLanding)'));
  assert.match(dialog, /<PasswordInput/);
  assert.equal(dialog.match(/type="password"/g), null, 'no unmanaged password input is left behind');
  assert.match(dialog, /autoComplete=\{authMode === 'login' \? 'current-password' : 'new-password'\}/);
});

test('both Settings password fields use it', () => {
  const change = settings.slice(settings.indexOf("tab === 'preferences'"), settings.indexOf("tab === 'tab'"));
  assert.equal(change.match(/<PasswordInput/g)?.length, 2);
  assert.ok(!/type="password"/.test(change), 'no unmanaged password input is left behind');
  assert.match(change, /autoComplete="current-password"/);
  assert.match(change, /autoComplete="new-password"/);
});

test('plaintext passwords are never logged or persisted', () => {
  for (const source of [component, app, settings]) {
    assert.ok(!/console\.(log|debug|info)/.test(source), 'no password logging');
  }
  // The password field itself never touches browser storage...
  assert.ok(!/localStorage|sessionStorage/.test(component));
  // ...and no password value is written to it anywhere.
  for (const source of [app, settings]) {
    assert.ok(!/(localStorage|sessionStorage)[^;]*(authPassword|currentPassword|newPassword)/.test(source));
  }
});
