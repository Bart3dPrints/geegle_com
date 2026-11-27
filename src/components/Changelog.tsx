// Release history: merged pull requests only, with the real merge date and
// Eastern time. Both sort directions are offered; newest first is the default.
// Plain grayscale text, no decoration.

import { useMemo, useState } from 'react';
import data from '../data/changelog.json';
import { formatEastern, type ChangelogEntry } from '../lib/changelog';

const ENTRIES = (data.entries as ChangelogEntry[]).filter(
  (entry) => entry.mergedAt && entry.summary && Number.isInteger(entry.pr)
);

type SortOrder = 'newest' | 'oldest';

export function Changelog() {
  const [order, setOrder] = useState<SortOrder>('newest');

  const entries = useMemo(() => {
    const sorted = [...ENTRIES].sort((a, b) => {
      const delta = Date.parse(a.mergedAt) - Date.parse(b.mergedAt);
      return delta !== 0 ? delta : a.pr - b.pr;
    });
    return order === 'newest' ? sorted.reverse() : sorted;
  }, [order]);

  return (
    <section aria-labelledby="settings-changelog">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 id="settings-changelog" className="text-sm font-medium">
          Changelog
        </h3>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="changelog-order">
            Sort releases
          </label>
          <select
            id="changelog-order"
            className="input w-auto py-1 text-xs"
            value={order}
            onChange={(event) => setOrder(event.target.value as SortOrder)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>
      <ol className="space-y-4">
        {entries.map((entry) => {
          const { date, time } = formatEastern(entry.mergedAt);
          return (
            <li
              key={entry.pr}
              className="border-b border-neutral-200 pb-4 last:border-0 last:pb-0 dark:border-neutral-700"
            >
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                <time dateTime={entry.mergedAt}>{date}</time>
                <span aria-hidden="true"> · </span>
                <span>{time}</span>
              </p>
              <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                {entry.summary}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
