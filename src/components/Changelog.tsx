// Release history: merged pull requests only, newest first, with the real
// merge date and Eastern time. Plain grayscale text, no decoration.

import data from '../data/changelog.json';
import { formatEastern, type ChangelogEntry } from '../lib/changelog';

const ENTRIES = (data.entries as ChangelogEntry[]).filter(
  (entry) => entry.mergedAt && entry.summary && Number.isInteger(entry.pr)
);

export function Changelog() {
  return (
    <section aria-labelledby="settings-changelog">
      <h3 id="settings-changelog" className="mb-1 text-sm font-medium">
        Changelog
      </h3>
      <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
        Newest first. Times are Eastern.
      </p>
      <ol className="space-y-4">
        {ENTRIES.map((entry) => {
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
