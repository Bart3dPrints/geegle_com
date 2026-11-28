// Extra original word formats used by the in-Geegle Everythingle games.
//
// These reuse the same authored word list and the same two-pass scoring as
// src/lib/wordPuzzle.ts, and add the multi-board, counts-only and
// alphabetical-middle rules. No provider data is copied.

import {
  MAX_GUESSES,
  PUZZLE_WORDS,
  isAcceptedWord,
  pickAnswer,
  scoreGuess,
  type LetterState,
} from './wordPuzzle';

export type BoardStatus = 'playing' | 'won' | 'lost';

export interface GuessCounts {
  correct: number;
  present: number;
  absent: number;
}

/** Word500-style feedback: only how many of each colour, never which letters. */
export function scoreCounts(answer: string, guess: string): GuessCounts {
  const states = scoreGuess(answer, guess);
  return {
    correct: states.filter((state) => state === 'correct').length,
    present: states.filter((state) => state === 'present').length,
    absent: states.filter((state) => state === 'absent').length,
  };
}

/** One solved board stops taking new guesses but the others keep playing. */
export function boardStatus(answer: string, guesses: string[], limit: number): BoardStatus {
  if (guesses.includes(answer)) return 'won';
  return guesses.length >= limit ? 'lost' : 'playing';
}

export function multiBoardStatus(answers: string[], guesses: string[], limit: number): BoardStatus {
  if (answers.every((answer) => guesses.includes(answer))) return 'won';
  if (guesses.length >= limit) return 'lost';
  return 'playing';
}

/** Distinct answers so two boards never hide the same word. */
export function pickAnswers(count: number, seed: string): string[] {
  const answers: string[] = [];
  let salt = 0;
  while (answers.length < count) {
    const candidate = pickAnswer(`${seed}:${salt}`);
    salt += 1;
    if (!answers.includes(candidate)) answers.push(candidate);
    if (salt > 500) break;
  }
  return answers;
}

export const MIDDLE_MAX_GUESSES = 10;

export interface MiddleRound {
  /** Alphabetically lower bound shown to the player. */
  left: string;
  /** Alphabetically higher bound shown to the player. */
  right: string;
  answer: string;
}

const SORTED_WORDS: readonly string[] = [...new Set(PUZZLE_WORDS)].sort();

export function sortedWordList(): readonly string[] {
  return SORTED_WORDS;
}

function wordIndex(word: string): number {
  return SORTED_WORDS.indexOf(word.toLowerCase());
}

/** Deterministic FNV-1a hash, so a round is reproducible from its number. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A round is a hidden word plus a lower and an upper word that bracket it. The
 * answer is never the first or last word in the list, so both bounds always
 * exist and strictly surround it.
 */
export function makeMiddleRound(seed: string | number, spread = 12): MiddleRound {
  const index = 1 + (hashSeed(`middle:${seed}`) % (SORTED_WORDS.length - 2));
  const answer = SORTED_WORDS[index];
  const left = SORTED_WORDS[Math.max(0, index - spread)];
  const right = SORTED_WORDS[Math.min(SORTED_WORDS.length - 1, index + spread)];
  return { left, right, answer };
}

export type MiddleHint = { kind: 'correct' } | { kind: 'before' | 'after'; distance: number } | { kind: 'unknown' };

/** "before"/"after" is alphabetical order; distance counts dictionary words. */
export function middleHint(round: MiddleRound, raw: string): MiddleHint {
  const guess = raw.trim().toLowerCase();
  if (!isAcceptedWord(guess)) return { kind: 'unknown' };
  if (guess === round.answer) return { kind: 'correct' };
  const distance = Math.abs(wordIndex(guess) - wordIndex(round.answer));
  return { kind: guess < round.answer ? 'before' : 'after', distance };
}

export interface MultiBoardState {
  answers: string[];
  guesses: string[];
  limit: number;
}

export function startBoards(count: number, round: number, seedPrefix: string, limit: number): MultiBoardState {
  return { answers: pickAnswers(count, `${seedPrefix}-${round}`), guesses: [], limit };
}

export type SubmitBoardResult =
  | { ok: false; reason: 'short' | 'unknown' | 'finished' }
  | { ok: true; state: MultiBoardState };

export function submitBoardGuess(state: MultiBoardState, raw: string): SubmitBoardResult {
  const guess = raw.trim().toLowerCase();
  if (state.guesses.length >= state.limit) return { ok: false, reason: 'finished' };
  if (!/^[a-z]{5}$/.test(guess)) return { ok: false, reason: 'short' };
  if (!isAcceptedWord(guess)) return { ok: false, reason: 'unknown' };
  return { ok: true, state: { ...state, guesses: [...state.guesses, guess] } };
}

/** States for one board's grid; empty strings are untouched cells. */
export function boardRows(state: MultiBoardState, answer: string): (LetterState | null)[][] {
  return Array.from({ length: state.limit }, (_, row) => {
    const guess = state.guesses[row];
    return guess
      ? (scoreGuess(answer, guess) as (LetterState | null)[])
      : (Array.from({ length: 5 }, () => null) as (LetterState | null)[]);
  });
}

export { MAX_GUESSES };
