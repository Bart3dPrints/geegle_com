// Geegle application shell.
// Web search → library → game player with active cloud saves.
// A search for "pirate" (or "games") opens the library directly; there is no
// secondary password page. Logout awaits the running game's real final save.

import { flushSync } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  User as UserIcon,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Loader2,
  AlertTriangle,
  Settings as SettingsIcon,
  ChevronDown,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { GameEntry, ThemePreference } from './types';
import { legacyCatalog } from './data/catalog';
import { DUAL_SECTION_ENTRIES, EVERYTHINGLE } from './data/external';
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
  loadLandingAppearance,
  saveLandingAppearance,
  loadRecentVisible,
  saveRecentVisible,
} from './lib/userData';
import { FOOTER_TEXT, SITE_TITLE } from './lib/brand';
import { Library } from './components/Library';
import { GameCard } from './components/GameCard';
import { SearchOverlay } from './components/SearchOverlay';
import { GamePlayer } from './components/GamePlayer';
import { ProxyCard } from './components/ProxyCard';
import { YouTubeApp } from './components/YouTubeApp';
import { EverythingleApp } from './components/EverythingleApp';
import { AccountSettings } from './components/AccountSettings';
import { SearchLanding } from './components/SearchLanding';
import { PROXY_SERVICES, proxyUrl } from './data/proxies';
import type { LandingAppearance } from './landing/appearance';
import type { CloudSaveHandle } from './lib/cloudSaves';

const APPS: GameEntry[] = [
  {
    id: 'youtube',
    title: 'YouTube',
    path: '',
    categories: [],
    kind: 'stream',
    aliases: ['yt', 'videos', 'streaming', 'stream'],
    source: 'Official YouTube privacy-enhanced embed (youtube-nocookie.com)',
  },
  EVERYTHINGLE,
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

// Apps grid shows APPS plus dual-section entries (Krillion backup appears in
// BOTH Games and Apps from one stable ID, so favorites/history stay unified).
const APPS_GRID = [...APPS, ...DUAL_SECTION_ENTRIES];
const SEARCHABLE = [...new Map([...legacyCatalog, ...APPS_GRID].map((entry) => [entry.id, entry])).values()];

type Tab = 'games' | 'apps' | 'proxies';

const TABS: Tab[] = ['games', 'apps', 'proxies'];

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

/** Short dialog entrance that is skipped when reduced motion is requested. */
function dialogMotion(reduce: boolean | null) {
  return {
    initial: reduce ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0 : 0.18, ease: 'easeOut' as const },
  };
}

