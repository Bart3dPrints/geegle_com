/**
 * Central catalog. Single source of truth for every card grid, the fuzzy
 * search index, category filters, and launch actions.
 *
 * The legacy library (~700 games) is stored as compact pipe-delimited data in
 * src/data/raw/*.txt (format: id|title|primaryCategory). Launch paths follow
 * /games/{id}.html except where overridden in path-exceptions.txt, which
 * preserves the exact original file names (spaces, parentheses, casing).
 *
 * Data files are imported as raw strings at build time — they are NOT fetched
 * at runtime, so the catalog adds zero network requests.
 */
import type { Category, GameEntry } from './types';
import { CATEGORIES } from './types';

import acRaw from './raw/a-c.txt?raw';
import bRaw from './raw/b.txt?raw';
import cRaw from './raw/c.txt?raw';
import dRaw from './raw/d.txt?raw';
import eRaw from './raw/e.txt?raw';
import fgRaw from './raw/f-g.txt?raw';
import hRaw from './raw/h.txt?raw';
import iRaw from './raw/i.txt?raw';
import jRaw from './raw/j.txt?raw';
import kRaw from './raw/k.txt?raw';
import lRaw from './raw/l.txt?raw';
import mRaw from './raw/m.txt?raw';
import nRaw from './raw/n.txt?raw';
import oRaw from './raw/o.txt?raw';
import pRaw from './raw/p.txt?raw';
import qRaw from './raw/q.txt?raw';
import rRaw from './raw/r.txt?raw';
import sRaw from './raw/s.txt?raw';
import tRaw from './raw/t.txt?raw';
import uRaw from './raw/u.txt?raw';
import vRaw from './raw/v.txt?raw';
import wzRaw from './raw/w-z.txt?raw';
import exceptionsRaw from './raw/path-exceptions.txt?raw';

const RAW_CHUNKS = [acRaw, bRaw, cRaw, dRaw, eRaw, fgRaw, hRaw, iRaw, jRaw, kRaw, lRaw, mRaw, nRaw, oRaw, pRaw, qRaw, rRaw, sRaw, tRaw, uRaw, vRaw, wzRaw];

/** Legacy file names that differ from the /games/{id}.html pattern. */
const pathExceptions: Record<string, string> = {};
for (const line of exceptionsRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const bar = trimmed.indexOf('|');
  if (bar > 0) pathExceptions[trimmed.slice(0, bar)] = trimmed.slice(bar + 1);
}

function parseChunk(raw: string): GameEntry[] {
  const out: GameEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [id, title, cat] = trimmed.split('|');
    if (!id || !title || !cat) continue;
    const categories = cat.split(',').filter((c): c is Category =>
      CATEGORIES.some((def) => def.key === c)
    );
    out.push({
      id,
      title,
      path: pathExceptions[id] ?? `/games/${encodeURIComponent(id)}.html`,
      categories,
      kind: 'game',
    });
  }
  return out;
}

/** Games whose title in the legacy app was misspelled or badly cased. */
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
  clpokemongold: ['pokemon gold version'],
  clpokemonsilver: ['pokemon silver version'],
  clpokemoncrystal: ['pokemon crystal version'],
  clpokemonruby: ['pokemon ruby version'],
  clpokemonsapphire: ['pokemon sapphire version'],
  clpokemonemerald: ['pokemon emerald version'],
  clpokemonfirered: ['pokemon firered version'],
  clpokemonleafgreen: ['pokemon leafgreen version'],
  clpokeblack: ['pokemon black version'],
  clpokewhite: ['pokemon white version'],
  clpokeblack2: ['pokemon black 2'],
  clpokewhite2: ['pokemon white 2'],
  clpokepearl: ['pokemon pearl version'],
  clpokediamond: ['pokemon diamond version'],
  clpokeplatinum: ['pokemon platinum version'],
  clpokemongold: ['pokemon heartgold'],
  clfnfsonicexe: ['sonic exe', 'fnf sonic'],
  clgeometrydashwave: ['geometry dash'],
  clslope: ['slope game'],
  cltunnelrush: ['tunnel rush'],
};

const legacyGames: GameEntry[] = [];
for (const chunk of RAW_CHUNKS) {
  for (const entry of parseChunk(chunk)) {
    const fix = TITLE_FIXES[entry.id];
    if (fix) entry.title = fix;
    const alias = ALIASES[entry.id];
    if (alias) entry.aliases = alias;
    legacyGames.push(entry);
  }
}

export { CATEGORIES };
export type { Category, GameEntry };
