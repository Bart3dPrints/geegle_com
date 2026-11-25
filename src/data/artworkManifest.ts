import { CLEARED_ARTWORK } from './artwork';
import type { GameEntry } from './types';

export function artworkFor({ id, title }: Pick<GameEntry, 'id' | 'title'>) {
  const artwork = Object.prototype.hasOwnProperty.call(CLEARED_ARTWORK, id) ? CLEARED_ARTWORK[id] : undefined;
  return artwork
    ? { ...artwork, id, title, status: 'verified' as const }
    : { id, title, status: 'unavailable' as const, reason: 'No artwork cleared for reuse.' };
}

export function artworkManifest(catalog: readonly GameEntry[]) {
  return catalog.map(artworkFor);
}
