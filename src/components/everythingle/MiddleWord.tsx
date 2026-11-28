// Middle Word: find the hidden word that sits alphabetically between the two
// words shown. Geegle's own implementation, using its own word list.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { MIDDLE_MAX_GUESSES, makeMiddleRound, middleHint, type MiddleRound } from '../../lib/wordGames';

const STORAGE_KEY = 'geegle-middle-word:v1';

interface Saved {
  round: MiddleRound;
  guesses: { word: string; kind: 'before' | 'after'; distance: number }[];
  number: number;
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Saved;
    if (!parsed?.round?.left || !parsed?.round?.right || !parsed?.round?.answer) return null;
    if (!Array.isArray(parsed.guesses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function MiddleWord({ onExit }: { onExit: () => void }) {
  const saved = useMemo(readSaved, []);
  const [number, setNumber] = useState(saved?.number ?? 1);
  const [round, setRound] = useState<MiddleRound>(() => saved?.round ?? makeMiddleRound(1));
  const [guesses, setGuesses] = useState(saved?.guesses ?? []);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ round, guesses, number }));
    } catch {
      /* Storage may be disabled; the round still works in memory. */
    }
  }, [guesses, number, round]);

  const solved = guesses.some((entry) => entry.word === round.answer);
  const finished = solved || guesses.length >= MIDDLE_MAX_GUESSES;

  const submit = useCallback(() => {
    const hint = middleHint(round, draft);
    if (hint.kind === 'unknown') {
      setMessage('Not in the word list.');
      return;
    }
    if (hint.kind === 'correct') {
      setMessage(null);
      setGuesses((current) => [...current, { word: round.answer, kind: 'after', distance: 0 }]);
      setDraft('');
      return;
    }
    setMessage(null);
    setGuesses((current) => [...current, { word: draft.trim().toLowerCase(), kind: hint.kind, distance: hint.distance }]);
    setDraft('');
  }, [draft, round]);

  const next = () => {
    const upcoming = number + 1;
    setNumber(upcoming);
    setRound(makeMiddleRound(upcoming));
    setGuesses([]);
    setDraft('');
    setMessage(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const button =
    'rounded-md border border-neutral-300 bg-white p-2 text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700';

  return (
    <div ref={rootRef} className="fixed inset-0 z-[60] overflow-y-auto bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-5 px-4 py-16">
        <div className="text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Guess {Math.min(guesses.length + (finished ? 0 : 1), MIDDLE_MAX_GUESSES)} of {MIDDLE_MAX_GUESSES}
          </p>
          <div className="mt-2 flex items-center justify-center gap-3 text-lg font-semibold uppercase tracking-wide">
            <span data-bound="left">{round.left}</span>
            <span aria-hidden="true" className="text-neutral-400">
              …
            </span>
            <span data-bound="right">{round.right}</span>
          </div>
        </div>

        <div className="w-full space-y-1" role="list" aria-label="Guesses">
          {guesses.map((entry, index) => (
            <div
              key={`${entry.word}-${index}`}
              role="listitem"
              className="flex items-center justify-between rounded border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-800"
            >
              <span className="font-mono uppercase">{entry.word}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {entry.word === round.answer
                  ? 'correct'
                  : `${entry.kind} · ${entry.distance} word${entry.distance === 1 ? '' : 's'} away`}
              </span>
            </div>
          ))}
          {!finished && (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <input
                className="input flex-1 font-mono uppercase"
                value={draft}
                onChange={(event) => {
                  setMessage(null);
                  setDraft(event.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 15));
                }}
                placeholder="Type a word"
                aria-label="Your word"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn-primary" type="submit">
                Guess
              </button>
            </form>
          )}
        </div>

        <div className="h-5 text-center text-xs" role="status" aria-live="polite">
          {message && <span className="text-neutral-600 dark:text-neutral-300">{message}</span>}
          {!message && finished && (
            <span className="text-neutral-600 dark:text-neutral-300">
              {solved ? `Solved in ${guesses.length}` : `The word was ${round.answer.toUpperCase()}`}
            </span>
          )}
        </div>

        {finished && (
          <button className="btn-primary" onClick={next}>
            Next word
          </button>
        )}
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
