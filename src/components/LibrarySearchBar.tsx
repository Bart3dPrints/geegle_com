// The library search field that lives inside the sticky top header.
//
// Suggestions are anchored directly below the field. Enter always commits the
// typed query, even while a suggestion is highlighted; only an explicit click
// launches a suggestion.

import { Search, X } from 'lucide-react';
import type { GameEntry } from '../types';
import { GameArt } from './GameArt';

export function LibrarySearchBar({
  input,
  query,
  suggestions,
  open,
  activeIndex,
  onInputChange,
  onSubmit,
  onClear,
  onFocus,
  onClose,
  onActiveIndexChange,
  onPick,
  placeholder,
  inputId,
}: {
  input: string;
  query: string;
  suggestions: GameEntry[];
  open: boolean;
  activeIndex: number;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocus: () => void;
  onClose: () => void;
  onActiveIndexChange: (index: number) => void;
  onPick: (entry: GameEntry) => void;
  placeholder: string;
  inputId: string;
}) {
  const listId = `${inputId}-suggestions`;
  return (
    <div className="relative w-full">
      <div className="geegle-field flex items-center gap-2 rounded-md border border-neutral-300 px-3 dark:border-[var(--geegle-border)]">
        <Search size={16} className="shrink-0 opacity-70" aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          className="h-9 w-full bg-transparent text-sm outline-none"
          placeholder={placeholder}
          aria-label="Search games, apps and proxies"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            } else if (event.key === 'Escape') {
              onClose();
              onActiveIndexChange(-1);
            } else if (event.key === 'ArrowDown' && suggestions.length > 0) {
              event.preventDefault();
              onActiveIndexChange((activeIndex + 1) % suggestions.length);
            } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
              event.preventDefault();
              onActiveIndexChange(activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1);
            }
          }}
        />
        {(input || query) && (
          <button
            type="button"
            className="rounded p-1 text-neutral-400 hover:text-neutral-700"
            onClick={onClear}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="card absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-y-auto p-1 shadow-lg"
        >
          {suggestions.map((entry, i) => (
            <li
              key={entry.id}
              id={`${listId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
            >
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded p-2 text-left ${
                  i === activeIndex
                    ? 'bg-neutral-100'
                    : 'hover:bg-neutral-50'
                }`}
                onClick={() => onPick(entry)}
              >
                <GameArt game={entry} className="h-8 w-12 shrink-0 rounded text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{entry.title}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-neutral-400">
                  {entry.kind === 'game' ? 'Game' : 'App'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
