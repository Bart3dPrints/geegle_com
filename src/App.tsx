// Geegle application shell.
// Web search → library → game player with active cloud saves.
// A search for "pirate" (or "games") opens the library directly; there is no
// secondary password page. Logout awaits the running game's real final save.

import { flushSync } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  User as UserIcon,
  LogOut,
  Loader2,
  AlertTriangle,
  Settings as SettingsIcon,
  ChevronDown,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { GameEntry, ThemePreference } from './types';
import { legacyCatalog } from './data/catalog';
import { DUAL_SECTION_ENTRIES, EVERYTHINGLE, KRILLION } from './data/external';
import { useAuth } from './hooks/useAuth';
import {
  toggleFavorite,
  loadFavorites,
  trackPlay,
  loadRecent,
  loadTheme,
  saveServerDefault,
  loadServerDefaults,
  loadLandingAppearance,
  saveLandingAppearance,
  loadRecentVisible,
  saveRecentVisible,
  loadLibraryNoticeDismissed,
  saveLibraryNoticeDismissed,
  loadAppearanceSettings,
  saveAppearanceSettings,
  loadNavigationShortcut,
  saveNavigationShortcut,
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
} from './lib/userData';
import { FOOTER_TEXT, SITE_TITLE } from './lib/brand';
import { Library } from './components/Library';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { LibraryNotice } from './components/LibraryNotice';
import { ProxyNotice } from './components/ProxyNotice';
import { ProxyCard } from './components/ProxyCard';
import { YouTubeApp } from './components/YouTubeApp';
import { EverythingleApp } from './components/EverythingleApp';
import { DevelopmentNotice } from './components/DevelopmentNotice';
import {
  announcementDismissed,
  dismissAnnouncement,
} from './lib/developmentNotice';
import {
  DEFAULT_SHORTCUT,
  isEditableTarget,
  shortcutMatches,
  type NavigationShortcut,
} from './lib/navigationShortcut';
import { Settings, type SettingsTab } from './components/Settings';
import { SearchLanding } from './components/SearchLanding';
import { PROXY_SERVICES, proxyUrl } from './data/proxies';
import type { LandingAppearance } from './landing/appearance';
import type { CloudSaveHandle } from './lib/cloudSaves';
import { buildSearchIndex, searchIndex } from './lib/search';
import { CATEGORIES } from './data/types';
import { LibrarySearchBar } from './components/LibrarySearchBar';
import { PasswordInput } from './components/PasswordInput';
import { AccountReminder } from './components/AccountReminder';
import {
  dismissReminder,
  dismissReminderPermanently,
  reminderSuppressed,
  resetReminder,
  shouldShowAccountReminder,
} from './lib/accountReminder';
import {
  applyTabIdentity,
  DEFAULT_TAB_IDENTITY,
  type TabIdentity,
} from './lib/tabIdentity';
import { loadTabIdentity, saveTabIdentity } from './lib/userData';
import { contrastText, fontStack } from './lib/personalization';

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
  KRILLION,
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
const SEARCH_INDEX = buildSearchIndex(SEARCHABLE);
const APP_SEARCH_INDEX = buildSearchIndex(APPS_GRID);

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
    exit: reduce ? { opacity: 1 } : { opacity: 0, y: 8 },
    transition: { duration: reduce ? 0 : 0.18, ease: 'easeOut' as const },
  };
}

