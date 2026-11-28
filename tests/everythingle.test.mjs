// Everythingle: the recorded collection must be complete and honest, the
// in-Geegle word formats must behave, and the app must not proxy or mirror a
// provider's games (its terms forbid copying or redistribution).

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

const data = await load("export * from './src/data/everythingle.ts';");
const games = await load("export * from './src/lib/wordGames.ts';");
const puzzle = await load("export * from './src/lib/wordPuzzle.ts';");

test('the complete Everythingle collection is recorded', () => {
  assert.equal(data.EVERYTHINGLE_GAMES.length, 50, 'the provider lists 50 games');
  const slugs = data.EVERYTHINGLE_GAMES.map((game) => game.slug);
  assert.equal(new Set(slugs).size, 50, 'every game has its own slug');
  for (const game of data.EVERYTHINGLE_GAMES) {
    assert.ok(game.title.trim(), game.slug);
    assert.ok(game.blurb.trim(), game.slug);
    assert.ok(data.EVERYTHINGLE_CATEGORIES.includes(game.category), game.slug);
  }
  for (const category of data.EVERYTHINGLE_CATEGORIES) {
    assert.ok(
      data.EVERYTHINGLE_GAMES.some((game) => game.category === category),
      `${category} has games`,
    );
  }
  // Spot-check the provider's own list, including the hard-to-integrate ones.
  for (const slug of ['wordle', 'krillion', 'chess', 'globle', 'contexto', 'animellion']) {
    assert.ok(slugs.includes(slug), slug);
  }
});

test('every game resolves to its official provider page', () => {
  for (const game of data.EVERYTHINGLE_GAMES) {
    const url = new URL(data.everythingleUrl(game.slug));
    assert.equal(url.protocol, 'https:');
    assert.equal(url.host, 'everythingle.com');
    assert.equal(url.pathname, `/games/${game.slug}/`);
  }
});

test('only formats Geegle actually implements are marked as local', () => {
  const local = data.localGames();
  assert.deepEqual(
    local.map((game) => game.local).sort(),
    ['dordle', 'five-letter', 'middle-word', 'quordle', 'word500'],
  );
  for (const game of local) {
    assert.ok(data.LOCAL_GAME_TITLES[game.local], game.slug);
  }
});

test('the app plays games instead of proxying or asking how to open them', () => {
  const app = readFileSync('src/components/EverythingleApp.tsx', 'utf8');
  for (const forbidden of ['chrivtx', 'proxyUrl', 's3.amazonaws', 'directProxy', 'CherryProxy']) {
    assert.ok(!app.includes(forbidden), `EverythingleApp must not reference ${forbidden}`);
  }
  assert.match(app, /everythingleUrl\(official\.slug\)/, 'official games load their own page');
  assert.match(app, /setLocalGame\(game\)/, 'Geegle implementations open directly');
  assert.ok(
    !/Set server|Direct|Proxy chooser/.test(app),
    'no intermediate server-choice screen',
  );
});

test('the counts-only format reports totals that add up', () => {
  const counts = games.scoreCounts('stone', 'tones');
  assert.equal(counts.correct + counts.present + counts.absent, 5);
  assert.deepEqual(games.scoreCounts('stone', 'stone'), { correct: 5, present: 0, absent: 0 });
});

test('multi-board rounds never repeat an answer on two boards', () => {
  for (const count of [2, 4]) {
    const answers = games.pickAnswers(count, 'seed');
    assert.equal(answers.length, count);
    assert.equal(new Set(answers).size, count);
    for (const answer of answers) assert.ok(puzzle.isAcceptedWord(answer), answer);
  }
});

test('a multi-board round is only won when every board is solved', () => {
  const answers = games.pickAnswers(2, 'round-1');
  assert.equal(games.multiBoardStatus(answers, [], 7), 'playing');
  assert.equal(games.multiBoardStatus(answers, [answers[0]], 7), 'playing');
  assert.equal(games.multiBoardStatus(answers, answers, 7), 'won');
  const filler = puzzle.PUZZLE_WORDS.filter((word) => !answers.includes(word)).slice(0, 7);
  assert.equal(games.multiBoardStatus(answers, filler, 7), 'lost');
});

test('guesses are validated before they reach a board', () => {
  const state = games.startBoards(1, 1, 'test', 6);
  assert.equal(games.submitBoardGuess(state, 'ab').ok, false);
  assert.equal(games.submitBoardGuess(state, 'zzzzz').ok, false);
  const accepted = games.submitBoardGuess(state, 'STONE');
  assert.ok(accepted.ok);
  assert.deepEqual(accepted.state.guesses, ['stone']);
});

test('Middle Word brackets the answer and gives alphabetical hints', () => {
  for (let round = 1; round <= 30; round += 1) {
    const value = games.makeMiddleRound(round);
    assert.ok(value.left < value.answer, `round ${round} lower bound`);
    assert.ok(value.answer < value.right, `round ${round} upper bound`);
    assert.equal(games.middleHint(value, value.answer).kind, 'correct');
  }
  const round = games.makeMiddleRound(7);
  const before = games.middleHint(round, round.left);
  assert.equal(before.kind, 'before');
  assert.ok(before.distance > 0);
  const after = games.middleHint(round, round.right);
  assert.equal(after.kind, 'after');
  assert.equal(games.middleHint(round, 'notaword').kind, 'unknown');
});
