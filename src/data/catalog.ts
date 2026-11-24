/**
 * Centralized game catalog — single source of truth for every game/app card,
 * search index, category filter, and launch action in Geegle.
 *
 * Metadata model:
 *   id          stable slug (never changes; used as save/favorite key)
 *   title       corrected display name
 *   path        launch path under /games/ (encoded)
 *   categories  one or more Category keys
 *   aliases     extra search terms (misspellings, series names, keywords)
 *   thumb       artwork URL (480x270, 16:9)
 *   source      where the game build comes from, for the audit trail
 *   kind        'game' | 'app' | 'proxy' | 'stream'
 */

export type Category =
  | 'action'
  | 'adventure'
  | 'arcade'
  | 'racing'
  | 'sports'
  | 'puzzle'
  | 'strategy'
  | 'simulation'
  | 'platformer'
  | 'multiplayer'
  | 'pokemon'
  | 'retro'
  | 'horror'
  | 'casual'
  | 'all';

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All Games' },
  { key: 'action', label: 'Action' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'arcade', label: 'Arcade' },
  | 'racing', label: 'Racing' },
  { key: 'sports', label: 'Sports' },
  { key: 'puzzle', label: 'Puzzle' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'platformer', label: 'Platformer' },
  { key: 'multiplayer', label: 'Multiplayer' },
  { key: 'pokemon', label: 'Pokémon' },
  { key: 'retro', label: 'Retro' },
  { key: 'horror', label: 'Horror' },
  { key: 'casual', label: 'Casual' },
];

export interface GameEntry {
  id: string;
  title: string;
  path: string;
  categories: Category[];
  aliases?: string[];
  thumb?: string;
  source?: string;
  kind: 'game' | 'app' | 'proxy' | 'stream';
  description?: string;
}

