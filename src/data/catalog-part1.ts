/**
 * Legacy catalog part 1: games A-C extracted from the original App.tsx.
 * Titles corrected to proper capitalization. `aliases` include legacy
 * misspellings and series keywords so fuzzy search finds them.
 *
 * The `source` field documents the build origin for the audit trail.
 */
import type { GameEntry } from './catalog';

export const GAMES_A_C: GameEntry[] = [
  // ── A ────────────────────────────────────────────────────────────────
  { id: 'cl1', title: '1 (Classic)', path: '/games/cl1.html', categories: ['arcade'], kind: 'game' },
  { id: 'cl1on1soccer', title: '1 on 1 Soccer', path: '/games/cl1on1soccer.html', categories: ['sports', 'multiplayer'], kind: 'game', aliases: ['soccer', 'football'] },
  { id: 'cl1v1lol', title: '1v1.LOL', path: '/games/cl1v1lol.html', categories: ['action', 'multiplayer'], kind: 'game', aliases: ['1v1 lol', 'one vs one', 'build fight'] },
  { id: 'cl1v1tennis', title: '1v1 Tennis', path: '/games/cl1v1tennis.html', categories: ['sports', 'multiplayer'], kind: 'game' },
  { id: 'cl10bullets', title: '10 Bullets', path: '/games/cl10bullets.html', categories: ['arcade', 'action'], kind: 'game' },
  { id: 'cl10morebullets', title: '10 More Bullets', path: '/games/cl10morebullets.html', parts: [], categories: ['arcade', 'action'], kind: 'game' },
  { id: 'cl10minutestildawn', title: '10 Minutes Till Dawn', path: '/games/cl10minutestildawn.html', categories: ['action', 'horror'], kind: 'game', aliases: ['vampire survivors'] },
  { id: 'cl10yardfight', title: '10 Yard Fight', path: '/games/cl10yardfight.html', categories: ['sports', 'retro'], kind: 'game', aliases: ['football'] },
  { id: 'cl12minibattles', title: '12 Mini Battles', path: '/games/cl12minibattles.html', categories: ['arcade', 'multiplayer'], kind: 'game' },
  { id: 'cl13bones', title: '13 Bones', path: '/games/cl13bones.html', categories: ['adventure'], kind: 'game' },
  { id: 'cl1942nes', title: '1942 (NES)', path: '/games/cl1942nes.html', categories: ['retro', 'arcade', 'action'], kind: 'game' },
  { id: 'cl100in1nes', title: '100 in 1 NES', path: '/games/cl100in1nes.html', categories: ['retro', 'arcade'], kind: 'game', aliases: ['nes', 'famicom'] },
  { id: 'cl100roomsofenemies', title: '100 Rooms of Enemies', path: '/games/cl100RoomsOfEnemies.html', categories: ['action', 'retro'], kind: 'game' },
  { id: 'cl20smallmazes', title: '20 Small Mazes', path: '/games/cl20smallmazes.html', categories: ['puzzle'], kind: 'game' },
  { id: 'cl2048', title: '2048', path: '/games/cl2048.html', categories: ['puzzle', 'casual'], kind: 'game', aliases: ['numbers', 'merge tiles'] },
  { id: 'cl2048cupcakes', title: '2048 Cupcakes', path: '/games/cl2048cupcakes.html', categories: ['puzzle', 'casual'], kind: 'game' },
  { id: 'cl2doom', title: '2 Doom', path: '/games/cl2doom.html', categories: ['action', 'retro'], kind: 'game', aliases: ['doom'] },
  { id: 'cl234playergame', title: '2-3-4 Player Game', path: '/games/cl234playergame.html', categories: ['multiplayer', 'arcade'], kind: 'game' },
  { id: 'cl2dshooting', title: '2D Shooting', path: '/games/cl2Dshooting.html', categories: ['action'], kind: 'game' },
  { id: 'cl3dash', title: '3 Dash', path: '/games/cl3dash.html', categories: ['platformer', 'arcade'], kind: 'game', aliases: ['geometry dash'] },
  { id: 'cl3dasheditor', title: '3 Dash Editor', path: '/games/cl3dasheditor.html', categories: ['platformer', 'arcade'], kind: 'game' },
  { id: 'cl3pandas', title: '3 Pandas', path: '/games/cl3pandas.html', categories: ['puzzle', 'adventure'], kind: 'game' },
  { id: 'cl3pandasfantasy', title: '3 Pandas Fantasy', path: '/games/cl3pandasfantasy.html', categories: ['puzzle', 'adventure'], kind: 'game' },
  { id: 'cl3pandasbrazil', title: '3 Pandas in Brazil', path: /"