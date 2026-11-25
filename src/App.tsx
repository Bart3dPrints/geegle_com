// Geegle application shell — the redesigned main interface.
// Sections: entry gate → header (brand, nav, search, theme, account) →
// browse tabs (games by category, apps, proxies) → game player overlay.
//
// NOTE: This file is written in two passes only because of tool payload
// limits; the committed result is one coherent file. Part 2 appends the
// auth modal, search, player, and main content after the header.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  User as UserIcon,
  LogOut,
  Sun,
  Moon,
  Monitor,
  KeyRound,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { GameEntry, ThemePreference } from './types';
import { legacyCatalog } from './data/catalog';
import { CATEGORIES } from './data/types';
import { PROXY_SERVICES, proxyUrl } from './data/proxies';
import { isEntryUnlocked, verifyEntryPassword } from './lib/entryGate';
import { useAuth } from './hooks/useAuth';
import {
  toggleFavorite,
  loadFavorites,
  trackPlay,
  loadRecent,
  saveTheme,
  loadTheme,
  saveServerDefault,
  loadServerDefaults,
} from './lib/userData';
import { GameCard, EmptyState } from './components/GameCard';
import { SearchOverlay } from './components/SearchOverlay';
import { GamePlayer } from './components/GamePlayer';
import { ProxyCard } from './components/ProxyCard';
import { YouTubeApp } from './components/YouTubeApp';

// Apps curated separately from the legacy game catalog.
const APPS: GameEntry[] = [
  {
    id: 'youtube',
    title: 'YouTube',
    path: '',
    categories: [],
    kind: 'stream',
    aliases: ['yt', 'videos', 'streaming', 'stream'],
    source: 'Official YouTube privacy-enhanced embed (youtube-nocookie.com)',
    description: 'Play any YouTube video via the official embed.',
  },
  {
    id: 'suggestions',
    title: 'Suggestions',
    path: '/games/suggestions.html',
    categories: [],
    kind: 'app',
    aliases: ['request', 'feedback', 'ideas'],
  },
  {
    id: 'code-editor',
    title: 'Code Editor',
    path: '/games/Code%20Editor%20(1).html',
    categories: [],
    kind: 'app',
    aliases: ['vscode', 'editor', 'programming'],
  },
  {
    id: 'soundboard',
    title: 'Soundboard',
    path: '/games/Soundboard.html',
    categories: [],
    kind: 'app',
    aliases: ['sounds', 'sfx'],
  },
];

const SEARCHABLE = [...legacyCatalog, ...APPS];

type Tab = 'games' | 'apps' | 'proxies';

