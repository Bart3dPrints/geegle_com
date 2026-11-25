export const KRILLION_BACKUP_ID = 'clkrillion-backup';
const LEGACY_KRILLION_BACKUP_ID = 'krillion-backup';

export function canonicalGameId(id: string): string {
  return id === LEGACY_KRILLION_BACKUP_ID ? KRILLION_BACKUP_ID : id;
}

export function equivalentGameIds(id: string): string[] {
  return canonicalGameId(id) === KRILLION_BACKUP_ID
    ? [KRILLION_BACKUP_ID, LEGACY_KRILLION_BACKUP_ID]
    : [id];
}

export function distinctGameIds(ids: string[]): string[] {
  return [...new Set(ids.map(canonicalGameId))];
}

export function distinctGameEntries<T extends { id: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.filter(({ id }) => {
    const key = canonicalGameId(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
