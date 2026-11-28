// Time & Date preferences: the documented defaults, strict parsing of stored
// values, automatic browser detection and real daylight-saving handling.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: { resolveDir: process.cwd(), contents: "export * from './src/lib/timeSettings.ts';" },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const time = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);

test('the default is Eastern Time on a 12-hour clock', () => {
  assert.deepEqual(time.DEFAULT_TIME_SETTINGS, { hour12: true, timeZone: 'America/New_York' });
  assert.equal(time.DEFAULT_TIME_ZONE, 'America/New_York');
});

test('stored time settings are validated, never trusted', () => {
  assert.deepEqual(time.parseTimeSettings(null), time.DEFAULT_TIME_SETTINGS);
  assert.deepEqual(
    time.parseTimeSettings({ timeZone: 'Mars/Olympus_Mons', hour12: 'yes' }),
    time.DEFAULT_TIME_SETTINGS,
    'an unknown zone falls back to the default and a non-boolean keeps 12-hour',
  );
  assert.deepEqual(time.parseTimeSettings({ timeZone: 'auto', hour12: false }), {
    hour12: false,
    timeZone: 'auto',
  });
  assert.deepEqual(time.parseTimeSettings({ timeZone: 'Europe/London' }).timeZone, 'Europe/London');
  assert.ok(!time.isValidTimeZone('../../etc/passwd'));
  assert.ok(!time.isValidTimeZone(''));
});

test('automatic detection reports a usable browser zone', () => {
  const detected = time.browserTimeZone();
  assert.ok(time.isValidTimeZone(detected), detected);
  assert.equal(time.resolveTimeZone({ timeZone: 'auto' }), detected);
  assert.equal(time.resolveTimeZone({ timeZone: 'America/New_York' }), 'America/New_York');
  assert.equal(time.resolveTimeZone({ timeZone: 'Nowhere/Nothing' }), 'America/New_York');
});

test('daylight saving time is applied instead of a fixed offset', () => {
  const winter = new Date('2026-01-15T12:00:00Z');
  const summer = new Date('2026-07-15T12:00:00Z');
  const eastern = { hour12: true, timeZone: 'America/New_York' };
  assert.equal(time.formatClock(winter, eastern), '7:00 AM', 'EST is UTC-5');
  assert.equal(time.formatClock(summer, eastern), '8:00 AM', 'EDT is UTC-4');
});

test('12-hour and 24-hour formats are independent of the zone', () => {
  const date = new Date('2026-11-28T21:05:00Z');
  assert.equal(time.formatClock(date, { hour12: true, timeZone: 'America/New_York' }), '4:05 PM');
  assert.equal(time.formatClock(date, { hour12: false, timeZone: 'America/New_York' }), '16:05');
  assert.equal(time.formatClock(date, { hour12: false, timeZone: 'UTC' }), '21:05');
});

test('the date follows the selected zone too', () => {
  const lateUtc = new Date('2026-11-29T02:30:00Z');
  assert.equal(time.formatDate(lateUtc, { timeZone: 'America/New_York' }), 'Sat, Nov 28');
  assert.equal(time.formatDate(lateUtc, { timeZone: 'UTC' }), 'Sun, Nov 29');
});

test('the described zone includes its current abbreviation', () => {
  const winter = new Date('2026-01-15T12:00:00Z');
  const summer = new Date('2026-07-15T12:00:00Z');
  const eastern = { hour12: true, timeZone: 'America/New_York' };
  assert.match(time.describeTimeZone(eastern, winter), /EST/);
  assert.match(time.describeTimeZone(eastern, summer), /EDT/);
});