function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    try {
      const stored = localStorage.getItem('geegle-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return { theme, setTheme };
}

export default function App() {
  const [gateOpen, setGateOpen] = useState(!isEntryUnlocked());
  const [gateInput, setGateInput] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const { theme, setTheme } = useTheme();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [serverDefaults, setServerDefaults] = useState<Record<string, number>>({});
  const [syncError, setSyncError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('games');
  const [category, setCategory] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [active, setActive] = useState<GameEntry | null>(null);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [activeProxy, setActiveProxy] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (auth.loading) return;
    (async () => {
      const [f, r, servers, savedTheme] = await Promise.all([
        loadFavorites(userId),
        loadRecent(userId),
        loadServerDefaults(userId),
        loadTheme(userId),
      ]);
      if (f.ok && f.data) setFavorites(f.data);
      else if (f.error) setSyncError(f.error);
      if (r.ok && r.data) setRecent(r.data);
      else if (r.error) setSyncError(r.error);
      if (servers.ok && servers.data) setServerDefaults(servers.data);
      else if (servers.error) setSyncError(servers.error);
      const t = savedTheme.data;
      if (savedTheme.ok && (t === 'dark' || t === 'light')) setTheme(t);
      else if (savedTheme.error) setSyncError(savedTheme.error);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, userId]);

  const handleAuth = async (mode: 'login' | 'register') => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const error =
        mode === 'login'
          ? await auth.signIn(authUsername, authPassword)
          : await auth.signUp(authUsername, authPassword);
      if (error) setAuthError(error);
      else {
        setAuthOpen(false);
        setAuthPassword('');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const launch = useCallback(
    async (g: GameEntry) => {
      if (g.kind === 'stream' && g.id === 'youtube') {
        setYoutubeOpen(true);
        return;
      }
      setActiveProxy(null);
      setActive(g);
      const res = await trackPlay(g.id, userId);
      if (res.ok && res.data) setRecent(res.data);
      else if (res.error) setSyncError(res.error);
    },
    [userId]
  );

  const launchProxy = (serviceId: string, index: number) => {
    const service = PROXY_SERVICES.find((s) => s.id === serviceId);
    if (!service) return;
    setActiveProxy({ url: proxyUrl(service, index), title: service.name });
    setActive(null);
  };

  const toggleFav = async (gameId: string) => {
    const res = await toggleFavorite(gameId, userId);
    if (res.ok && res.data) {
      setFavorites(res.data);
      setSyncError(null);
    } else if (res.error) {
      setSyncError(`Could not save favorite: ${res.error}`);
    }
  };

  const handleTheme = (mode: ThemePreference) => {
    setTheme(mode);
    void saveTheme(mode, userId).then((res) => {
      if (!res.ok && res.error) setSyncError(`Theme not synced: ${res.error}`);
    });
  };

  const visibleGames = useMemo(
    () =>
      category === 'all'
        ? legacyCatalog
        : legacyCatalog.filter((g) => g.categories.includes(category as never)),
    [category]
  );

  const byId = useCallback(
    (id: string) => SEARCHABLE.find((g) => g.id === id),
    []
  );

  const recentEntries = useMemo(
    () => recent.map(byId).filter((g): g is GameEntry => Boolean(g)),
    [recent, byId]
  );
  const favoriteEntries = useMemo(
    () => favorites.map(byId).filter((g): g is GameEntry => Boolean(g)),
    [favorites, byId]
  );

  if (gateOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <form
          className="card w-full max-w-sm p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setGateBusy(true);
            setGateError(null);
            const res = await verifyEntryPassword(gateInput);
            setGateBusy(false);
            if (res.ok) setGateOpen(false);
            else if (res.reason === 'rate_limited')
              setGateError('Too many attempts. Try again in a few minutes.');
            else if (res.reason === 'not_configured')
              setGateError(
                'The entry gate is not configured. Deploy the Supabase edge function (see the pull request instructions).'
              );
            else if (res.reason === 'network')
              setGateError('Could not reach the verification service. Try again.');
            else setGateError('Incorrect password.');
          }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <KeyRound size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Geegle</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enter the site password
              </p>
            </div>
          </div>
          <input
            className="input mb-2"
            type="password"
            placeholder="Password"
            value={gateInput}
            onChange={(e) => setGateInput(e.target.value)}
            autoFocus
            aria-label="Site password"
          />
          {gateError && (
            <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {gateError}
            </p>
          )}
          <button className="btn-primary w-full" disabled={gateBusy} type="submit">
            {gateBusy ? <Loader2 className="animate-spin" size={16} /> : 'Enter'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <button
            className="flex items-center gap-2 text-lg font-semibold"
            onClick={() => {
              setActive(null);
              setActiveProxy(null);
              setYoutubeOpen(false);
              setTab('games');
            }}
            aria-label="Geegle home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              G
            </span>
            Geegle
          </button>

          <nav className="hidden gap-1 sm:flex" aria-label="Sections">
            {(['games', 'apps', 'proxies'] as Tab[]).map((t) => (
              <button
                key={t}
                className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
                onClick={() => {
                  setTab(t);
                  setActive(null);
                  setActiveProxy(null);
                }}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {syncError && (
            <span
              className="mr-2 hidden max-w-48 truncate text-xs text-amber-600 dark:text-amber-400 md:inline"
              title={syncError}
            >
              {syncError}
            </span>
          )}

          <button
            className="btn-secondary gap-2 text-slate-500"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={16} />
            <span className="hidden md:inline">Search</span>
          </button>

          <div
            className="hidden items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700 sm:flex"
            role="group"
            aria-label="Theme"
          >
            {(
              [
                ['light', Sun],
                ['system', Monitor],
                ['dark', Moon],
              ] as const
            ).map(([mode, Icon]) => (
              <button
                key={mode}
                className={`rounded-md p-1.5 ${
                  theme === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => handleTheme(mode)}
                aria-label={`${mode} theme`}
                aria-pressed={theme === mode}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>

          {auth.user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-slate-600 dark:text-slate-300 md:inline">
                {auth.username}
              </span>
              <button className="btn-secondary" onClick={auth.signOut} aria-label="Log out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => {
                setAuthOpen(true);
                setAuthMode('login');
              }}
            >
              <UserIcon size={16} />
              <span className="hidden md:inline">Sign in</span>
            </button>
          )}
        </div>

        <nav
          className="flex border-t border-slate-200 dark:border-slate-800 sm:hidden"
          aria-label="Sections"
        >
          {(['games', 'apps', 'proxies'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`flex-1 px-3 py-2 text-sm font-medium capitalize ${
                tab === t
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              onClick={() => {
                setTab(t);
                setActive(null);
                setActiveProxy(null);
              }}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {authOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setAuthOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4">{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
            {!auth.enabled && (
              <div className="mb-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>Accounts are not configured on this deployment.</span>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAuth(authMode);
              }}
            >
              <label className="label" htmlFor="auth-username">
                Username
              </label>
              <input
                id="auth-username"
                className="input mb-4"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="3-32 characters"
                autoComplete="username"
                required
              />
              <label className="label" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                className="input mb-2"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={
                  authMode === 'login' ? 'current-password' : 'new-password'
                }
                required
              />
              {authError && (
                <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  {authError}
                </p>
              )}
              <button className="btn-primary w-full" disabled={authBusy} type="submit">
                {authBusy && <Loader2 className="animate-spin" size={16} />}
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button
              className="mt-4 w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError(null);
              }}
            >
              {authMode === 'login'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      )}

      {searchOpen && (
        <SearchOverlay
          entries={SEARCHABLE}
          onClose={() => setSearchOpen(false)}
          onLaunch={launch}
        />
      )}

      {youtubeOpen && <YouTubeApp onExit={() => setYoutubeOpen(false)} />}

      {(active || activeProxy) && (
        <GamePlayer
          entry={active}
          proxy={activeProxy}
          onExit={() => {
            setActive(null);
            setActiveProxy(null);
          }}
          onToggleFavorite={() => active && toggleFav(active.id)}
          isFavorite={active ? favorites.includes(active.id) : false}
        />
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {tab === 'games' && (
          <>
            {(favoriteEntries.length > 0 || recentEntries.length > 0) && (
              <section className="mb-8">
                <h2 className="mb-3">Favorites &amp; Recent</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {[
                    ...favoriteEntries,
                    ...recentEntries.filter((g) => !favorites.includes(g.id)),
                  ]
                    .slice(0, 12)
                    .map((g) => (
                      <GameCard key={g.id} game={g} onLaunch={() => launch(g)} />
                    ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2>All Games</h2>
                <span className="text-sm text-slate-500">
                  {visibleGames.length} games
                </span>
              </div>
              <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Categories">
                <button
                  role="tab"
                  aria-selected={category === 'all'}
                  className={category === 'all' ? 'chip-active' : 'chip'}
                  onClick={() => setCategory('all')}
                >
                  All Games
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    role="tab"
                    aria-selected={category === c.key}
                    className={category === c.key ? 'chip-active' : 'chip'}
                    onClick={() => setCategory(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {visibleGames.length === 0 ? (
                <EmptyState
                  title="No games in this category"
                  body="Try another category or search for a game."
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {visibleGames.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      onLaunch={() => launch(g)}
                      isFavorite={favorites.includes(g.id)}
                      onToggleFavorite={() => toggleFav(g.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'apps' && (
          <section>
            <h2 className="mb-4">Apps</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {APPS.map((g) => (
                <GameCard key={g.id} game={g} onLaunch={() => launch(g)} />
              ))}
            </div>
          </section>
        )}

        {tab === 'proxies' && (
          <section>
            <h2 className="mb-2">Proxies</h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              External services for authorized use only. Never send your Geegle
              account details to any proxy.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PROXY_SERVICES.map((service) => (
                <ProxyCard
                  key={service.id}
                  service={service}
                  selected={serverDefaults[service.id] ?? 0}
                  onSelect={async (index) => {
                    setServerDefaults((prev) => ({ ...prev, [service.id]: index }));
                    const res = await saveServerDefault(service.id, index, userId);
                    if (!res.ok && res.error) {
                      setSyncError(`Server default not synced: ${res.error}`);
                    } else {
                      setSyncError(null);
                    }
                  }}
                  onLaunch={(index) => launchProxy(service.id, index)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Geegle — free web games. Build: overhaul-2026-11-25.2
      </footer>
    </div>
  );
}
