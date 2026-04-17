import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Mic, Image, Grid2x2 as Grid, User, ArrowLeft, ChevronDown } from 'lucide-react';
import { normalizeText, isCordKeyword } from './utils';

const PROXY_GAME_IDS = new Set(['heilos', 'doge', 'vapor', 'awpproxy', 'overcloaked', 'voidproxy1']);

// localStorage key for the "don't show again" games popup preference
const HIDE_GAMES_POPUP_KEY = 'hideGamesPopup';

const games = [
  { id: 'heilos', name: 'Heilos Proxy', url: '/games/heilos.html', icon: '🌐' },
  { id: 'doge', name: 'Dogeub Proxy', url: '/games/doge.html', icon: '🌐' },
  { id: 'vapor', name: 'Vapor V4 Proxy', url: '/games/vapor.html', icon: '🌐' },
  { id: 'awpproxy', name: 'AWP Proxy', url: '/games/awpproxy.html', icon: '🌐' },
  { id: 'overcloaked', name: 'Overcloaked Proxy', url: '/games/overcloaked.html', icon: '🌐' },
  { id: 'voidproxy1', name: 'Void Proxy', url: '/games/voidproxy1.html', icon: '🌐' },
  { id: '1v1', name: '1v1.LoL', url: '/games/1v1.html', icon: '🎮' },
  { id: 'bloxorz', name: 'Bloxorz', url: '/games/Bloxorz copy copy.html', icon: '🧊' },
  { id: 'bowmasters', name: 'Bowmasters', url: '/games/Bowmasters.html', icon: '🏹' },
  { id: 'buckshot-roulette', name: 'Buckshot Roulette', url: '/games/Buckshot Roulette.html', icon: '🎯' },
  { id: 'chat-bot', name: 'Chat Bot (A.I)', url: '/games/Chat Bot (A._.I) (1).html', icon: '🤖' },
  { id: 'code-editor', name: 'Code Editor', url: '/games/Code Editor (1).html', icon: '💻' },
  { id: 'crazy-cars', name: 'Crazy Cars', url: '/games/Crazy Cars.html', icon: '🏎️' },
  { id: 'draw-climber', name: 'Draw Climber', url: '/games/Draw Climber copy copy.html', icon: '✏️' },
  { id: 'drive-mad', name: 'Drive Mad', url: '/games/Drive Mad (1).html', icon: '🚗' },
  { id: 'find-the-alien', name: 'Find the Alien', url: '/games/Find the Alien (1) copy.html', icon: '👽' },
  { id: 'fnaf', name: "Five Nights at Freddy's", url: "/games/Five Nights at Freddy's copy copy.html", icon: '🐻' },
  { id: 'fnaf4', name: "Five Nights at Freddy's 4 Halloween", url: "/games/Five Nights at Freddy's 4_ Halloween copy copy.html", icon: '🎃' },
  { id: 'friday-night-funkin', name: 'Friday Night Funkin', url: '/games/Friday Night Funkin.html', icon: '🎵' },
  { id: 'geometry-dash', name: 'Geometry Dash Lite', url: '/games/Geometry Dash Lite.html', icon: '🔷' },
  { id: 'hollow-knight', name: 'Hollow Knight', url: '/games/Hollow Knight.html', icon: '🦋' },
  { id: 'minecraft', name: 'Minecraft 1.12.2', url: '/games/Minecraft 1.12.2.html', icon: '⛏️' },
  { id: 'nazi-zombies', name: 'Nazi Zombies Portable', url: '/games/Nazi Zombies_ Portable (1) copy.html', icon: '🧟' },
  { id: 'plinko', name: 'Plinko', url: '/games/Plinko (1) copy.html', icon: '🎰' },
  { id: 'ragdollarchers', name: 'Ragdoll Archers', url: '/games/ragdollarchers.html', icon: '🏹' },
  { id: 'slope', name: 'Slope', url: '/games/Slope.html', icon: '⛷️' },
  { id: 'slope3', name: 'Slope 3', url: '/games/slope3.html', icon: '⛷️' },
  { id: 'snow-rider', name: 'Snow Rider 3D', url: '/games/snow-rider.html', icon: '🏂' },
  { id: 'soundboard', name: 'Soundboard', url: '/games/Soundboard.html', icon: '🔊' },
  { id: 'time-shooter-2', name: 'Time Shooter 2', url: '/games/Time Shooter 2 (1) copy.html', icon: '🔫' },
  { id: 'time-shooter-3', name: 'Time Shooter 3 SWAT', url: '/games/Time Shooter 3_ SWAT (1).html', icon: '🔫' },
  { id: 'vex-6', name: 'Vex 6', url: '/games/Vex 6.html', icon: '🏃' },
  { id: 'vex-8', name: 'Vex 8', url: '/games/Vex 8 copy copy copy.html', icon: '🏃' },
  { id: 'repo', name: 'R.E.P.O', url: '/games/R.E.P.O copy copy copy.html', icon: '🎮' },
];

