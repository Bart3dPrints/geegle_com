import React, { useState, useEffect } from 'react';
import { Search, Mic, Image, Grid2x2 as Grid, User, ArrowLeft, LayoutGrid } from 'lucide-react';

const games = [
  { id: '1v1-lol', name: '1v1.LoL', url: '/games/1v1.LoL (1).html', icon: '🎮' },
  { id: 'bloxorz', name: 'Bloxorz', url: '/games/Bloxorz copy copy.html', icon: '🧊' },
  { id: 'bowmasters', name: 'Bowmasters', url: '/games/Bowmasters copy.html', icon: '🏹' },
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
  { id: 'ragdoll-archers', name: 'Ragdoll Archers', url: '/games/Ragdoll Archers copy.html', icon: '🏹' },
  { id: 'shellshock', name: 'Shell Shockers', url: '/games/online_viewer_net (5).html', icon: '🥚' },
  { id: 'slope', name: 'Slope', url: '/games/Slope.html', icon: '⛷️' },
  { id: 'snow-rider', name: 'Snow Rider 3D', url: '/games/snow-rider.html', icon: '🏂' },
  { id: 'soundboard', name: 'Soundboard', url: '/games/Soundboard.html', icon: '🔊' },
  { id: 'time-shooter-2', name: 'Time Shooter 2', url: '/games/Time Shooter 2 (1) copy.html', icon: '🔫' },
  { id: 'time-shooter-3', name: 'Time Shooter 3 SWAT', url: '/games/Time Shooter 3_ SWAT (1).html', icon: '🔫' },
  { id: 'vex-6', name: 'Vex 6', url: '/games/Vex 6.html', icon: '🏃' },
  { id: 'vex-8', name: 'Vex 8', url: '/games/Vex 8 copy copy copy.html', icon: '🏃' },
  { id: 'repo', name: 'R.E.P.O', url: '/games/R.E.P.O copy copy copy.html', icon: '🎮' },
];

function App() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showGameGrid, setShowGameGrid] = useState(false);
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const searchQuery = searchInputRef.current?.value || '';
    if (searchQuery.trim().toLowerCase() === 'cobweb') {
      setShowGameGrid(true);
    } else if (searchQuery.trim()) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
    }
  };

  const handleLuckySearch = () => {
    const searchQuery = searchInputRef.current?.value || '';
    if (searchQuery.trim().toLowerCase() === 'cobweb') {
      setShowGameGrid(true);
    } else if (searchQuery.trim()) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&btnI=1`, '_blank');
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '\\') {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'https://manhasset.instructure.com/';
      }
    };

    document.addEventListener('keydown', handleKeyPress, true);
    return () => document.removeEventListener('keydown', handleKeyPress, true);
  }, []);

  const playGame = (gameUrl: string) => {
    setCurrentGame(gameUrl);
  };

  if (currentGame) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden relative">
        <div className="absolute top-4 left-4 flex gap-3 z-50">
          <button
            onClick={() => setCurrentGame(null)}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-lg"
          >
            <ArrowLeft size={18} />
            Back to Search
          </button>
          <button
            onClick={() => {
              setCurrentGame(null);
              setShowGameGrid(true);
            }}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-lg"
          >
            <LayoutGrid size={18} />
            Game List
          </button>
        </div>
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

  if (showGameGrid) {
    return (
      <div className="w-screen h-screen bg-gray-900 overflow-y-scroll">
        <div className="p-8">
          <div className="mb-8 text-center sticky top-0 bg-gray-900 py-4 z-10">
            <h1 className="text-5xl font-bold text-white mb-4">Choose Your Game</h1>
            <button
              onClick={() => setShowGameGrid(false)}
              className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Back to Search
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto pb-8">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => playGame(game.url)}
                className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-blue-500 rounded-xl p-8 transition-all transform hover:scale-105 flex flex-col items-center gap-4 cursor-pointer"
              >
                <div className="text-6xl">{game.icon}</div>
                <h2 className="text-xl font-semibold text-white">{game.name}</h2>
              </button>
            ))}
          </div>

          <div className="text-center text-gray-400 text-sm pb-8">
            <p>Click any game to play it fullscreen</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="flex items-center justify-end px-4 py-3 gap-4">
        <button className="text-sm text-gray-300 hover:underline">
          Gmail
        </button>
        <button className="text-sm text-gray-300 hover:underline">
          Images
        </button>
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
              isSearchFocused ? 'shadow-lg shadow-gray-900/50' : 'shadow-md shadow-gray-900/30 hover:shadow-lg hover:shadow-gray-900/50'
            }`}
          >
            <Search size={20} className="text-gray-500 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace') {
                  e.stopPropagation();
                }
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
