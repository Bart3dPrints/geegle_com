// Geegle's own word-board games: one board, two, four, or counts-only.
//
// Original code and original word data (src/lib/wordPuzzle.ts). These are
// Geegle implementations of familiar word-game formats, not copies of any
// provider's build, and they run entirely locally.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Delete, Maximize2 } from 'lucide-react';
import { letterHints, type LetterState } from '../../lib/wordPuzzle';
import {
  boardRows,
  multiBoardStatus,
  scoreCounts,
  startBoards,
  submitBoardGuess,
  type MultiBoardState,
} from '../../lib/wordGames';

export type BoardVariant = 'single' | 'dordle' | 'quordle' | 'word500';

const RULES: Record<BoardVariant, { boards: number; limit: number }> = {
  single: { boards: 1, limit: 6 },
  dordle: { boards: 2, limit: 7 },
  quordle: { boards: 4, limit: 9 },
  word500: { boards: 1, limit: 8 },
};

const STORAGE_PREFIX = 'geegle-word-boards:v1:';

const TILE_CLASS: Record<LetterState | 'empty', string> = {
  correct: 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900',
  present: 'border-neutral-400 bg-neutral-400 text-neutral-950 dark:border-neutral-500 dark:bg-neutral-500 dark:text-neutral-950',
  absent: 'border-neutral-300 bg-neutral-200 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
  empty: 'border-neutral-300 bg-transparent text-neutral-900 dark:border-neutral-700 dark:text-neutral-100',
};

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface Saved {
  answers: string[];
  guesses: string[];
  round: number;
}

function readSaved(variant: BoardVariant): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + variant);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (!Array.isArray(parsed.answers) || !Array.isArray(parsed.guesses)) return null;
    const answers = parsed.answers.filter((a): a is string => typeof a === 'string' && /^[a-z]{5}$/.test(a));
    const guesses = parsed.guesses.filter((g): g is string => typeof g === 'string' && /^[a-z]{5}$/.test(g));
    if (answers.length !== RULES[variant].boards) return null;
    return {
      answers,
      guesses,
      round: Number.isInteger(parsed.round) && (parsed.round as number) >= 1 ? (parsed.round as number) : 1,
    };
  } catch {
    return null;
  }
}

function freshState(variant: BoardVariant, round: number): MultiBoardState {
  return startBoards(RULES[variant].boards, round, `geegle-${variant}`, RULES[variant].limit);
}

