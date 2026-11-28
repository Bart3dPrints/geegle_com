// Compact live visitor count for the library header: a small dot and the real
// number of connected people. It never invents a number — while presence is
// unknown or unavailable it shows a dash.

import type { PresenceStatus } from '../hooks/useSocialPresence';

export function VisitorCounter({
  status,
  visitors,
}: {
  status: PresenceStatus;
  visitors: number | null;
}) {
  const live = status === 'live' && visitors !== null;
  const label = live ? `${visitors} online` : 'Visitors unavailable';

  return (
    <span
      className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400"
      title={live ? `${visitors} ${visitors === 1 ? 'person is' : 'people are'} online now` : label}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          live ? 'bg-emerald-500' : 'bg-neutral-400 dark:bg-neutral-600'
        }`}
      />
      {live ? visitors : '—'}
    </span>
  );
}
