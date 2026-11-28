// Everythingle: an original unlimited five-letter word puzzle that runs
// entirely inside Geegle. There is no external site, proxy choice or server
// dependency; the word list, scoring and progress are local to this app.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Delete, Maximize2 } from 'lucide-react';
import {
  EMPTY_STATS,
  MAX_GUESSES,
  WORD_LENGTH,
  letterHints,
  parsePuzzleState,
  parseStats,
  roundsStats,
  scoreGuess,
  startRound,
  submitGuess,
  type LetterState,
  type PuzzleStats,
  type PuzzleState,
} from '../lib/wordPuzzle';

const MESSAGES = {
  short: `Enter a ${WORD_LENGTH}-letter word.`,
  unknown: 'Not in the word list.',
  finished: 'This round is finished.',
} as const;

function storageKey(userId: string | null): string {
  return `geegle-everythingle:${userId ?? 'guest'}`;
}

function readSaved(userId: string | null): { state: PuzzleState | null; stats: PuzzleStats } {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      state: parsePuzzleState(parsed?.state),
      stats: parseStats(parsed?.stats),
    };
  } catch {
    return { state: null, stats: EMPTY_STATS };
  }
}

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const TILE_CLASS: Record<LetterState | 'empty', string> = {
  correct: 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900',
  present: 'border-neutral-400 bg-neutral-400 text-neutral-950 dark:border-neutral-500 dark:bg-neutral-500 dark:text-neutral-950',
  absent: 'border-neutral-300 bg-neutral-200 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  empty: 'border-neutral-300 bg-transparent text-neutral-900 dark:border-neutral-700 dark:text-neutral-100',
};

export function EverythingleApp({
  userId,
  onExit,
}: {
  userId: string | null;
  onExit: () => void;
}) {
  const saved = useMemo(() => readSaved(userId), [userId]);
  const [state, setState] = useState<PuzzleState>(
    () => saved.state ?? startRound(1)
  );
  const [stats, setStats] = useState<PuzzleStats>(saved.stats);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Progress survives a reload for this account (or guest) on this device.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify({ state, stats }));
    } catch {
      /* Storage may be disabled; the round still works in memory. */
    }
  }, [state, stats, userId]);

  const hints = useMemo(() => letterHints(state), [state]);

  const play = useCallback(
    (raw: string) => {
      const result = submitGuess(state, raw);
      if (!result.ok) {
        setMessage(MESSAGES[result.reason]);
        return;
      }
      setMessage(null);
      setDraft('');
      setState(result.state);
      setStats((current) => roundsStats(current, result.state.status));
    },
    [state]
  );

  const typeLetter = useCallback((letter: string) => {
    setMessage(null);
    setDraft((current) => (current.length >= WORD_LENGTH ? current : current + letter));
  }, []);

  const backspace = useCallback(() => {
    setMessage(null);
    setDraft((current) => current.slice(0, -1));
  }, []);

  // Physical keyboard: letters, Backspace and Enter, the usual puzzle controls.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        play(draft);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) typeLetter(event.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [backspace, draft, onExit, play, typeLetter]);

  const nextRound = () => {
    const round = state.round + 1;
    const next = startRound(round, `geegle-${round}-${userId ?? 'guest'}`);
    setState(next);
    setDraft('');
    setMessage(null);
  };

  const finished = state.status !== 'playing';
  const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const rows = Array.from({ length: MAX_GUESSES }, (_, row) => row);
  const button =
    'rounded-md border border-neutral-300 bg-neutral-100 p-2 text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700';

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16">
        <div
          className="grid w-full gap-1.5"
          role="grid"
          aria-label="Guesses"
          data-status={state.status}
          data-round={state.round}
        >
          {rows.map((row) => {
            const guess = state.guesses[row] ?? (row === state.guesses.length ? draft : '');
            const scores = state.guesses[row]
              ? scoreGuess(state.answer, guess)
              : Array<LetterState | null>(WORD_LENGTH).fill(null);
            return (
              <div className="grid grid-cols-5 gap-1.5" role="row" key={row}>
                {Array.from({ length: WORD_LENGTH }, (_, column) => {
                  const letter = guess[column] ?? '';
                  const score = scores[column];
                  return (
                    <div
                      key={column}
                      role="gridcell"
                      data-state={score ?? (letter ? 'draft' : 'empty')}
                      aria-label={letter ? `${letter}${score ? `, ${score}` : ''}` : 'empty'}
                      className={`flex aspect-square items-center justify-center rounded-md border text-2xl font-semibold uppercase ${TILE_CLASS[score ?? 'empty']}`}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="h-5 text-center text-xs" role="status" aria-live="polite">
          {message && <span className="text-neutral-300">{message}</span>}
          {!message && finished && (
            <span className="text-neutral-300">
              {state.status === 'won' ? 'Solved' : `The word was ${state.answer.toUpperCase()}`}
            </span>
          )}
        </div>

        {finished ? (
          <button className="btn-primary" onClick={nextRound}>
            Next puzzle
          </button>
        ) : (
          <div className="w-full space-y-1.5" aria-label="Keyboard">
            {KEYS.map((row) => (
              <div key={row} className="flex justify-center gap-1">
                {row.split('').map((letter) => {
                  const hint = hints[letter];
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => typeLetter(letter)}
                      data-hint={hint ?? 'unused'}
                      className={`h-11 w-8 rounded border text-sm font-medium uppercase ${
                        hint === 'correct'
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                          : hint === 'present'
                            ? 'border-neutral-400 bg-neutral-400 text-neutral-950'
                            : hint === 'absent'
                              ? 'border-neutral-700 bg-neutral-800 text-neutral-500'
                              : 'border-neutral-600 bg-neutral-900 text-neutral-100'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="flex justify-center gap-1">
              <button type="button" className="btn-secondary h-11 px-3" onClick={backspace} aria-label="Delete letter">
                <Delete size={16} />
              </button>
              <button type="button" className="btn-primary h-11 px-5" onClick={() => play(draft)}>
                Enter
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-neutral-400">
          {stats.played} played · {winRate}% won · {stats.streak} streak · {stats.bestStreak} best
        </p>
      </div>

      <div className="absolute bottom-3 left-3 z-20">
        <button className={button} onClick={onExit} aria-label="Back to Apps">
          <ArrowLeft size={16} />
        </button>
      </div>
      <div className="absolute right-3 top-3 z-20">
        <button
          className={button}
          onClick={() => rootRef.current?.requestFullscreen?.()}
          aria-label="Fullscreen"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
