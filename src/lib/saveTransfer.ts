import { supabase, T } from './supabase';
import { loadFavorites, loadRecent, loadServerDefaults, loadTheme } from './userData';

export async function readCloudSaveArchive(userId: string) {
  const rows: unknown[] = [];
  let after = '';
  for (;;) {
    let query = supabase.from(T.saves).select('id,game_id,save_key,save_data,updated_at')
      .eq('user_id', userId).order('id').limit(25);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(10_000));
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data);
    const next = data[data.length - 1].id;
    if (!next || next === after) throw new Error('The cloud archive could not be paginated safely.');
    after = next;
  }
}

export async function readDevicePreferences() {
  const [favorites, recent, theme, serverDefaults] = await Promise.all([
    loadFavorites(null), loadRecent(null), loadTheme(null), loadServerDefaults(null),
  ]);
  return { favorites: favorites.data ?? [], recentlyPlayed: recent.data ?? [], theme: theme.data ?? 'system', serverDefaults: serverDefaults.data ?? {} };
}

export function downloadArchive(name: string, archive: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
