// The alphabetical sections and sidebar must agree on the same grouping, and
// the "#" bucket must always sort last so numbers and symbols do not split A–Z.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export * from './src/lib/alphabet.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});

const { letterFor, groupByLetter } = await import(
  `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
);

const entry = (title) => ({ id: title.toLowerCase(), title, path: '', categories: [], kind: 'game' });

test('titles map to one uppercase letter or the # bucket', () => {
  assert.equal(letterFor('2048'), '#');
  assert.equal(letterFor('  among us'), 'A');
  assert.equal(letterFor('Éclair'), 'E');
  assert.equal(letterFor('krillion'), 'K');
});

test('sections are ordered # first, then A–Z', () => {
  const sections = groupByLetter([
    entry('Zelda'),
    entry('2048'),
    entry('Among Us'),
    entry('Bloons'),
  ]);
  assert.deepEqual(
    sections.map((section) => section.letter),
    ['#', 'A', 'B', 'Z']
  );
  assert.deepEqual(
    sections.find((section) => section.letter === 'Z').entries.map((item) => item.title),
    ['Zelda']
  );
});

test('every entry appears exactly once', () => {
  const games = [entry('A1'), entry('A2'), entry('B1'), entry('1up'), entry('A3')];
  const grouped = groupByLetter(games).flatMap((section) => section.entries);
  assert.equal(grouped.length, games.length);
  assert.deepEqual(
    [...grouped].sort((a, b) => a.id.localeCompare(b.id)),
    [...games].sort((a, b) => a.id.localeCompare(b.id))
  );
});
