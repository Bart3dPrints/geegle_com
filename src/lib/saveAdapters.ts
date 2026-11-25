export interface SaveSnapshot {
  format: 'geegle-local-v1';
  localStorage: Record<string, string>;
}

const games = [
  { id: 'clohflip', path: '/games/clohflip.html', keys: ['ohflip.goalIdx', 'ohflip.maxHeightFt', 'ohflip.maxTotalFlips'] },
  { id: 'clspacebarclicker', path: '/games/clspacebarclicker.html', keys: ['spacebar_clicker_game'] },
  { id: 'clquantumclicker', path: '/games/clQuantumClicker.html', keys: ['qcSave'] },
] as const;

export function adapterFor(gameId: string, path: string) {
  const game = games.find((entry) => entry.id === gameId && entry.path === path);
  if (!game) return null;

  return {
    launchPath(userId: string) {
      return `${path}?geegle_profile=${encodeURIComponent(userId)}`;
    },
    capture(userId: string): SaveSnapshot | null {
      const values: Record<string, string> = {};
      for (const key of game.keys) {
        const value = localStorage.getItem(`geegle-game:${gameId}:${userId}:${key}`);
        if (value !== null) values[key] = value;
      }
      return Object.keys(values).length ? { format: 'geegle-local-v1', localStorage: values } : null;
    },
    validate(snapshot: unknown): SaveSnapshot {
      if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid cloud save.');
      const { format, localStorage: values } = snapshot as { format: unknown; localStorage: unknown };
      if (format !== 'geegle-local-v1' && format !== 'v3') throw new Error('Unrecognized cloud save format.');
      if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid cloud save.');
      if ('indexedDB' in snapshot && (!Array.isArray(snapshot.indexedDB) || snapshot.indexedDB.length)) {
        throw new Error('This older save contains IndexedDB data. It was kept in the cloud but cannot be restored safely.');
      }
      const clean = Object.fromEntries(game.keys.flatMap((key) => {
        const value = (values as Record<string, unknown>)[key];
        if (value === undefined) return [];
        if (typeof value !== 'string') throw new Error('Invalid cloud save value.');
        return [[key, value]];
      }));
      if (!Object.keys(clean).length || Object.keys(values).length !== Object.keys(clean).length) {
        throw new Error('Cloud save contains unexpected game keys.');
      }
      return { format: 'geegle-local-v1', localStorage: clean };
    },
    restore(userId: string, snapshot: SaveSnapshot) {
      const backup = this.capture(userId);
      if (backup && JSON.stringify(backup) !== JSON.stringify(snapshot)) {
        // Keep progress when a player explicitly picks a different cloud version.
        localStorage.setItem(`geegle-game-backup:${gameId}:${userId}:${crypto.randomUUID()}`, JSON.stringify(backup));
      }
      for (const key of game.keys) {
        const scoped = `geegle-game:${gameId}:${userId}:${key}`;
        const value = snapshot.localStorage[key];
        if (value === undefined) localStorage.removeItem(scoped);
        else localStorage.setItem(scoped, value);
      }
    },
  };
}