export const games: GameEntry[] = [
  // ── Apps & tools ───────────────────────────────────────────────
  { id: 'suggestions', title: 'Suggestions', path: '/games/suggestions.html', categories: [], kind: 'app', aliases: ['request', 'feedback', 'ideas'] },
  { id: 'code-editor', title: 'Code Editor', path: '/games/Code%20Editor%20(1).html', categories: [], kind: 'app', aliases: ['vscode', 'editor', 'programming'] },
  { id: 'soundboard', title: 'Soundboard', path: '/games/Soundboard.html', categories: [], kind: 'app', aliases: ['sounds', 'sfx'] },
  { id: 'youtube', title: 'YouTube', path: 'https://www.youtube.com/', categories: [], kind: 'stream', aliases: ['yt', 'videos', 'streaming', 'stream'], source: 'YouTube official embed (youtube-nocookie.com)', description: 'YouTube search and video playback via the official privacy-enhanced embedding method.' },

  // ── Proxies (single card per service) ─────────────────────────
  { id: 'helios', title: 'Helios Proxy', path: '/games/heilos.html', categories: [], kind: 'proxy', aliases: ['browser', 'helios'] },
  { id: 'arctic', title: 'Arctic Proxy', path: '', categories: [], kind: 'proxy', aliases: ['arctic games'] },
  { id: 'cherry', title: 'Cherry Proxy', path: '', categories: [], kind: 'proxy', aliases: ['chrivtx', 'math'] },
  { id: 'soluos', title: 'Soluos Proxy', path: '', categories: [], kind: 'proxy', aliases: ['apmath', 'apenglish', 'soluos'] },
  { id: 'achroma', title: 'Achroma Proxy', path: '', categories: [], kind: 'proxy', aliases: ['cloudfront', 'calculus', 'geometry'] },
  { id: 'astra', title: 'Astra Proxy', path: '', pathPlaceholder: '', categories: [], kind: 'proxy', aliases: ['astra'] },
  { id: 'backup', title: 'Backup Proxies', path: '', categories: [], kind: 'proxy', aliases: ['misc', 'student', 'c00lkid', 'backup'] },

  // ── Games (alphabetical) ──────────────────────────────────────
  { id: 'cl2048', title: '2048', path: '/games/cl2048.html', categories: ['puzzle', 'casual'], kind: 'game', aliases: ['numbers', 'merge tiles'] },
  { id: 'cl2048cupcakes', title: '2048 Cupcakes', path: '/games/cl2048cupcakes.html', categories: ['puzzle', 'casual'], kind: 'game' },
  { id: 'cl100in1nes', title: '100 in 1 NES', path: '/games/cl100in1nes.html', categories: ['retro', 'arcade'], kind: 'game', aliases: ['nes', 'famicom', 'nintendo'] },
  { id: 'cl100roomsofenemies', title: '100 Rooms of Enemies', path: '/games/cl100RoomsOfEnemies.html', categories: ['action', 'retro'], kind: 'game' },
  { id: 'cl10bullets', title: '10 Bullets', path: '/games/cl10bullets.html', categories: ['arcade', 'action'], kind: 'game' },
  { id: 'cl10morebullets', title: '10 More Bullets', path: '/games/cl10morebullets.html', categories: ['arcade', 'action'], kind: 'game' },
  { id: 'cl10minutestildawn', title: '10 Minutes Till Dawn', path: '/games/cl10minutestildawn.html', categories: ['action', 'horror'], kind: 'game', aliases: ['vampire survivors style'] },
  { id: 'cl10yardfight', title: '10 Yard Fight', path: '/games/cl10yardfight.html', categories: ['sports', 'retro'], kind: 'game', aliases: ['football', 'nes'] },
  { id: 'cl12minibattles', title: '12 Mini Battles', path: '/games/cl12minibattles.html', categories: ['arcade', 'multiplayer'], kind: 'game' },
  { id: 'cl13bones', title: '13 Bones', path: '/games/cl13bones.html', categories: ['adventure'], kind: 'game' },
  { id: 'cl1on1soccer', title: '1 on 1 Soccer', path: '/games/cl1on1soccer.html', entries: [], kind: 'game', categories: ['sports', 'multiplayer'], aliases: ['football', 'soccer'] },
  { id: 'cl1v1lol', title: '1v1.LoL', path: '/games/cl1v1lol.html', categories: ['action', 'multiplayer'], kind: 'game', aliases: ['1v1 lol', 'one v one', 'build fight'] },
  { id: 'cl1v1tennis', title: '1v1 Tennis', path: '/games/cl1v1tennis.html', categories: ['sports', 'multiplayer'], kind: 'game' },
  { id: 'cl1942nes', title: '1942 (NES)', path: '/games/cl1942nes.html', categories: ['retro', 'arcade', 'action'], kind: 'game' },
  { id: 'cl234playergame', title: '2-3-4 Player Game', path: '/games/cl234playergame.html', categories: ['multiplayer', 'arcade'], kind: 'game' },
  { id: 'cl20smallmazes', title: '20 Small Mazes', path: '/games/cl20smallmazes.html', categories: ['puzzle'], kind: 'game' },
  { id: 'cl2doom', title: '2 Doom', path: '/games/cl2doom.html', categories: ['action', 'retro'], kind: 'game', aliases: ['doom'] },
  { id: 'cl2dshooting', title: '2D Shooting', path: '/games/cl2Dshooting.html', categories: ['action'], kind: 'game' },
  { id: 'cl3dash', title: '3 Dash', path: '/games/cl3dash.html', categories: ['platformer', 'arcade'], kind: 'game', aliases: ['geometry dash style'] },
  { id: 'cl3dasheditor', title: '3 Dash Editor', path: '/games/cl3dasheditor.html', categories: ['platformer', 'arcade'], kind: 'game' },
  { id: 'cl3pandas', title: '3 Pandas', path: '/games/cl3pandas.html', categories: ['puzzle', 'adventure'], kind: 'game' },
  { id: 'cl3pandasfantasy', title: '3 Pandas Fantasy', path: '/games/cl3pandasfantasy.html', categories: ['puzzle', 'adventure'], kind: 'game' },
  { id: 'cl3pandasbrazil', title: '3 Pandas in Brazil', path: '/games/cl3pandasbrazil.html', categories: ['puzzle', 'adventure'], kind: 'game' },
  { id: 'cl3pandasjapan', title: '3 Pandas in Japan', path: '/games/cl3pandasjapan.html', categories:['puzzle', 'adventure'], kind: 'game' },
  { id: 'cl3pandasnight', title: '3 Pandas Night', path: '/games/cl3pandasnight.html', categories: ['puzzle', 'adventure'], kind: 'game' },
  { id: 'cl3slices2', title: '3 Slices 2', path: '/games/cl3slices2.html', categories: ['puzzle'], kind: 'game' },
  { id: 'cl3dpinballspacecadet', title: '3D Pinball: Space Cadet', path: '/games/cl3dpinballspacecadet.html', categories: ['arcade', 'retro', 'simulation'], kind: 'game', aliases: ['pinball'] },
  { id: 'cl40xescape', title: '40x Escape', path: '/games/cl40xescape.html', categories: ['puzzle'], kind: 'game' },
  { id: 'cl4thandgoal', title: '4th and Goal', path: '/games/cl4thandgoal.html', categories: ['sports', 'arcade'], kind: 'game', aliases: ['football'] },
  { id: 'cl500calibercontractz', title: '500 Caliber Contractz', path: '/games/cl500calibercontractz.html', categories: ['action'], kind: 'game' },
  { user_id: 'cl60secondsbubblegum', title: '60 Seconds to Bubblegum', path: '/games/cl60secondsbubblegum.html', categories: ['arcade'], kind: 'game' },
  { id: 'clqwop', title: 'QWOP', path: '/games/clqwop.html', categories: ['sports', 'casual'], kind: 'game', aliases: ['running', 'sprinting'] },
  { id: 'clzuma', title: 'Zuma', path: '/games/clzuma.html', categories: ['puzzle', 'arcade'], kind: 'game' },
];