const proxies = [
  { id: 'proxy1', name: 'Proxy 1', url: '/proxies/fernproxy.html' },
  { id: 'proxy2', name: 'Proxy 2', url: '/proxies/overcloakedproxy.html' },
  { id: 'proxy3', name: 'Proxy 3', url: '/proxies/voidproxy.html' },
];

function App() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showGameGrid, setShowGameGrid] = useState(false);
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [showProxyWarning, setShowProxyWarning] = useState(false);
  const [showProxy, setShowProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [selectedProxy, setSelectedProxy] = useState(proxies[0]);
  const [showProxyDropdown, setShowProxyDropdown] = useState(false);

  // Games page search state
  const [gameSearchRaw, setGameSearchRaw] = useState('');
  const [gameSearchDebounced, setGameSearchDebounced] = useState('');

  // Contextual "cord" popup on the games page
  const [showCordPopup, setShowCordPopup] = useState(false);
  const [cordPopupDontRemind, setCordPopupDontRemind] = useState(false);
  // Track whether the cord popup has already fired this session
  const cordPopupShownThisSession = useRef(false);

  // Easter egg popup state
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const proxyInputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce game search input (200ms)
  const handleGameSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setGameSearchRaw(raw);

    // Easter egg: exact phrase match, no normalization, no conflict with search filter
    if (raw === 'Bart is Awesome') {
      setShowEasterEgg(true);
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setGameSearchDebounced(raw);

      // Contextual cord popup: only on the games page, only if "cord" is typed,
      // only once per session, only if user hasn't opted out persistently.
      if (
        isCordKeyword(raw) &&
        !cordPopupShownThisSession.current &&
        localStorage.getItem(HIDE_GAMES_POPUP_KEY) !== 'true'
      ) {
        setShowCordPopup(true);
        cordPopupShownThisSession.current = true;
      }
    }, 200);
  }, []);

  // Filter games by debounced search query using normalizeText for consistency
  const filteredGames = gameSearchDebounced.trim()
    ? games.filter((g) =>
        normalizeText(g.name).includes(normalizeText(gameSearchDebounced))
      )
    : games;

  const handleCordPopupClose = () => {
    if (cordPopupDontRemind) {
      localStorage.setItem(HIDE_GAMES_POPUP_KEY, 'true');
    }
    setShowCordPopup(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const searchQuery = searchInputRef.current?.value || '';
    // Trigger keyword: any variant of "cord" (case-insensitive, punctuation-ignored)
    if (isCordKeyword(searchQuery.trim())) {
      setShowGameGrid(true);
    } else if (searchQuery.trim()) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
    }
  };

  const handleLuckySearch = () => {
    const searchQuery = searchInputRef.current?.value || '';
    if (isCordKeyword(searchQuery.trim())) {
      setShowGameGrid(true);
    } else if (searchQuery.trim()) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&btnI=1`, '_blank');
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '\\' && e.target !== proxyInputRef.current) {
        e.preventDefault();
        e.stopPropagation();
        if (window.self !== window.top) {
          window.top!.location.href = 'https://manhasset.instructure.com/';
        } else {
          window.location.href = 'https://manhasset.instructure.com/';
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress, true);
    return () => document.removeEventListener('keydown', handleKeyPress, true);
  }, []);

  // Clear game search when leaving the games grid
  const exitGameGrid = () => {
    setShowGameGrid(false);
    setGameSearchRaw('');
    setGameSearchDebounced('');
  };

  const playGame = (gameId: string, gameUrl: string) => {
    if (gameUrl === 'proxy') {
      setShowProxy(true);
      setShowGameGrid(false);
    } else {
      setCurrentGame(gameUrl);
      setCurrentGameId(gameId);
      if (PROXY_GAME_IDS.has(gameId)) {
        setShowProxyWarning(true);
      }
    }
  };

  const handleProxySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = proxyInputRef.current?.value || '';
    if (query.trim()) {
      let searchUrl = query.trim();
      if (searchUrl.includes('.') && !searchUrl.includes(' ')) {
        if (!searchUrl.startsWith('http://') && !searchUrl.startsWith('https://')) {
          searchUrl = 'https://' + searchUrl;
        }
      } else {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchUrl)}`;
      }
      setProxyUrl(searchUrl);
    }
  };

  // ─── Game view ────────────────────────────────────────────────────────────
  if (currentGame) {
    const isProxyGame = currentGameId && PROXY_GAME_IDS.has(currentGameId);
    return (
      <div className="w-screen h-screen bg-black overflow-hidden relative">
        {showProxyWarning && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-900 border border-yellow-500 rounded-xl p-6 max-w-sm mx-4 shadow-2xl text-center">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-white font-medium text-base leading-relaxed">
                Please ignore and exit out of any pop-ups or redirects from these proxies.
              </p>
              <button
                onClick={() => setShowProxyWarning(false)}
                className="mt-5 px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setCurrentGame(null);
            setCurrentGameId(null);
            setShowGameGrid(true);
          }}
          className={`absolute z-40 p-1.5 bg-gray-800/80 text-white rounded hover:bg-gray-700 transition-colors shadow-lg ${
            isProxyGame ? 'bottom-4 left-4' : 'top-4 left-4'
          }`}
          aria-label="Back"
        >
          <ArrowLeft size={14} />
        </button>

        <iframe
          src={currentGame}
          className="w-full h-full border-none"
          title="Game"
          allow="fullscreen"
          style={{ display: 'block' }}
        />
      </div>
    );
  }

  // ─── Proxy view ───────────────────────────────────────────────────────────
  if (showProxy) {
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-3 flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowProxyDropdown(!showProxyDropdown)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 border border-white/20"
            >
              {selectedProxy.name}
              <ChevronDown size={16} />
            </button>
            {showProxyDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50">
                {proxies.map((proxy) => (
                  <button
                    key={proxy.id}
                    onClick={() => {
                      setSelectedProxy(proxy);
                      setShowProxyDropdown(false);
                      setProxyUrl('');
                    }}
                    className={`w-full text-left px-4 py-2 transition-colors ${
                      selectedProxy.id === proxy.id
                        ? 'bg-blue-500 text-white'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    {proxy.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={handleProxySearch} className="flex-1 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 focus-within:border-white/40 transition-all">
              <Search size={20} className="text-white/60" />
              <input
                ref={proxyInputRef}
                type="text"
                placeholder="Search or enter URL"
                onKeyDown={(e) => {
                  if (e.key === 'Backspace') e.stopPropagation();
                }}
                className="flex-1 outline-none text-white bg-transparent placeholder-white/50 text-base"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl transition-all font-medium shadow-lg"
            >
              Go
            </button>
          </form>
        </div>

        <button
          onClick={() => {
            setShowProxy(false);
            setShowGameGrid(true);
            setProxyUrl('');
          }}
          className="fixed bottom-4 left-4 p-1.5 bg-gray-800/80 text-white rounded hover:bg-gray-700 transition-colors shadow-lg z-50"
          aria-label="Back"
        >
          <ArrowLeft size={14} />
        </button>

        <div className="flex-1 relative overflow-hidden">
          {proxyUrl ? (
            <iframe
              src={proxyUrl}
              className="w-full h-full border-none"
              title="Web Proxy"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-8xl mb-6">🐕</div>
                <h2 className="text-5xl font-bold text-white mb-4">Doge Unblocker</h2>
                <p className="text-xl text-white/70">Search the web or enter a URL</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Games grid ───────────────────────────────────────────────────────────
  if (showGameGrid) {
    return (
      <div className="w-screen h-screen bg-gray-900 overflow-y-scroll relative">
        {/* Contextual cord popup — only shown on games page when cord keyword typed */}
        {showCordPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-900 border border-blue-500 rounded-xl p-6 max-w-sm mx-4 shadow-2xl text-center">
              <div className="text-3xl mb-3">ℹ️</div>
              <p className="text-white font-medium text-base leading-relaxed">
                Please wait if you see nothing upon clicking on a Game/Proxy.
              </p>
              <label className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cordPopupDontRemind}
                  onChange={(e) => setCordPopupDontRemind(e.target.checked)}
                  className="accent-blue-500 w-4 h-4"
                />
                Don't remind me again
              </label>
              <button
                onClick={handleCordPopupClose}
                className="mt-4 px-6 py-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Easter egg popup — triggered by exact "Bart is Awesome" in search */}
        {showEasterEgg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-900 border border-yellow-400 rounded-xl p-6 max-w-md mx-4 shadow-2xl text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-2xl font-bold text-yellow-400 mb-3">CONGRATS!!!</h2>
              <p className="text-white text-sm leading-relaxed">
                Email{' '}
                <a
                  href="mailto:hongbowang0821@gmail.com"
                  className="text-blue-400 hover:underline"
                >
                  hongbowang0821@gmail.com
                </a>{' '}
                for his special method of Blocking GoGuardian... make sure to talk about how delicious potato fries are in the email or he wont believe you...
              </p>
              <button
                onClick={() => setShowEasterEgg(false)}
                className="mt-5 px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="mb-8 text-center sticky top-0 bg-gray-900 py-4 z-10">
            <h1 className="text-5xl font-bold text-white mb-4">Choose Your Game</h1>
            <button
              onClick={exitGameGrid}
              className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors mb-4"
            >
              Back to Search
            </button>

            {/* Real-time debounced games search bar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full max-w-md mx-auto mt-3 focus-within:border-gray-500 transition-colors">
              <Search size={16} className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                value={gameSearchRaw}
                onChange={handleGameSearchChange}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace') e.stopPropagation();
                }}
                placeholder="Search games..."
                className="flex-1 outline-none bg-transparent text-gray-100 text-sm placeholder-gray-500"
              />
              {gameSearchRaw && (
                <button
                  onClick={() => {
                    setGameSearchRaw('');
                    setGameSearchDebounced('');
                  }}
                  className="text-gray-500 hover:text-gray-300 text-lg leading-none"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-gray-400 text-xl font-medium">No results found</p>
              <p className="text-gray-600 text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto pb-8">
              {filteredGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => playGame(game.id, game.url)}
                  className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-blue-500 rounded-xl p-8 transition-all transform hover:scale-105 flex flex-col items-center gap-4 cursor-pointer"
                >
                  <div className="text-6xl">{game.icon}</div>
                  <h2 className="text-xl font-semibold text-white">{game.name}</h2>
                </button>
              ))}
            </div>
          )}

          <div className="text-center text-gray-400 text-sm pb-8">
            <p>Bart made this. Thank him. Email hongbo_wang@mufsd.org (School email) or hongbowang0821@gmail.com (personal email) for any requests or suggestions. :)</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Home / search page ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="flex items-center justify-end px-4 py-3 gap-4">
        <button className="text-sm text-gray-300 hover:underline">Gmail</button>
        <button className="text-sm text-gray-300 hover:underline">Images</button>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <Grid size={20} className="text-gray-400" />
        </button>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <User size={20} className="text-gray-400" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-20">
        <div className="text-center mb-8">
          <h1 className="text-7xl font-light mb-2">
            <span className="text-blue-500">G</span>
            <span className="text-red-500">e</span>
            <span className="text-yellow-500">e</span>
            <span className="text-blue-500">g</span>
            <span className="text-green-500">l</span>
            <span className="text-red-500">e</span>
          </h1>
        </div>

        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div
            className={`flex items-center gap-3 px-5 py-3 border border-gray-700 rounded-full transition-shadow duration-200 bg-gray-800 ${
              isSearchFocused
                ? 'shadow-lg shadow-gray-900/50'
                : 'shadow-md shadow-gray-900/30 hover:shadow-lg hover:shadow-gray-900/50'
            }`}
          >
            <Search size={20} className="text-gray-500 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace') e.stopPropagation();
              }}
              placeholder="Search Geegle or type a URL"
              className="flex-1 outline-none text-gray-100 text-base bg-transparent placeholder-gray-500"
            />
            <button
              type="button"
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              aria-label="Search by voice"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Mic size={20} className="text-blue-500" />
            </button>
            <button
              type="button"
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              aria-label="Search by image"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Image size={20} className="text-blue-500" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              type="submit"
              className="px-6 py-3 bg-gray-800 text-gray-300 text-sm rounded hover:bg-gray-700 hover:shadow-sm border border-gray-700 transition-all"
            >
              Geegle Search
            </button>
            <button
              type="button"
              onClick={handleLuckySearch}
              className="px-6 py-3 bg-gray-800 text-gray-300 text-sm rounded hover:bg-gray-700 hover:shadow-sm border border-gray-700 transition-all"
            >
              I'm Feeling Lucky
            </button>
          </div>
        </form>

        <div className="mt-8 text-sm text-gray-500">
          Geegle offered in:
          <button className="ml-2 text-blue-500 hover:underline">Español</button>
          <button className="ml-2 text-blue-500 hover:underline">Français</button>
          <button className="ml-2 text-blue-500 hover:underline">Deutsch</button>
        </div>
      </main>

      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="px-8 py-3 border-b border-gray-700">
          <p className="text-sm text-gray-500">United States</p>
        </div>
        <div className="px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-6">
            <button className="text-sm text-gray-500 hover:underline">About</button>
            <button className="text-sm text-gray-500 hover:underline">Advertising</button>
            <button className="text-sm text-gray-500 hover:underline">Business</button>
            <button className="text-sm text-gray-500 hover:underline">How Search works</button>
          </div>
          <div className="flex gap-6">
            <button className="text-sm text-gray-500 hover:underline">Privacy</button>
            <button className="text-sm text-gray-500 hover:underline">Terms</button>
            <button className="text-sm text-gray-500 hover:underline">Settings</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
