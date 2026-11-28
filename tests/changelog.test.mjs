// Changelog guards: only merged pull requests become releases, entries are
// keyed by PR number (never duplicated), newest first, with real merge times
// shown in Eastern Time including the daylight-saving adjustment.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export { mergedPullEntries, formatEastern } from './src/lib/changelog.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { mergedPullEntries, formatEastern } = await import(
  `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
);

const pulls = [
  { number: 3, title: 'Third change', merged_at: '2026-11-26T00:37:32Z' },
  { number: 5, title: 'Fifth change', merged_at: null },
  { number: 4, title: 'Fourth change', merged_at: '2026-11-25T22:48:31Z' },
  { number: 3, title: 'Third change', merged_at: '2026-11-26T00:37:32Z' },
];

test('only merged pull requests become changelog entries', () => {
  const entries = mergedPullEntries(pulls, {});
  assert.deepEqual(entries.map((entry) => entry.pr), [3, 4]);
  assert.equal(entries.some((entry) => entry.pr === 5), false);
});

test('entries are keyed by PR number, so a repeated pull is not duplicated', () => {
  const entries = mergedPullEntries(pulls, {});
  assert.equal(entries.length, new Set(entries.map((entry) => entry.pr)).size);
  const repeated = mergedPullEntries([...pulls, { number: 4, title: 'Fourth change', merged_at: '2026-11-25T22:48:31Z' }], {});
  assert.equal(repeated.filter((entry) => entry.pr === 4).length, 1);
});

test('newest release comes first', () => {
  const entries = mergedPullEntries(
    [
      { number: 1, title: 'Oldest', merged_at: '2026-11-24T23:55:59Z' },
      { number: 2, title: 'Newest', merged_at: '2026-12-01T12:00:00Z' },
      { number: 3, title: 'Middle', merged_at: '2026-11-25T22:48:31Z' },
    ],
    {}
  );
  assert.deepEqual(entries.map((entry) => entry.pr), [2, 3, 1]);
});

test('a written note is used, otherwise the pull request title is the summary', () => {
  const entries = mergedPullEntries(pulls, { 3: 'Written for readers.' });
  assert.equal(entries.find((entry) => entry.pr === 3).summary, 'Written for readers.');
  assert.equal(entries.find((entry) => entry.pr === 4).summary, 'Fourth change');
});

test('merge times are converted to Eastern Time with the DST adjustment', () => {
  // November: EST (UTC-5).
  assert.deepEqual(formatEastern('2026-11-26T19:56:39Z'), { date: 'November 26, 2026', time: '2:56 PM EST' });
  // UTC after midnight is the previous evening in New York.
  assert.deepEqual(formatEastern('2026-11-26T00:37:32Z'), { date: 'November 25, 2026', time: '7:37 PM EST' });
  // July: EDT (UTC-4).
  assert.deepEqual(formatEastern('2026-07-01T16:05:00Z'), { date: 'July 1, 2026', time: '12:05 PM EDT' });
  // The DST switch itself: 2026-03-08 07:00 UTC is 2:00 AM EST, then 3:00 AM EDT.
  assert.deepEqual(formatEastern('2026-03-08T06:59:00Z'), { date: 'March 8, 2026', time: '1:59 AM EST' });
  assert.deepEqual(formatEastern('2026-03-08T07:01:00Z'), { date: 'March 8, 2026', time: '3:01 AM EDT' });
});

test('the committed changelog holds the real merged history', () => {
  assert.ok(existsSync('src/data/changelog.json'), 'the changelog data is committed');
  const data = JSON.parse(readFileSync('src/data/changelog.json', 'utf8'));
  const entries = data.entries ?? [];
  assert.ok(entries.length >= 9, `only ${entries.length} entries`);
  const prNumbers = [...entries].map((entry) => entry.pr).sort((a, b) => a - b);
  assert.deepEqual(
    prNumbers,
    Array.from({ length: Math.max(...prNumbers) }, (_, index) => index + 1)
  );
  assert.ok(prNumbers.includes(9), 'the first post-restoration merged PR is present');
  const prs = entries.map((entry) => entry.pr);
  assert.equal(new Set(prs).size, prs.length, 'no PR appears twice');
  const times = entries.map((entry) => entry.mergedAt);
  assert.deepEqual([...times].sort().reverse(), times, 'newest first');
  for (const entry of entries) {
    assert.match(entry.mergedAt, /^\d{4}-\d{2}-\d{2}T/, `PR ${entry.pr} has a real merge time`);
    assert.ok(entry.summary.length > 10 && entry.summary.length <= 200, `PR ${entry.pr} summary is short`);
    assert.ok(!/prompt|codebuff|\bAI\b|supabase\.co|service_role/i.test(entry.summary), `PR ${entry.pr} summary is safe`);
  }
  // Each release carries a written note rather than its development
  // pull-request title.
  const latest = entries[0];
  assert.equal(latest.pr, 18);
  assert.deepEqual(formatEastern(latest.mergedAt), { date: 'November 28, 2026', time: '12:22 AM EST' });
  assert.ok(!/^Run \d/i.test(latest.summary), 'no raw development PR title is shown');
  const previous = entries[1];
  assert.equal(previous.pr, 17);
  assert.deepEqual(formatEastern(previous.mergedAt), { date: 'November 27, 2026', time: '10:18 PM EST' });
  assert.ok(!/^Run \d/i.test(previous.summary), 'no raw development PR title is shown');
});

test('the Changelog offers both sort directions and no sorting explanation', () => {
  const component = readFileSync('src/components/Changelog.tsx', 'utf8');
  assert.match(component, /<option value="newest">Newest first<\/option>/);
  assert.match(component, /<option value="oldest">Oldest first<\/option>/);
  assert.match(component, /useState<SortOrder>\('newest'\)/, 'newest first is the default');
  assert.ok(!/Times are Eastern/.test(component), 'the explanatory line is gone');
  assert.ok(!/Newest first\. Times/.test(component));
});

test('Changelog is the last Settings tab and its own component renders the list', () => {
  const settings = readFileSync('src/components/Settings.tsx', 'utf8');
  const tabs = settings.slice(settings.indexOf('const TABS = ['), settings.indexOf('] as const'));
  assert.match(tabs, /label: 'Changelog'/);
  const labels = [...tabs.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(labels.at(-1), 'Changelog');
  assert.ok(labels.length >= 4, 'existing tabs are preserved');
  assert.deepEqual(labels.slice(0, 3), ['Theme', 'Appearance', 'Preferences']);

  const component = readFileSync('src/components/Changelog.tsx', 'utf8');
  assert.match(component, /formatEastern/);
  assert.match(component, /<ol/);
  // No decorative extras: no emoji/badges/timeline art, plain grayscale.
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(component), 'no emoji');
  assert.ok(!/gradient|purple|indigo|blue-|shadow-lg/.test(component), 'neutral styling only');
});
