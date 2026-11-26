// Account reminder guards: signed-out visitors see it once per browsing
// session, signed-in users never do, and the copy is exactly the approved text.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export { shouldShowAccountReminder, reminderDismissed, dismissReminder, ACCOUNT_REMINDER_KEY } from './src/lib/accountReminder.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { shouldShowAccountReminder, reminderDismissed, dismissReminder, ACCOUNT_REMINDER_KEY } = await import(
  `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
);

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('a guest is offered the reminder until it is dismissed', () => {
  assert.equal(shouldShowAccountReminder({ signedIn: false, dismissed: false }), true);
  assert.equal(shouldShowAccountReminder({ signedIn: false, dismissed: true }), false);
});

test('signed-in users never receive the reminder', () => {
  assert.equal(shouldShowAccountReminder({ signedIn: true, dismissed: false }), false);
  assert.equal(shouldShowAccountReminder({ signedIn: true, dismissed: true }), false);
});

test('external proxy destinations keep their own notice, not this reminder', () => {
  assert.equal(shouldShowAccountReminder({ signedIn: false, dismissed: false, isProxy: true }), false);
});

test('dismissal lives in session storage, so it covers one browsing session', () => {
  const storage = memoryStorage();
  assert.equal(reminderDismissed(storage), false);
  dismissReminder(storage);
  assert.equal(storage.getItem(ACCOUNT_REMINDER_KEY), '1');
  assert.equal(reminderDismissed(storage), true);
  // A brand-new session (empty session storage) starts fresh.
  assert.equal(reminderDismissed(memoryStorage()), false);
});

test('unavailable storage never blocks gameplay', () => {
  const broken = {
    getItem() {
      throw new Error('storage disabled');
    },
    setItem() {
      throw new Error('storage disabled');
    },
  };
  assert.equal(reminderDismissed(broken), false);
  assert.doesNotThrow(() => dismissReminder(broken));
});

test('the reminder uses the approved wording and offers all three choices', () => {
  const source = readFileSync('src/components/AccountReminder.tsx', 'utf8');
  assert.match(source, /Save your progress/);
  assert.match(
    source,
    /Sign in or create an account to keep supported game progress and preferences across devices\. Guest progress may be lost when browser data is cleared\./
  );
  assert.match(source, />\s*Sign in\s*</);
  assert.match(source, />\s*Create account\s*</);
  assert.match(source, />\s*Continue as guest\s*</);
  // It must not promise saving everywhere.
  assert.ok(!/every game|all games|guaranteed/i.test(source));
});

test('the app keeps the destination and launches it only after a choice', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /pendingLaunch/);
  const launch = app.slice(app.indexOf('const launch = useCallback'), app.indexOf('// Every proxy launch'));
  assert.match(launch, /pendingLaunch/);
  assert.match(launch, /AccountReminder|reminderOpen/, 'a guest launch opens the reminder instead of the game');
  // Closing the account form keeps the pending game and returns to the reminder.
  const closeAuth = app.slice(app.indexOf('const closeAuth'), app.indexOf('const handleSignOut'));
  assert.match(closeAuth, /setReminderOpen\(true\)/);
});

test('the account forms carry the short secondary sentence', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const dialog = app.slice(app.indexOf('const renderAuthDialog'), app.indexOf('if (showLanding)'));
  assert.match(dialog, /Keep your progress and preferences across devices\./);
  assert.match(dialog, /text-xs text-neutral-500/, 'small secondary text');
  assert.equal(dialog.match(/Keep your progress and preferences across devices\./g).length, 1);
});
