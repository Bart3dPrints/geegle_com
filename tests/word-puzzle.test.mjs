import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_STATS,
  MAX_GUESSES,
  PUZZLE_WORDS,
  isAcceptedWord,
  letterHints,
  parsePuzzleState,
  roundsStats,
  scoreGuess,
  startRound,
  submitGuess,
} from '../src/lib/wordPuzzle.ts';

test('the answer list is all five lowercase letters and unique', () => {
  assert.ok(PUZZLE_WORDS.length > 100);
  for (const word of PUZZLE_WORDS) assert.match(word, /^[a-z]{5}$/);
  assert.equal(new Set(PUZZLE_WORDS).size, PUZZLE_WORDS.length);
});

test('a correct guess is scored fully correct', () => {
  assert.deepEqual(scoreGuess('crane', 'crane'), Array(5).fill('correct'));
});

test('present letters are marked where the letter exists elsewhere', () => {
  assert.deepEqual(scoreGuess('crane', 'nacre'), ['present', 'present', 'present', 'present', 'correct']);
});

test('duplicate guesses only claim as many letters as the answer holds', () => {
  // One "e" in the answer: the first guess "e" is present, the second is absent.
  assert.deepEqual(scoreGuess('brick', 'eerie'), ['absent', 'absent', 'present', 'present', 'absent']);
  assert.deepEqual(scoreGuess('there', 'eerie'), ['present', 'absent', 'present', 'absent', 'correct']);
});

test('a guess is rejected when it is short or unknown', () => {
  const state = startRound(1);
  assert.equal(submitGuess(state, 'cat').reason, 'short');
  assert.equal(submitGuess(state, 'zzzzz').reason, 'unknown');
  assert.equal(isAcceptedWord('crane'), true);
});

test('a winning guess ends the round', () => {
  const state = { ...startRound(1), answer: 'crane' };
  const result = submitGuess(state, 'crane');
  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'won');
  assert.deepEqual(result.state.guesses, ['crane']);
});

test('six wrong guesses end the round', () => {
  let state = { ...startRound(1), answer: 'crane' };
  for (const guess of ['about', 'above', 'abuse', 'actor', 'acute', 'admit']) {
    state = submitGuess(state, guess).state;
  }
  assert.equal(state.status, 'lost');
  assert.equal(state.guesses.length, MAX_GUESSES);
});

test('finished rounds accept no more guesses', () => {
  const state = { ...startRound(1), answer: 'crane', status: 'won' };
  assert.equal(submitGuess(state, 'about').reason, 'finished');
});

test('keyboard hints keep the strongest state per letter', () => {
  const state = { answer: 'crane', guesses: ['nacre', 'about'], status: 'playing', round: 1 };
  const hints = letterHints(state);
  assert.equal(hints.c, 'present');
  assert.equal(hints.n, 'present');
  assert.equal(hints.a, 'present');
  assert.equal(hints.b, 'absent');
});

test('stats count a win streak and reset it on a loss', () => {
  const once = roundsStats(EMPTY_STATS, 'won');
  assert.deepEqual(once, { played: 1, won: 1, streak: 1, bestStreak: 1 });
  const twice = roundsStats(once, 'won');
  assert.equal(twice.streak, 2);
  const loss = roundsStats(twice, 'lost');
  assert.deepEqual(loss, { played: 3, won: 2, streak: 0, bestStreak: 2 });
  assert.equal(roundsStats(loss, 'playing'), loss);
});

test('saved state and stats reject malformed data', () => {
  assert.equal(parsePuzzleState(null), null);
  assert.equal(parsePuzzleState({ answer: 'TOOLONG' }), null);
  assert.deepEqual(
    parsePuzzleState({ answer: 'crane', guesses: ['about', 'x', 7], status: 'won', round: 3 }),
    { answer: 'crane', guesses: ['about'], status: 'won', round: 3 }
  );
  assert.deepEqual(parsePuzzleState({ answer: 'crane', guesses: [], status: 'lost' }).status, 'lost');
});
