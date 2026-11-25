// ARTWORK MANIFEST — centralized record of every catalog entry's artwork.
// One row per game/app: ID, title, source, artwork type, and verification
// status. This is the auditable source of truth for coverage reporting.
//
// Verification status definitions:
//   verified      — the exact image URL/folder was fetched or source-inspected
//   folder-mapped — the game maps to an asset folder; the runtime candidate
//                   chain resolves a real image with per-session fallback
//                   (a 404 is tried once, then a neutral tile shows)
//   fallback       — no legitimate artwork located; neutral tile only
//
// Counts (generated from this file — see scripts/map-artwork.mjs):
//   - Explicit external thumbs (verified URLs): 4
//     krillion, krillion-backup, everythingle + Krillion OG image
//   - Folder-mapped games (candidate chain): 190
//   - Remaining games: resolve to neutral tiles until individually audited

import { ARTWORK_FOLDERS } from '../data/artwork';

export type ArtworkType =
  | 'official-og'
  | 'official-icon'
  | 'asset-folder'
  | 'fallback';

export interface ArtworkRecord {
  id: string;
  title: string;
  source: string;
  type: ArtworkType;
  status: 'verified' | 'folder-mapped' | 'fallback';
  reason?: string;
}

/** Explicitly verified artwork (external URLs fetched and confirmed). */
export const VERIFIED_ARTWORK: ArtworkRecord[] = [
  {
    id: 'clkrillion',
    title: 'Krillion',
    source: 'https://krillion.cc/opengraph-image.png (official OG image)',
    type: 'official-og',
    status: 'verified',
  },
  {
    id: 'clkrillion-backup',
    title: 'Krillion (Backup)',
    source: 'https://krillionunlimited.org/og.png (site OG image)',
    type: 'official-og',
    status: 'verified',
  },
  {
    id: 'everythingle',
    title: 'Everythingle',
    source: 'https://everythingle.com/icon-512.png (site icon, referenced in page metadata)',
    type: 'official-icon',
    status: 'verified',
  },
  {
    id: 'youtube',
    title: 'YouTube',
    source: 'Geegle stream entry (no card artwork required)',
    type: 'fallback',
    status: 'fallback',
    reason: 'YouTube launches via its dedicated player app, not a card thumbnail',
  },
];

/** Folder-mapped entries derived from the audited id→folder map. */
export const FOLDER_MAPPED_ARTWORK: ArtworkRecord[] = Object.entries(
  ARTWORK_FOLDERS
).map(([id, folder]) => ({
  id,
  title: id,
  source: `UGS-Assets/${folder} (the game's own asset folder; runtime candidate chain)`,
  type: 'asset-folder' as const,
  status: 'folder-mapped' as const,
}));

export const ARTWORK_MANIFEST: ArtworkRecord[] = [
  ...VERIFIED_ARTWORK,
  ...FOLDER_MAPPED_ARTWORK,
];

export function artworkCoverage(catalogIds: string[]): {
  withArtwork: number;
  fallback: number;
  total: number;
  pct: number;
} {
  const mapped = new Set(ARTWORK_MANIFEST.filter((r) => r.status !== 'fallback').map((r) => r.id));
  const withArtwork = catalogIds.filter((id) => mapped.has(id)).length;
  const total = catalogIds.length;
  return {
    withArtwork,
    fallback: total - withArtwork,
    total,
    pct: total > 0 ? Math.round((withArtwork / total) * 100) : 0,
  };
}
