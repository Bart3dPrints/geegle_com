/**
 * Central catalog. Single source of truth for every card grid, the fuzzy
 * search index, category filters, and launch actions.
 *
 * The legacy library is stored as compact pipe-delimited data in
 * src/data/raw/*.txt (format: id|title|categories). Launch paths follow
 * /games/{id}.html except where overridden in path-exceptions.txt.
 *
 * Data files are discovered with import.meta.glob and bundled at build time —
 * no runtime fetch, zero extra network requests.
 */
import type { Category, GameEntry } from './types';
import { CATEGORIES } from './types';

const rawModules = import.meta.glob('./raw/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

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
};

/** Extra search terms for well-known games and series. */
const ALIASES: Record<string, string[]> = {
  cl1v1lol: ['1v1 lol', 'build fight', 'one vs one'],
  cl2048: ['numbers', 'merge tiles'],
  clbaldisbasics: ['baldi'],
  clbloonstd5: ['btd5', 'bloons tower defense 5'],
  clcrashbandicoot2: ['crash bandicoot 2', 'the huge adventure'],
  clpolytrackworksnow: ['polytrack', 'polytrack works now'],
  clhobo: ['hobo 1', 'hobo brawl', 'seethingswarm'],
  clhobo2: ['hobo 2'],
  clhobo3: ['hobo 3'],
  clhobo4: ['hobo 4'],
  clhobo5: ['hobo 5'],
  clhobo6: ['hobo 6'],
  clhobo7: ['hobo 7'],
  clhobovszombies: ['hobo vs zombies'],
  clstickminbreakingbank: ['henry stickmin', 'breaking the bank', 'stickman'],
  clstickminescapingprison: ['henry stickmin', 'escaping the prison', 'stickman'],
  clstickmanstealingdiamond: ['henry stickmin', 'stealing the diamond', 'stickman'],
  clstickminfleecomplex: ['henry stickmin', 'fleeing the complex', 'stickman'],
  clstickminairship: ['henry stickmin', 'infiltrating the airship', 'stickman'],
  clsnowrider: ['snow rider', 'snow rider 3d', 'snowboard'],
  'snow-rider': ['snow rider', 'snow rider 3d nostalgia', 'snowboard'],
  clsnowridergoodygumdrops: ['snow rider', 'goody gumdrops', 'snowboard'],
  clsnowriderrrr: ['snow rider', 'snow rider rrr', 'snowboard'],
  clvampiresurvivors: ['vampire survivors'],
  clfnfsonicexe: ['sonic exe', 'fnf sonic'],
  clgeometrydashwave: ['geometry dash'],
  clslope: ['slope game'],
  cltunnelrush: ['tunnel rush'],
};

/**
 * Owner-authorized exception to the restore-everything policy: only
 * "Polytrack (working)" (clpolytrackworksnow) may appear in Games, search,
 * categories, Recently Played and Starred. These IDs are filtered even if a
 * historical restoration or saved-data reference tries to bring them back.
 */
const EXCLUDED_IDS = new Set(['clpolytrackbutnotflagged', 'clpolytrackbutnotflagged-1']);

/** Derived secondary categories for accurate classification. */
const CATEGORY_ADDITIONS: Record<string, Category[]> = {
  clhobo: ['fighting'],
  clhobo2: ['fighting'],
  clhobo3: ['fighting'],
  clhobo4: ['fighting'],
  clhobo5: ['fighting'],
  clhobo6: ['fighting'],
  clhobo7: ['fighting'],
  clhobovszombies: ['fighting'],
  clmortalkombat: ['fighting'],
  clmortalkombat2: ['fighting'],
  clmortalkombat3: ['fighting'],
  clmortalkombat4: ['fighting'],
  clultimatemortalkombat: ['fighting'],
  clultimatemortalkombat3: ['fighting'],
  clstreetfighter2: ['fighting'],
  clstreetfighteralpha3: ['fighting'],
  clsupersmashbros: ['fighting'],
  clsupersmashflash: ['fighting'],
  clsupersmashflash2: ['fighting'],
  cltekken2ps1: ['fighting'],
  cltekken3ps1: ['fighting'],
  clpunchout: ['fighting', 'sports'],
  clsuperpunchout: ['fighting', 'sports'],
  clbulletforce: ['shooting'],
  clbuildnowgg: ['shooting'],
  clpixelshooter: ['shooting'],
  clmineshooter: ['shooting'],
  clpixelgun: ['shooting'],
  clpixelcombat2: ['shooting'],
  clsnipershot: ['shooting'],
  cljohnnytrigger: ['shooting'],
  clfunnyshooter2: ['shooting'],
  clcounterstrike16: ['shooting'],
  clidlebreakout: ['idle', 'casual'],
  clidleidlegamedev: ['idle'],
  clidledice: ['idle'],
  clantimatterdimensions: ['idle'],
  clnguidle: ['idle'],
  clmagetoweridle: ['idle'],
  clcookieclicker: ['idle', 'casual'],
  clrevolutionidle: ['idle'],
  clprestigetree: ['idle'],
  clomegalayers: ['idle'],
  clspacebarclicker: ['idle'],
  clquantumclicker: ['idle'],
  clcsgoclicker: ['idle'],
  clcapybaraclicker: ['idle'],
  clomeganuggetclicker: ['idle'],
  clhardwaretycoon: ['idle', 'simulation'],
  clprocessor: ['idle', 'simulation'],
};

const legacyGames: GameEntry[] = [];
for (const [fileName, raw] of Object.entries(rawModules)) {
  if (fileName === './raw/path-exceptions.txt') continue;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [id, title, cats] = trimmed.split('|');
    if (!id || !title || !cats) continue;

    const base = cats
      .split(',')
      .filter((c): c is Category => VALID_CATEGORIES.has(c as Category));
    const extra = CATEGORY_ADDITIONS[id] ?? [];
    const categories = [...new Set([...base, ...extra])];

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

/** Deduplicate by id, keeping the first occurrence. Distinct game versions
 * keep distinct IDs, so this only guards against the same row appearing in two
 * raw data files; it never collapses alternate builds. */
const seen = new Set<string>();
export const legacyCatalog: GameEntry[] = legacyGames.filter((g) => {
  if (EXCLUDED_IDS.has(g.id)) return false;
  if (seen.has(g.id)) return false;
  seen.add(g.id);
  return true;
});

export { CATEGORIES };
export type { Category, GameEntry };
