// One editable development announcement. To publish a new announcement, give it
// a new id and replace the text; dismissals are remembered per id, so the new
// one appears for everyone again.

export const ANNOUNCEMENT_ID = 'run-2-development';

export const ANNOUNCEMENT_TITLE = 'Geegle is under active development';

export const ANNOUNCEMENT_BODY = [
  'Found a bug, have a suggestion, or want a new feature added? Let me know!',
  'I review feedback every 1–2 weeks and implement suggestions whenever possible.',
] as const;

/** The Suggestions form already used by the Suggestions app. */
export const FEEDBACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfjOZWlYqoxI-wwxf7BaKjXYN7IGCc1ksge9FME5LBv852Jew/viewform';

export const FEEDBACK_LABEL = 'Give feedback';

function storageKey(userId: string | null): string {
  return `geegle-announcement-dismissed:${userId ?? 'guest'}`;
}

export function announcementDismissed(userId: string | null): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === ANNOUNCEMENT_ID;
  } catch {
    return false;
  }
}

export function dismissAnnouncement(userId: string | null): void {
  try {
    localStorage.setItem(storageKey(userId), ANNOUNCEMENT_ID);
  } catch {
    /* Storage may be disabled; it stays dismissed for this visit. */
  }
}
