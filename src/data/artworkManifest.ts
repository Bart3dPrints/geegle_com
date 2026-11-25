import { VERIFIED_ARTWORK } from './artwork';
import type { GameEntry } from './types';

type VerifiedArtwork = (typeof VERIFIED_ARTWORK)[keyof typeof VERIFIED_ARTWORK];
const verified: Partial<Record<string, VerifiedArtwork>> = VERIFIED_ARTWORK;

export function artworkFor({ id, title }: Pick<GameEntry, 'id' | 'title'>) {
  const artwork = verified[id];
  return artwork
    ? { ...artwork, id, title, status: 'verified' as const }
    : { id, title, status: 'unverified' as const, reason: 'No image verified yet.' };
}

export function artworkManifest(catalog: readonly GameEntry[]) {
  return catalog.map(artworkFor);
}
