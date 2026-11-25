// External services catalog: official embeds and backup sites with stable IDs.
// Each entry appears in multiple sections (Games + Apps) from ONE source of
// truth, so favorites/history/settings cannot diverge between sections.

import type { GameEntry } from '../types';

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
  id: 'krillion-backup',
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

/** Everythingle puzzle collection: in-Geegle launcher with auto destination. */
export const EVERYTHINGLE: GameEntry = {
  id: 'everythingle',
  title: 'Everythingle',
  // Same-origin launcher page: frames everythingle.com with the destination
  // pre-supplied (no manual URL entry), keeps the Geegle player interface
  // (Back / Reload / Fullscreen), and falls back to open-in-new-tab if the
  // site refuses framing. No Geegle credentials are passed to the site.
  path: '/games/everythingle.html',
  categories: [],
  kind: 'app',
  aliases: ['wordle unlimited', 'globle', 'worldle', 'puzzle collection', 'chess'],
  thumb: 'https://everythingle.com/icon-512.png',
  source: 'External site (everythingle.com) framed via Geegle launcher',
  description: 'Free unlimited Wordle, Globle, Worldle, chess and more.',
};

/** Entries shown in BOTH Games and Apps sections. */
export const DUAL_SECTION_ENTRIES: GameEntry[] = [
  KRILLION_BACKUP,
];
