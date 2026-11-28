// External services catalog: official embeds and backup sites with stable IDs.
// Each entry appears in multiple sections (Games + Apps) from ONE source of
// truth, so favorites/history/settings cannot diverge between sections.

import type { GameEntry } from '../types';

/**
 * Providers with EVIDENCE-BASED support for launching a supplied destination.
 *
 * Cherry: verified by direct fetch of all 5 mirror wrappers (they forward
 * `location.hash` to the loader: `iframe.src = "index.svg" + location.hash`)
 * and the loader parses a URL from the hash with fetch/status checks. Using
 * the hash form `#<encoded destination>` is the provider's own mechanism.
 *
 * Providers NOT listed have no evidence of a destination interface and are
 * excluded rather than guessed:
 * - Arctic: hardcoded app loader chain (no URL input path).
 * - Soluos: React dashboard with no destination parameter.
 * - Helios: user-input search launcher.
 * - Achroma/Bull-33/Backup: static landing pages, no documented interface.
 */

/** Official Krillion embed (documented at krillion.cc/embed-guide/). */
export const KRILLION: GameEntry = {
  id: 'krillion',
  title: 'Krillion',
  path: '/games/krillion.html',
  categories: ['puzzle', 'casual'],
  kind: 'game',
  aliases: ['one in a krillion', 'trivia', 'daily dive', 'rare answer'],
  thumb: 'https://krillion.cc/opengraph-image.png?opengraph-image.2nlv12kzc_1ph.png',
  source: 'Official embed, https://krillion.cc/embed-guide/',
  description: 'Official Krillion — Daily and Unlimited rare-answer trivia.',
};

/** Fan-made backup site. NOT presented as the official game. */
export const KRILLION_BACKUP: GameEntry = {
  id: 'clkrillion-backup',
  title: 'Krillion (Backup)',
  path: 'https://krillionunlimited.org/',
  categories: ['puzzle', 'casual'],
  kind: 'game',
  aliases: ['krillion unlimited', 'krillion backup', 'trivia backup'],
  thumb: 'https://krillionunlimited.org/og.png',
  source: 'External fan-made site (krillionunlimited.org); not affiliated with krillion.cc',
  description:
    'Independent fan-made Krillion-style trivia site. Not the official game.',
};

/** Entries shown in BOTH Games and Apps sections. */
export const DUAL_SECTION_ENTRIES: GameEntry[] = [
  KRILLION_BACKUP,
];
