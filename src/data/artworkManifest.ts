import { CAPTURED_ARTWORK, CLEARED_ARTWORK } from './artwork';
import type { GameEntry } from '../types';

/**
 * Artwork tiers, in order of strength of evidence:
 *  - verified: licensed or explicitly reuse-cleared image.
 *  - captured: artwork the game's own wrapper declares, or a title screen
 *    captured from the copy this repository serves. Identity-checked, no
 *    license claimed.
 *  - unavailable: no permitted image found; the UI shows a neutral placeholder
 *    instead of a broken or invented one.
 */
export type ArtworkStatus = 'verified' | 'captured' | 'unavailable';

export function artworkFor({ id, title }: Pick<GameEntry, 'id' | 'title'>) {
  const cleared = Object.prototype.hasOwnProperty.call(CLEARED_ARTWORK, id) ? CLEARED_ARTWORK[id] : undefined;
  if (cleared) return { ...cleared, id, title, status: 'verified' as const };
  const captured = Object.prototype.hasOwnProperty.call(CAPTURED_ARTWORK, id) ? CAPTURED_ARTWORK[id] : undefined;
  if (captured) return { ...captured, id, title, status: 'captured' as const };
  return { id, title, status: 'unavailable' as const, reason: 'No artwork available for this title yet.' };
}

export function artworkManifest(catalog: readonly GameEntry[]) {
  return catalog.map(artworkFor);
}
