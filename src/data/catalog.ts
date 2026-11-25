/**
 * Central catalog. Single source of truth for every card grid, the fuzzy
 * search index, category filters, and launch actions.
 *
 * The legacy library is stored as compact pipe-delimited data in
 * src/data/raw/*.txt (format: id|title|primaryCategory). Launch paths follow
 * /games/{id}.html except where overridden in path-exceptions.txt.
 *
 * Data files are discovered with import.meta.glob and bundled at build time —
 * no runtime fetch, zero extra network requests. Adding a new letter file
 * requires no code change here. Missing letter files simply contribute no
 * games, so the branch always builds.
 */
import type { Category, GameEntry } from './types';
import { CATEGORIES } from './types';

const rawModules = import.meta.glob('./raw/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Legacy file names that differ from the /games/{id}.html pattern. */
const pathExceptions: Record<string, string> = {};
{
  const exceptionsRaw = rawModules['./raw/path-exceptions.txt'] ?? '';
  for (const line of exceptionsRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const bar = trimmed.indexOf('|');
    if (bar > 0) pathExceptions[trimmed.slice(0, bar)] = trimmed.slice(bar + 1);
  }
}

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.key));

/** Games whose legacy title was misspelled or badly cased. */
const TITLE_FIXES: Record<string, string> = {
  clachillies: 'Achilles',
  clachillies2: 'Achilles 2',
  clbanjotooie: 'Banjo-Tooie',
  clbearbarians: 'Bearbarians',
  clbejeweledtwistflash: 'Bejeweled Twist (Flash)',
  clfuschiax: 'Fuchsia X',
  clmist: 'MiST',
};

/** Extra search terms for well-known games and series. */
const ALIASES: Record<string, string[]> = {
  cl1v1lol: ['1v1 lol', 'build fight', 'one vs one'],
  cl2048: ['numbers', 'merge tiles'],
  clbadicecream: ['bad ice cream 1'],
  clbaldisbasics: ['baldi'],
  clbloonstd5: ['btd5', 'bloons tower defense 5'],
  clhobo: ['hobo 1'],
  clhobo2: ['hobo 2'],
  clhobo3: ['hobo 3'],
  clhobo4: ['hobo 4'],
  clhobo5: ['hobo 5'],
  clhobo6: ['hobo 6'],
  clhobo7: ['hobo 7'],
  clhobovszombies: ['hobo vs zombies'],
  clstickminbreakingbank: ['henry stickmin', 'breaking the bank', 'stickmin'],
  clstickminescapingprison: ['henry stickmin', 'escaping the prison', 'stickmin'],
  clstickminstealingdiamond: ['henry stickmin', 'stealing the diamond', 'stickmin'],
  clstickminfleecomplex: ['henry stickmin', 'fleeing the complex', 'stickmin'],
  clstickminairship: ['henry stickmin', 'infiltrating the airship', 'stickmin'],
  clvampiresurvivors: ['vampire survivors'],
  clfnfsonicexe: ['sonic exe', 'fnf sonic'],
  clgeometrydashwave: ['geometry dash'],
  clslope: ['slope game'],
  cltunnelrush: [' tunnel rush'],
};

const legacyGames: GameEntry[] = [];
for (const [fileName, raw] of Object.entries(rawModules)) {
  if (fileName === './raw/path-exceptions.txt') continue;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [id, title, cats] = trimmed.split('|');
    if (!id || !title || !cats) continue;
    const categories = cats
      .split(',')
      .filter((c): c is Category => VALID_CATEGORIES.has(c as Category));
    const fix = TITLE_FIXES[id];
    const alias = ALIASES[id];
    legacyGames.push({
      id,
      title: fix ?? title,
      path: pathExceptions[id] ?? `/games/${encodeURIComponent(id)}.html`,
      categories: categories.length > 0 ? categories : ['arcade'],
      kind: 'game',
      ...(alias ? { aliases: alias } : {}),
    });
  }
}

/** Deduplicate by id, keeping the first occurrence. */
const seen = new Set<string>();
export const legacyCatalog: GameEntry[] = legacyGames.filter((g) => {
  if (seen.has(g.id)) return false;
  seen.add(g.id);
  return true;
});

export { CATEGORIES };
export type { Category, GameEntry };