export function WordBoards({
  variant,
  title,
  onExit,
}: {
  variant: BoardVariant;
  title: string;
  onExit: () => void;
}) {
  const rules = RULES[variant];
  const saved = useMemo(() => readSaved(variant), [variant]);
  const [round, setRound] = useState(saved?.round ?? 1);
  const [state, setState] = useState<MultiBoardState>(() =>
    saved ? { answers: saved.answers, guesses: saved.guesses, limit: rules.limit } : freshState(variant, 1)
  );
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_PREFIX + variant,
        JSON.stringify({ answers: state.answers, guesses: state.guesses, round })
      );
    } catch {
      /* Storage may be disabled; the round still works in memory. */
    }
  }, [round, state, variant]);

  const counts = variant === 'word500';
  const status = multiBoardStatus(state.answers, state.guesses, rules.limit);
  const finished = status !== 'playing';

  const play = useCallback(
    (raw: string) => {
      const result = submitBoardGuess(state, raw);
      if (!result.ok) {
        setMessage(
          result.reason === 'short'
            ? 'Enter a five-letter word.'
            : result.reason === 'unknown'
              ? 'Not in the word list.'
              : 'This round is finished.'
        );
        return;
      }
      setMessage(null);
      setDraft('');
      setState(result.state);
    },
    [state]
  );

  const typeLetter = useCallback((letter: string) => {
    setMessage(null);
    setDraft((current) => (current.length >= 5 ? current : current + letter));
  }, []);

  const backspace = useCallback(() => {
    setMessage(null);
    setDraft((current) => current.slice(0, -1));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!finished) play(draft);
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
  }, [backspace, draft, finished, onExit, play, typeLetter]);

  const nextRound = () => {
    const upcoming = round + 1;
    setRound(upcoming);
    setState(freshState(variant, upcoming));
    setDraft('');
    setMessage(null);
  };

  const hints = useMemo<Record<string, LetterState>>(() => {
    if (state.answers.length !== 1) return {};
    return letterHints({ answer: state.answers[0], guesses: state.guesses, status, round });
  }, [round, state.answers, state.guesses, status]);

  const button =
    'rounded-md border border-neutral-300 bg-white p-2 text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700';
  const tileSize = rules.boards === 4 ? 'text-base' : rules.boards === 2 ? 'text-xl' : 'text-2xl';

  return (
    <div ref={rootRef} className="fixed inset-0 z-[60] overflow-y-auto bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-16">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{title}</h2>

        {counts ? (
          <div className="w-full space-y-1.5" role="list" aria-label="Guesses">
            {Array.from({ length: rules.limit }, (_, row) => {
              const guess = state.guesses[row];
              const result = guess ? scoreCounts(state.answers[0], guess) : null;
              return (
                <div
                  key={row}
                  role="listitem"
                  data-state={result ? (guess === state.answers[0] ? 'correct' : 'guessed') : 'empty'}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                >
                  <span className="font-mono uppercase tracking-[0.3em]">{guess ?? ''}</span>
                  {result ? (
                    <span className="flex gap-3 tabular-nums text-xs">
                      <span data-count="correct">{result.correct} green</span>
                      <span data-count="present">{result.present} yellow</span>
                      <span data-count="absent">{result.absent} red</span>
                    </span>
                  ) : row === state.guesses.length ? (
                    <span className="font-mono uppercase tracking-[0.3em] text-neutral-400">{draft}</span>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`grid w-full gap-2 ${rules.boards === 1 ? '' : rules.boards === 2 ? 'sm:grid-cols-2' : 'grid-cols-2'}`}
            aria-label="Boards"
          >
            {state.answers.map((answer, board) => {
              const solved = state.guesses.includes(answer);
              return (
                <div
                  key={answer}
                  className={`space-y-1 ${rules.boards > 1 ? 'rounded-md border border-neutral-200 p-2 dark:border-neutral-800' : ''}`}
                  data-board={board}
                  data-solved={solved}
                >
                  {boardRows(state, answer).map((row, rowIndex) => (
                    <div className="grid grid-cols-5 gap-1" role="row" key={rowIndex}>
                      {(row.length ? row : Array.from({ length: 5 }, () => null)).map((score, column) => {
                        const guess =
                          state.guesses[rowIndex] ?? (rowIndex === state.guesses.length ? draft : '');
                        const letter = guess[column] ?? '';
                        return (
                          <div
                            key={column}
                            role="gridcell"
                            data-state={score ?? (letter ? 'draft' : 'empty')}
                            className={`flex aspect-square items-center justify-center rounded border font-semibold uppercase ${tileSize} ${TILE_CLASS[score ?? 'empty']}`}
                          >
                            {letter}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="h-5 text-center text-xs" role="status" aria-live="polite">
          {message && <span className="text-neutral-600 dark:text-neutral-300">{message}</span>}
          {!message && finished && (
            <span className="text-neutral-600 dark:text-neutral-300">
              {status === 'won'
                ? counts || state.answers.length === 1
                  ? 'Solved'
                  : 'All boards solved'
                : counts || state.answers.length === 1
                  ? `The word was ${state.answers[0].toUpperCase()}`
                  : `The words were ${state.answers.map((a) => a.toUpperCase()).join(', ')}`}
            </span>
          )}
        </div>

        {finished ? (
          <button className="btn-primary" onClick={nextRound}>
            Next {counts ? 'word' : 'round'}
          </button>
        ) : (
          <div className="w-full max-w-md space-y-1.5">
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
                      className={`h-10 w-7 rounded border text-xs font-medium uppercase sm:h-11 sm:w-8 sm:text-sm ${
                        hint === 'correct'
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                          : hint === 'present'
                            ? 'border-neutral-400 bg-neutral-400 text-neutral-950'
                            : hint === 'absent'
                              ? 'border-neutral-300 bg-neutral-200 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500'
                              : 'border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="flex justify-center gap-1">
              <button type="button" className="btn-secondary h-10 px-3" onClick={backspace} aria-label="Delete letter">
                <Delete size={16} />
              </button>
              <button type="button" className="btn-primary h-10 px-5" onClick={() => play(draft)}>
                Enter
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          {state.guesses.length} of {rules.limit} guesses
        </p>
      </div>

      <div className="absolute bottom-3 left-3 z-20">
        <button className={button} onClick={onExit} aria-label="Back to Everythingle">
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