export default function App() {
  const [showLanding, setShowLanding] = useState(() => location.hash !== '#games');

  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const reduceMotion = useReducedMotion();

  const { theme, setTheme } = useTheme();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [serverDefaults, setServerDefaults] = useState<Record<string, number>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [landingAppearance, setLandingAppearance] = useState<{ owner: string; value: LandingAppearance | null } | null>(null);

  const [tab, setTab] = useState<Tab>('games');
  const [searchOpen, setSearchOpen] = useState(false);
  const [active, setActive] = useState<GameEntry | null>(null);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [everythingleOpen, setEverythingleOpen] = useState(false);
  const [activeProxy, setActiveProxy] = useState<{ url: string; title: string } | null>(null);

  // The running game's save handle — logout awaits its real final save.
  const saveHandleRef = useRef<CloudSaveHandle | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const ownerRef = useRef(userId);
  const transitionRef = useRef(false);
  useEffect(() => {
    ownerRef.current = userId;
    setFavorites([]);
    setRecent([]);
    setShowRecent(false);
    setServerDefaults({});
    setTheme('system');
    setSyncError(null);
    if (auth.loading) return;
    let cancelled = false;
    void Promise.all([
      loadFavorites(userId),
      loadRecent(userId),
      loadServerDefaults(userId),
      loadTheme(userId),
      loadRecentVisible(userId),
    ]).then(([f, r, servers, savedTheme, recentVisible]) => {
      if (cancelled) return;
      setFavorites(f.data ?? []);
      setRecent(r.data ?? []);
      setServerDefaults(servers.data ?? {});
      setShowRecent(recentVisible.data === true);
      const t = savedTheme.data;
      setTheme(t === 'dark' || t === 'light' ? t : 'system');
      setSyncError(f.error ?? r.error ?? servers.error ?? savedTheme.error ?? recentVisible.error ?? null);
    });
    return () => { cancelled = true; };
  }, [auth.loading, userId, setTheme]);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountMenuOpen]);

  const closeGame = useCallback(async () => {
    if (transitionRef.current) return false;
    transitionRef.current = true;
    try {
      const result = await saveHandleRef.current?.close();
      return !result || result.ok || window.confirm(`${result.error} Continue with progress kept on this device?`);
    } finally {
      transitionRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!showLanding || auth.loading || !userId) return;
    let current = true;
    void loadLandingAppearance(userId).then((result) => {
      if (current && result.ok) setLandingAppearance({ owner: userId, value: result.data ?? null });
    });
    return () => { current = false; };
  }, [showLanding, auth.loading, userId]);

  const openLibrary = () => {
    if (location.hash !== '#games') history.pushState(null, '', '#games');
    setTab('games');
    setShowLanding(false);
  };

  const openLanding = useCallback(async (historyTraversal = false) => {
    if (!await closeGame()) {
      if (historyTraversal && location.hash !== '#games') history.pushState(null, '', '#games');
      return;
    }
    setActive(null);
    setActiveProxy(null);
    setYoutubeOpen(false);
    setEverythingleOpen(false);
    setSearchOpen(false);
    if (!historyTraversal && location.hash) history.pushState(null, '', location.pathname + location.search);
    setShowLanding(true);
    window.scrollTo(0, 0);
  }, [closeGame]);

  useEffect(() => {
    const navigate = () => {
      if (location.hash === '#games') setShowLanding(false);
      else if (!showLanding) void openLanding(true);
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, [showLanding, openLanding]);

  const handleAuth = async (mode: 'login' | 'register') => {
    if (!await closeGame()) return;
    setActive(null);
    setActiveProxy(null);
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

  const handleSignOut = async () => {
    if (!await closeGame()) return;
    transitionRef.current = true;
    flushSync(() => {
      setActive(null);
      setActiveProxy(null);
      setEverythingleOpen(false);
      setSettingsOpen(false);
      setAccountMenuOpen(false);
    });
    try {
      const error = await auth.signOut();
      if (error) setSyncError(`Could not sign out: ${error}`);
    } finally {
      transitionRef.current = false;
    }
  };

  const launch = useCallback(
    async (g: GameEntry) => {
      if (active?.id === g.id || !await closeGame()) return;
      setActive(null);
      setActiveProxy(null);
      if (g.kind === 'stream' && g.id === 'youtube') {
        setYoutubeOpen(true);
        return;
      }
      if (g.id === 'everythingle') {
        setEverythingleOpen(true);
        return;
      }
      setActive(g);
      const res = await trackPlay(g.id, userId);
      if (ownerRef.current !== userId) return;
      if (res.ok && res.data) setRecent(res.data);
      else if (res.error) setSyncError(res.error);
    },
    [active?.id, userId, closeGame]
  );

  const launchProxy = async (serviceId: string, index: number) => {
    if (!await closeGame()) return;
    const service = PROXY_SERVICES.find((s) => s.id === serviceId);
    if (!service) return;
    setActiveProxy({ url: proxyUrl(service, index), title: service.name });
    setActive(null);
  };

  const toggleFav = async (gameId: string) => {
    const res = await toggleFavorite(gameId, userId);
    if (ownerRef.current !== userId) return;
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
      if (ownerRef.current === userId && !res.ok && res.error) setSyncError(`Theme not synced: ${res.error}`);
    });
  };

  const handleShowRecent = (visible: boolean) => {
    setShowRecent(visible);
    void saveRecentVisible(visible, userId).then((res) => {
      if (ownerRef.current === userId && !res.ok && res.error) setSyncError(`Setting not synced: ${res.error}`);
    });
  };

  const byId = useCallback((id: string) => SEARCHABLE.find((g) => g.id === id), []);
  const recentEntries = useMemo(
    () => recent.map(byId).filter((g): g is GameEntry => Boolean(g)),
    [recent, byId]
  );

  if (showLanding) {
    return (
      <SearchLanding
        signedIn={Boolean(userId)}
        onOpenLibrary={openLibrary}
        account={userId ? {
          id: userId,
          appearance: landingAppearance?.owner === userId ? landingAppearance.value : null,
          saveAppearance: async (value) => {
            if (ownerRef.current !== userId) throw new Error('Your account changed. Sign in again before syncing.');
            const result = await saveLandingAppearance(userId, value);
            if (!result.ok) throw new Error(result.error);
            if (ownerRef.current === userId) setLandingAppearance({ owner: userId, value });
          },
        } : undefined}
      />
    );
  }

  const themeButtons = (
    <>
      {([
        ['light', Sun],
        ['system', Monitor],
        ['dark', Moon],
      ] as const).map(([mode, Icon]) => (
        <button
          key={mode}
          className={`rounded p-1.5 transition-colors ${
            theme === mode
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
          onClick={() => handleTheme(mode)}
          aria-label={`${mode} theme`}
          aria-pressed={theme === mode}
        >
          <Icon size={15} />
        </button>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <button
            className="flex items-center gap-2 text-base font-semibold"
            onClick={() => void openLanding()}
            aria-label={`${SITE_TITLE} home`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-900 text-sm font-bold dark:border-slate-100">
              G
            </span>
            {SITE_TITLE}
          </button>

          <div className="flex-1" />

          {syncError && (
            <span
              className="hidden max-w-48 truncate text-xs text-slate-500 dark:text-slate-400 md:inline"
              title={syncError}
            >
              {syncError}
            </span>
          )}

          <button
            className="btn-secondary gap-2"
            onClick={() => setSearchOpen(true)}
            aria-label="Search games and apps"
          >
            <Search size={16} />
            <span className="hidden md:inline">Search</span>
          </button>

          <div
            className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-700"
            role="group"
            aria-label="Theme"
          >
            {themeButtons}
          </div>

          {auth.user ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                className="flex items-center gap-1.5 rounded-full border border-slate-300 p-1 pr-2 dark:border-slate-700"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label="Account"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <UserIcon size={14} />
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              <AnimatePresence>
                {accountMenuOpen && (
                  <motion.div
                    role="menu"
                    aria-label="Account menu"
                    className="card absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden p-1 shadow-lg"
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                    transition={{ duration: reduceMotion ? 0 : 0.14, ease: 'easeOut' }}
                  >
                    <p className="truncate px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {auth.username}
                    </p>
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                    >
                      <SettingsIcon size={15} /> Settings
                    </button>
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => void handleSignOut()}
                    >
                      <LogOut size={15} /> Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 rounded-full border border-slate-300 p-1 pr-2 dark:border-slate-700"
              aria-label="Sign in"
              onClick={() => {
                setAuthOpen(true);
                setAuthMode('login');
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <UserIcon size={14} />
              </span>
              <span className="hidden pr-1 text-sm sm:inline">Sign in</span>
            </button>
          )}
        </div>

        <nav
          className="border-t border-slate-200 dark:border-slate-800"
          aria-label="Sections"
        >
          <div className="mx-auto flex max-w-7xl px-2 sm:px-4">
            {TABS.map((t) => (
              <button
                key={t}
                className={`relative flex-1 px-3 py-3 text-[15px] font-medium capitalize transition-colors sm:flex-none sm:px-8 ${
                  tab === t
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                aria-current={tab === t ? 'page' : undefined}
                onClick={async () => {
                  if (!await closeGame()) return;
                  setTab(t);
                  setActive(null);
                  setActiveProxy(null);
                }}
              >
                {t}
                {tab === t && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-3 bottom-0 h-0.5 bg-slate-900 dark:bg-slate-100"
                    transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                  />
                )}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {authOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            onClick={() => setAuthOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={authMode === 'login' ? 'Sign in' : 'Create account'}
          >
            <motion.div
              className="card w-full max-w-sm p-6"
              {...dialogMotion(reduceMotion)}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4">{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
              {!auth.enabled && (
                <div className="mb-4 flex gap-2 rounded-md bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
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
                className="mt-4 w-full text-center text-sm text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError(null);
                }}
              >
                {authMode === 'login'
                  ? "Don't have an account? Create one"
                  : 'Already have an account? Sign in'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && auth.user && (
          <AccountSettings
            username={auth.username}
            showRecent={showRecent}
            onShowRecentChange={handleShowRecent}
            onClose={() => setSettingsOpen(false)}
            onSignedOut={handleSignOut}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <SearchOverlay
            entries={SEARCHABLE}
            onClose={() => setSearchOpen(false)}
            onLaunch={launch}
          />
        )}
      </AnimatePresence>

      {youtubeOpen && <YouTubeApp onExit={() => setYoutubeOpen(false)} />}

      {everythingleOpen && (
        <EverythingleApp key={userId ?? 'guest'} userId={userId} onExit={() => setEverythingleOpen(false)} />
      )}

      {(active || activeProxy) && (
        <GamePlayer
          key={JSON.stringify([userId, active?.id, activeProxy?.url])}
          entry={active}
          proxy={activeProxy}
          userId={userId}
          onExit={() => {
            setActive(null);
            setActiveProxy(null);
          }}
          onToggleFavorite={() => active && toggleFav(active.id)}
          isFavorite={active ? favorites.includes(active.id) : false}
          registerSaveHandle={(handle) => {
            saveHandleRef.current = handle;
          }}
        />
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {tab === 'games' && (
          <Library
            games={legacyCatalog}
            favorites={favorites}
            recent={recentEntries}
            showRecent={showRecent}
            onLaunch={launch}
            onToggleFavorite={toggleFav}
          />
        )}

        {tab === 'apps' && (
          <section aria-label="Apps">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {APPS_GRID.map((g) => (
                <GameCard key={g.id} game={g} onLaunch={() => launch(g)} />
              ))}
            </div>
          </section>
        )}

        {tab === 'proxies' && (
          <section aria-label="Proxies">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PROXY_SERVICES.map((service) => (
                <ProxyCard
                  key={service.id}
                  service={service}
                  selected={serverDefaults[service.id] ?? 0}
                  onSelect={async (index) => {
                    setServerDefaults((prev) => ({ ...prev, [service.id]: index }));
                    const res = await saveServerDefault(service.id, index, userId);
                    if (ownerRef.current !== userId) return;
                    if (!res.ok && res.error) setSyncError(`Server default not synced: ${res.error}`);
                    else setSyncError(null);
                  }}
                  onLaunch={(index) => launchProxy(service.id, index)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {FOOTER_TEXT}
      </footer>
    </div>
  );
}