export default function App() {
  const [showLanding, setShowLanding] = useState(
    () => !(history.state?.geegleView === 'library' || location.hash === '#games')
  );
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [category, setCategory] = useState('all');
  const [headerOffset, setHeaderOffset] = useState(150);
  const [tabIdentity, setTabIdentity] = useState<TabIdentity>(DEFAULT_TAB_IDENTITY);
  const headerRef = useRef<HTMLElement>(null);

  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('theme');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  // A guest's chosen destination waits here while the reminder or the account
  // form is open, so closing the form never launches it by accident.
  const [pendingLaunch, setPendingLaunch] = useState<GameEntry | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  // Mirrors the persistent "Don't remind me again" preference for Settings.
  const [accountReminderOff, setAccountReminderOff] = useState(() => reminderSuppressed());
  const authFromReminderRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const { theme, setTheme } = useTheme();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE_SETTINGS);
  const [serverDefaults, setServerDefaults] = useState<Record<string, number>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [landingAppearance, setLandingAppearance] = useState<{ owner: string; value: LandingAppearance | null } | null>(null);
  const [shortcut, setShortcut] = useState<NavigationShortcut>(DEFAULT_SHORTCUT);
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  const [tab, setTab] = useState<Tab>('games');
  const [active, setActive] = useState<GameEntry | null>(null);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [everythingleOpen, setEverythingleOpen] = useState(false);
  const [activeProxy, setActiveProxy] = useState<{ url: string; title: string } | null>(null);
  const [pendingProxy, setPendingProxy] = useState<{ url: string; title: string } | null>(null);

  // The running game's save handle — logout awaits its real final save.
  const saveHandleRef = useRef<CloudSaveHandle | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  // One notice per library visit: signing in or loading settings must not
  // bring back a notice the visitor already dismissed for this visit.
  const noticeShownRef = useRef(false);

  const ownerRef = useRef(userId);
  const transitionRef = useRef(false);
  useEffect(() => {
    ownerRef.current = userId;
    setFavorites([]);
    setRecent([]);
    setShowRecent(false);
    setNoticeDismissed(false);
    setServerDefaults({});
    setSettingsLoaded(false);
    setAppearance(DEFAULT_APPEARANCE_SETTINGS);
    setTabIdentity(DEFAULT_TAB_IDENTITY);
    setShortcut(DEFAULT_SHORTCUT);
    setAnnouncementOpen(!announcementDismissed(userId));
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
      loadLibraryNoticeDismissed(userId),
      loadAppearanceSettings(userId),
      loadNavigationShortcut(userId),
    ]).then(([f, r, servers, savedTheme, recentVisible, notice, savedAppearance, savedShortcut]) => {
      if (cancelled) return;
      setFavorites(f.data ?? []);
      setRecent(r.data ?? []);
      setServerDefaults(servers.data ?? {});
      setShowRecent(recentVisible.data === true);
      setNoticeDismissed(notice.data === true);
      const saved = savedAppearance.data ?? DEFAULT_APPEARANCE_SETTINGS;
      setAppearance(saved);
      if (savedShortcut.data) setShortcut(savedShortcut.data);
      const t = saved.mode !== 'system' ? saved.mode : savedTheme.data;
      setTheme(t === 'dark' || t === 'light' ? t : 'system');
      setSettingsLoaded(true);
      setSyncError(f.error ?? r.error ?? servers.error ?? savedTheme.error ?? recentVisible.error ?? notice.error ?? savedAppearance.error ?? savedShortcut.error ?? null);
    });
    return () => { cancelled = true; };
  }, [auth.loading, userId, setTheme]);

  // Tab identity is per account; defaults are restored on account change.
  useEffect(() => {
    if (auth.loading) return;
    let cancelled = false;
    void loadTabIdentity(userId).then((result) => {
      if (cancelled) return;
      setTabIdentity(result.data ?? DEFAULT_TAB_IDENTITY);
      if (!result.ok && result.error) setSyncError(result.error);
    });
    return () => { cancelled = true; };
  }, [auth.loading, userId]);

  useEffect(() => {
    applyTabIdentity(tabIdentity);
  }, [tabIdentity]);

  // The sticky header grows or shrinks with the viewport and the category row;
  // letter navigation and scroll margins use its real measured height.
  useEffect(() => {
    const element = headerRef.current;
    if (!element) return;
    const update = () => setHeaderOffset(element.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [showLanding, tab]);

  // Appearance and personalization are applied as CSS variables; unset values
  // fall back to the neutral defaults in index.css.
  useEffect(() => {
    const root = document.documentElement;
    if (appearance.background) root.style.setProperty('--geegle-bg', appearance.background);
    else root.style.removeProperty('--geegle-bg');
    if (appearance.card) root.style.setProperty('--geegle-card', appearance.card);
    else root.style.removeProperty('--geegle-card');
    if (appearance.accent) {
      root.style.setProperty('--geegle-accent', appearance.accent);
      root.style.setProperty('--geegle-accent-contrast', contrastText(appearance.accent));
    } else {
      root.style.removeProperty('--geegle-accent');
      root.style.removeProperty('--geegle-accent-contrast');
    }
    if (appearance.font !== 'default') root.style.setProperty('--geegle-font', fontStack(appearance.font));
    else root.style.removeProperty('--geegle-font');
    if (appearance.fontColor) root.style.setProperty('--geegle-text', appearance.fontColor);
    else root.style.removeProperty('--geegle-text');

    // A custom wallpaper sits behind the whole application with a soft scrim
    // in the current surface colour, so text and cards stay readable.
    const body = document.body.style;
    if (appearance.wallpaper) {
      body.backgroundImage = `linear-gradient(var(--geegle-scrim), var(--geegle-scrim)), url("${appearance.wallpaper}")`;
      body.backgroundSize = 'cover';
      body.backgroundPosition = 'center';
      body.backgroundAttachment = 'fixed';
      body.backgroundRepeat = 'no-repeat';
    } else {
      body.backgroundImage = '';
      body.backgroundSize = '';
      body.backgroundPosition = '';
      body.backgroundAttachment = '';
      body.backgroundRepeat = '';
    }
  }, [
    appearance.background,
    appearance.card,
    appearance.accent,
    appearance.font,
    appearance.fontColor,
    appearance.wallpaper,
  ]);

  // Optional clock and date widgets; the timer only runs while one is shown.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!appearance.clock && !appearance.date) return;
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [appearance.clock, appearance.date]);
  const clockText = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dateText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // The library notice appears on entry unless the user opted out permanently.
  useEffect(() => {
    if (showLanding || !settingsLoaded || noticeDismissed || noticeShownRef.current) return;
    noticeShownRef.current = true;
    setNoticeOpen(true);
  }, [showLanding, settingsLoaded, noticeDismissed]);

  /** Closes the account form. A destination waiting behind it is kept. */
  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    const fromReminder = authFromReminderRef.current;
    authFromReminderRef.current = false;
    if (fromReminder && pendingLaunch) setReminderOpen(true);
  }, [pendingLaunch]);

  // Escape closes the account form, matching every other dialog.
  useEffect(() => {
    if (!authOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAuth();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, closeAuth]);

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

  // One ordinary navigation shortcut. It never fires while the visitor is
  // typing or when a modifier is held, and it performs a normal page load.
  useEffect(() => {
    if (!shortcut.enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !shortcutMatches(event, shortcut)) return;
      if (isEditableTarget(event.target)) return;
      if (authOpen || settingsOpen) return;
      event.preventDefault();
      window.location.assign(shortcut.destination);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, settingsOpen, shortcut]);

  const handleSaveShortcut = async (value: NavigationShortcut) => {
    const previous = shortcut;
    setShortcut(value);
    const result = await saveNavigationShortcut(value, userId);
    if (!result.ok) {
      setShortcut(previous);
      throw new Error(result.error ?? 'Could not save the shortcut.');
    }
  };

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
    noticeShownRef.current = false;
    if (history.state?.geegleView !== 'library') {
      history.pushState({ geegleView: 'library' }, '', location.pathname + location.search);
    }
    setTab('games');
    setShowLanding(false);
  };

  const commitSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
    setSearchOpen(false);
    setActiveSuggestion(-1);
    window.scrollTo({ top: 0 });
  }, [searchInput]);

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setSearchOpen(false);
    setActiveSuggestion(-1);
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
    if (!historyTraversal && history.state?.geegleView === 'library') {
      history.replaceState({ geegleView: 'landing' }, '', location.pathname + location.search);
    }
    noticeShownRef.current = false;
    setNoticeOpen(false);
    setReminderOpen(false);
    setPendingLaunch(null);
    setShowLanding(true);
    window.scrollTo(0, 0);
  }, [closeGame]);

  // Canonical navigation lives at the root URL: the view is history state, not
  // a fragment. Old #games bookmarks are normalized to the same clean URL.
  useEffect(() => {
    const library = location.hash === '#games' || history.state?.geegleView === 'library';
    history.replaceState(
      { geegleView: library ? 'library' : 'landing' },
      '',
      location.pathname + location.search
    );
  }, []);

  // Old #games links keep working, but the app immediately rewrites them to
  // the canonical root URL so the fragment does not persist.
  useEffect(() => {
    const onHash = () => {
      if (location.hash !== '#games') return;
      setShowLanding(false);
      history.replaceState({ geegleView: 'library' }, '', location.pathname + location.search);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const navigate = () => {
      if (history.state?.geegleView === 'library') setShowLanding(false);
      else if (!showLanding) void openLanding(true);
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, [showLanding, openLanding]);

  const suggestions = useMemo(
    () => (searchOpen && searchInput.trim()
      ? searchIndex(SEARCH_INDEX, searchInput, 6).map((result) => result.entry)
      : []),
    [searchOpen, searchInput]
  );

  const filteredGames = useMemo(() => {
    const base = searchQuery
      ? searchIndex(SEARCH_INDEX, searchQuery, legacyCatalog.length).map((result) => result.entry)
      : legacyCatalog;
    return category === 'all' ? base : base.filter((entry) => entry.categories.includes(category as never));
  }, [searchQuery, category]);

  const filteredApps = useMemo(
    () => (searchQuery
      ? searchIndex(APP_SEARCH_INDEX, searchQuery, APPS_GRID.length).map((result) => result.entry)
      : APPS_GRID),
    [searchQuery]
  );

  const filteredProxies = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return term
      ? PROXY_SERVICES.filter((service) => service.name.toLowerCase().includes(term))
      : PROXY_SERVICES;
  }, [searchQuery]);

  const handleAuth = async (mode: 'login' | 'register') => {
    // One request at a time: pressing Enter while a submit is in flight must
    // not queue a second sign-up or sign-in.
    if (authBusy) return;
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
        // The pending destination is launched by the effect below once the
        // signed-in user is available, never from a stale closure.
        setAuthOpen(false);
        setAuthPassword('');
        authFromReminderRef.current = false;
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
      setPendingLaunch(null);
      setReminderOpen(false);
      authFromReminderRef.current = false;
    });
    try {
      const error = await auth.signOut();
      if (error) setSyncError(`Could not sign out: ${error}`);
    } finally {
      transitionRef.current = false;
    }
  };

  const performLaunch = useCallback(
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

  // The guest reminder pauses the first launch of a browsing session without
  // losing the destination. Signed-in visitors go straight through.
  const launch = useCallback(
    async (g: GameEntry) => {
      if (active?.id === g.id || reminderOpen || pendingLaunch || authOpen) return;
      if (shouldShowAccountReminder({ signedIn: Boolean(userId), dismissed: reminderSuppressed() })) {
        setPendingLaunch(g);
        setReminderOpen(true);
        return;
      }
      await performLaunch(g);
    },
    [active?.id, authOpen, pendingLaunch, reminderOpen, userId, performLaunch]
  );

  // Signing in or creating an account opens the destination chosen before the
  // reminder appeared.
  useEffect(() => {
    if (!userId || !pendingLaunch) return;
    const target = pendingLaunch;
    setPendingLaunch(null);
    setReminderOpen(false);
    void performLaunch(target);
  }, [pendingLaunch, performLaunch, userId]);

  const continueAsGuest = (permanent = false) => {
    dismissReminder();
    if (permanent) {
      dismissReminderPermanently();
      setAccountReminderOff(true);
    }
    setReminderOpen(false);
    const target = pendingLaunch;
    setPendingLaunch(null);
    if (target) void performLaunch(target);
  };

  // Every proxy launch shows the safety notice first; the destination opens
  // only after the user confirms.
  const launchProxy = async (serviceId: string, index: number) => {
    if (!await closeGame()) return;
    const service = PROXY_SERVICES.find((s) => s.id === serviceId);
    if (!service) return;
    setPendingProxy({ url: proxyUrl(service, index), title: service.name });
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

  const handleSaveTabIdentity = async (value: TabIdentity) => {
    const previous = tabIdentity;
    setTabIdentity(value);
    const result = await saveTabIdentity(value, userId);
    if (!result.ok) {
      setTabIdentity(previous);
      throw new Error(result.error ?? 'Could not save tab appearance.');
    }
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

  // The account dialog belongs to both surfaces: the landing avatar and the
  // library header open the same form.
  const renderAuthDialog = () => (
  <AnimatePresence>
    {authOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4"
        onClick={closeAuth}
        role="dialog"
        aria-modal="true"
        aria-label={authMode === 'login' ? 'Sign in' : 'Create account'}
      >
        <motion.div
          className="card w-full max-w-sm p-6"
          {...dialogMotion(reduceMotion)}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-1">{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
          <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
            Keep your progress and preferences across devices.
          </p>
          {!auth.enabled && (
            <div className="mb-4 flex gap-2 rounded-md bg-neutral-100 p-3 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
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
            <PasswordInput
              id="auth-password"
              className="input mb-2"
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
            className="mt-4 w-full text-center text-sm text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-300"
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
  );

  if (showLanding) {
    return (
      <>
      <SearchLanding
        signedIn={Boolean(userId)}
        onOpenLibrary={openLibrary}
        onAvatarClick={() => {
          if (userId) setSettingsOpen(true);
          else {
            authFromReminderRef.current = false;
            setAuthOpen(true);
            setAuthMode('login');
          }
        }}
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
      {renderAuthDialog()}
      </>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: appearance.wallpaper ? 'transparent' : 'var(--geegle-bg)' }}
    >
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800" style={{ backgroundColor: 'var(--geegle-card)' }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <button
            className="geegle-wordmark mr-1"
            onClick={() => void openLanding()}
            aria-label={`${SITE_TITLE} home`}
          >
            {SITE_TITLE}
          </button>

          <button
            className="rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            onClick={() => {
              setSettingsTab('theme');
              setSettingsOpen(true);
            }}
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>

          <div className="order-last w-full md:order-none md:w-auto md:max-w-xl md:flex-1">
            <LibrarySearchBar
              input={searchInput}
              query={searchQuery}
              suggestions={suggestions}
              open={searchOpen}
              activeIndex={activeSuggestion}
              onInputChange={(value) => {
                setSearchInput(value);
                setSearchOpen(true);
                setActiveSuggestion(-1);
              }}
              onSubmit={commitSearch}
              onClear={clearSearch}
              onFocus={() => setSearchOpen(true)}
              onClose={() => setSearchOpen(false)}
              onActiveIndexChange={setActiveSuggestion}
              onPick={(entry) => {
                setSearchOpen(false);
                setSearchInput('');
                setSearchQuery('');
                launch(entry);
              }}
              placeholder="Search games, apps and proxies"
              inputId="library-search"
            />
          </div>

          <div className="flex-1 md:hidden" />

          {(appearance.clock || appearance.date) && (
            <div className="hidden items-center gap-2 text-right text-xs leading-tight text-neutral-500 md:flex dark:text-neutral-400">
              {appearance.clock && <span className="tabular-nums">{clockText}</span>}
              {appearance.clock && appearance.date && <span aria-hidden="true">·</span>}
              {appearance.date && <span>{dateText}</span>}
            </div>
          )}

          {syncError && (
            <span
              className="hidden max-w-48 truncate text-xs text-neutral-500 dark:text-neutral-400 md:inline"
              title={syncError}
            >
              {syncError}
            </span>
          )}

          {auth.user ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                className="flex items-center gap-1.5 rounded-full border border-neutral-300 p-1 pr-2 dark:border-neutral-700"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label="Account"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                  <UserIcon size={14} />
                </span>
                <ChevronDown size={14} className="text-neutral-400" />
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
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={() => {
                        setSettingsTab('preferences');
                        setSettingsOpen(true);
                        setAccountMenuOpen(false);
                      }}
                    >
                      <SettingsIcon size={15} /> Preferences
                    </button>
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={() => void handleSignOut()}
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 rounded-full border border-neutral-300 p-1 pr-2 dark:border-neutral-700"
              aria-label="Sign in"
              onClick={() => {
                authFromReminderRef.current = false;
                setAuthOpen(true);
                setAuthMode('login');
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                <UserIcon size={14} />
              </span>
              <span className="hidden pr-1 text-sm sm:inline">Sign in</span>
            </button>
          )}
        </div>

        <nav
          className="border-t border-neutral-200 dark:border-neutral-800"
          aria-label="Sections"
        >
          <div className="mx-auto flex max-w-7xl px-2 sm:px-4">
            {TABS.map((t) => (
              <button
                key={t}
                className={`relative flex-1 px-3 py-3 text-[15px] font-medium capitalize transition-colors sm:flex-none sm:px-8 ${
                  tab === t
                    ? 'text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
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
                    className="accent-surface absolute inset-x-3 bottom-0 h-0.5"
                    transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                  />
                )}
              </button>
            ))}
          </div>
        </nav>

        {tab === 'games' && (
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            <div
              className="mx-auto flex max-w-7xl flex-wrap gap-1.5 px-4 py-2 sm:px-6"
              role="tablist"
              aria-label="Categories"
            >
              <button
                role="tab"
                aria-selected={category === 'all'}
                className={category === 'all' ? 'chip-active' : 'chip'}
                onClick={() => setCategory('all')}
              >
                All
              </button>
              {CATEGORIES.map((entry) => (
                <button
                  key={entry.key}
                  role="tab"
                  aria-selected={category === entry.key}
                  className={category === entry.key ? 'chip-active' : 'chip'}
                  onClick={() => setCategory(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {renderAuthDialog()}

      <AnimatePresence>
        {settingsOpen && (
          <Settings
            initialTab={settingsTab}
            username={auth.user ? auth.username : null}
            showRecent={showRecent}
            onShowRecentChange={handleShowRecent}
            tabIdentity={tabIdentity}
            onSaveTabIdentity={handleSaveTabIdentity}
            shortcut={shortcut}
            onSaveShortcut={handleSaveShortcut}
            announcementDismissed={!announcementOpen}
            onShowAnnouncement={() => {
              setAnnouncementOpen(true);
              try { localStorage.removeItem(`geegle-announcement-dismissed:${userId ?? 'guest'}`); } catch { /* storage disabled */ }
            }}
            appearance={{ ...appearance, mode: theme }}
            onPreviewAppearance={(value) => {
              setAppearance(value);
              setTheme(value.mode);
            }}
            onSaveAppearance={async (value) => {
              setAppearance(value);
              setTheme(value.mode);
              const result = await saveAppearanceSettings({ ...value, mode: value.mode }, userId);
              if (!result.ok) throw new Error(result.error ?? 'Could not save appearance.');
            }}
            noticeDismissed={noticeDismissed}
            onShowNoticeAgain={async () => {
              setNoticeDismissed(false);
              const result = await saveLibraryNoticeDismissed(false, userId);
              if (!result.ok) setSyncError(result.error ?? null);
            }}
            accountReminderOff={accountReminderOff}
            onResetReminder={() => {
              resetReminder();
              setAccountReminderOff(false);
            }}
            onClose={() => setSettingsOpen(false)}
            onSignedOut={handleSignOut}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingProxy && (
          <ProxyNotice
            onCancel={() => setPendingProxy(null)}
            onConfirm={() => {
              setActiveProxy(pendingProxy);
              setActive(null);
              setPendingProxy(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reminderOpen && pendingLaunch && (
          <AccountReminder
            onSignIn={() => {
              authFromReminderRef.current = true;
              setReminderOpen(false);
              setAuthMode('login');
              setAuthError(null);
              setAuthOpen(true);
            }}
            onCreateAccount={() => {
              authFromReminderRef.current = true;
              setReminderOpen(false);
              setAuthMode('register');
              setAuthError(null);
              setAuthOpen(true);
            }}
            onContinueAsGuest={continueAsGuest}
            onDismiss={() => {
              dismissReminder();
              setReminderOpen(false);
              setPendingLaunch(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {noticeOpen && !showLanding && (
          <LibraryNotice
            onDismiss={() => setNoticeOpen(false)}
            onDismissForever={() => {
              setNoticeOpen(false);
              setNoticeDismissed(true);
              void saveLibraryNoticeDismissed(true, userId).then((result) => {
                if (!result.ok) setSyncError(result.error ?? null);
              });
            }}
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
        <AnimatePresence>
          {announcementOpen && !showLanding && (
            <DevelopmentNotice
              onDismiss={() => {
                setAnnouncementOpen(false);
                dismissAnnouncement(userId);
              }}
            />
          )}
        </AnimatePresence>
        {tab === 'games' && (
          <Library
            games={filteredGames}
            favorites={favorites}
            recent={recentEntries}
            showRecent={showRecent}
            query={searchQuery}
            headerOffset={headerOffset}
            onLaunch={launch}
            onToggleFavorite={toggleFav}
          />
        )}

        {tab === 'apps' && (
          <section aria-label="Apps">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filteredApps.map((g) => (
                <GameCard key={g.id} game={g} onLaunch={() => launch(g)} />
              ))}
            </div>
          </section>
        )}

        {tab === 'proxies' && (
          <section aria-label="Proxies">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProxies.map((service) => (
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

      <footer className="border-t border-neutral-200 py-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {FOOTER_TEXT}
      </footer>
    </div>
  );
}
