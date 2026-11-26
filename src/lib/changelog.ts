// Release history for the Settings → Changelog tab.
//
// The committed snapshot in `src/data/changelog.json` is regenerated from the
// repository's merged pull requests at build time (see
// `scripts/generate-changelog.mjs`). This module owns the rules that keep the
// list correct: only merged work, one entry per PR number, newest first, and
// real merge times shown in Eastern Time.

export type ChangelogEntry = {
  /** Pull request number; the stable key that prevents duplicates. */
  pr: number;
  /** ISO merge timestamp from GitHub. */
  mergedAt: string;
  /** Short, user-facing summary. */
  summary: string;
};

export type PullSummary = {
  number: number;
  title: string;
  merged_at: string | null;
};

const EASTERN = 'America/New_York';

/**
 * Merge timestamp as Eastern date and clock time. The IANA zone applies the
 * daylight-saving rule for that instant, so winter releases read EST and
 * summer releases read EDT.
 */
export function formatEastern(iso: string): { date: string; time: string } {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return {
    date: `${part('month')} ${part('day')}, ${part('year')}`,
    time: `${part('hour')}:${part('minute')} ${part('dayPeriod')} ${part('timeZoneName')}`,
  };
}

/**
 * Turns the closed-pull response into release entries. Unmerged pull requests
 * never appear, a repeated PR number is collapsed to one entry, and the list
 * is ordered newest first.
 */
export function mergedPullEntries(
  pulls: PullSummary[],
  notes: Record<string, string> = {}
): ChangelogEntry[] {
  const seen = new Map<number, ChangelogEntry>();
  for (const pull of pulls) {
    if (!pull.merged_at || !Number.isInteger(pull.number)) continue;
    if (seen.has(pull.number)) continue;
    if (!Number.isFinite(Date.parse(pull.merged_at))) continue;
    const written = notes[String(pull.number)]?.trim();
    seen.set(pull.number, {
      pr: pull.number,
      mergedAt: pull.merged_at,
      summary: written && written.length > 0 ? written : pull.title.trim(),
    });
  }
  return [...seen.values()].sort((a, b) => {
    const delta = Date.parse(b.mergedAt) - Date.parse(a.mergedAt);
    return delta !== 0 ? delta : b.pr - a.pr;
  });
}
