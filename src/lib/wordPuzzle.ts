// Original unlimited five-letter word puzzle used by the Everythingle card.
// All code and the word list are authored for Geegle; there is no third-party
// puzzle data, server dependency or remote request.

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type LetterState = 'correct' | 'present' | 'absent';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface PuzzleState {
  /** The hidden answer for this round. */
  answer: string;
  /** Guesses already accepted, oldest first. */
  guesses: string[];
  status: GameStatus;
  /** Monotonic round counter, so a finished round can be replaced. */
  round: number;
}

export interface PuzzleStats {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
}

export const EMPTY_STATS: PuzzleStats = { played: 0, won: 0, streak: 0, bestStreak: 0 };

/** Answers are ordinary English five-letter words. */
export const PUZZLE_WORDS: readonly string[] = [
  'about', 'above', 'abuse', 'actor', 'acute', 'admit', 'adopt', 'adult', 'after', 'again',
  'agent', 'agree', 'ahead', 'alarm', 'album', 'alert', 'alike', 'alive', 'allow', 'alone',
  'along', 'alter', 'among', 'anger', 'angle', 'angry', 'apart', 'apple', 'apply', 'arena',
  'argue', 'arise', 'array', 'aside', 'asset', 'audio', 'audit', 'avoid', 'award', 'aware',
  'badly', 'baker', 'bases', 'basic', 'beach', 'began', 'begin', 'begun', 'being', 'below',
  'bench', 'birth', 'black', 'blame', 'blank', 'blast', 'blind', 'block', 'blood', 'board',
  'boost', 'booth', 'bound', 'brain', 'brand', 'bread', 'break', 'breed', 'brief', 'bring',
  'broad', 'broke', 'brown', 'build', 'built', 'buyer', 'cable', 'calif', 'carry', 'catch',
  'cause', 'chain', 'chair', 'chart', 'chase', 'cheap', 'check', 'chest', 'chief', 'child',
  'china', 'chose', 'civil', 'claim', 'class', 'clean', 'clear', 'click', 'clock', 'close',
  'coach', 'coast', 'could', 'count', 'court', 'cover', 'craft', 'crane', 'crash', 'cream', 'crime',
  'cross', 'crowd', 'crown', 'curve', 'cycle', 'daily', 'dance', 'dated', 'dealt', 'death',
  'debut', 'delay', 'depth', 'doing', 'doubt', 'dozen', 'draft', 'drama', 'drawn', 'dream',
  'dress', 'drill', 'drink', 'drive', 'drove', 'dying', 'eager', 'early', 'earth', 'eight',
  'elite', 'empty', 'enemy', 'enjoy', 'enter', 'entry', 'equal', 'error', 'event', 'every',
  'exact', 'exist', 'extra', 'faith', 'false', 'fault', 'fiber', 'field', 'fifth', 'fifty',
  'fight', 'final', 'first', 'fixed', 'flash', 'fleet', 'floor', 'focus', 'force', 'forth',
  'forty', 'forum', 'found', 'frame', 'frank', 'fraud', 'fresh', 'front', 'fruit', 'fully',
  'funny', 'giant', 'given', 'glass', 'globe', 'going', 'grace', 'grade', 'grand', 'grant',
  'grass', 'great', 'green', 'gross', 'group', 'grown', 'guard', 'guess', 'guest', 'guide',
  'happy', 'harsh', 'heart', 'heavy', 'hence', 'horse', 'hotel', 'house', 'human', 'ideal',
  'image', 'index', 'inner', 'input', 'issue', 'japan', 'jimmy', 'joint', 'jones', 'judge',
  'known', 'label', 'large', 'laser', 'later', 'laugh', 'layer', 'learn', 'lease', 'least',
  'leave', 'legal', 'level', 'lewis', 'light', 'limit', 'links', 'lives', 'local', 'logic',
  'loose', 'lower', 'lucky', 'lunch', 'lying', 'magic', 'major', 'maker', 'march', 'maria',
  'match', 'maybe', 'mayor', 'meant', 'media', 'metal', 'might', 'minor', 'minus', 'mixed',
  'model', 'money', 'month', 'moral', 'motor', 'mount', 'mouse', 'mouth', 'movie', 'music',
  'needs', 'never', 'newly', 'night', 'noise', 'north', 'noted', 'novel', 'nurse', 'occur',
  'ocean', 'offer', 'often', 'order', 'other', 'ought', 'paint', 'panel', 'paper', 'party',
  'peace', 'peter', 'phase', 'phone', 'photo', 'piece', 'pilot', 'pitch', 'place', 'plain',
  'plane', 'plant', 'plate', 'point', 'pound', 'power', 'press', 'price', 'pride', 'prime',
  'print', 'prior', 'prize', 'proof', 'proud', 'prove', 'queen', 'quick', 'quiet', 'quite',
  'radio', 'raise', 'range', 'rapid', 'ratio', 'reach', 'ready', 'refer', 'right', 'rival',
  'river', 'robin', 'roger', 'roman', 'rough', 'round', 'route', 'royal', 'rural', 'scale',
  'scene', 'scope', 'score', 'sense', 'serve', 'seven', 'shall', 'shape', 'share', 'sharp',
  'sheet', 'shelf', 'shell', 'shift', 'shirt', 'shock', 'shoot', 'short', 'shown', 'sight',
  'since', 'sixth', 'sixty', 'sized', 'skill', 'sleep', 'slide', 'small', 'smart', 'smile',
  'smith', 'smoke', 'solid', 'solve', 'sorry', 'sound', 'south', 'space', 'spare', 'speak',
  'speed', 'spend', 'spent', 'split', 'spoke', 'sport', 'staff', 'stage', 'stake', 'stand',
  'start', 'state', 'steam', 'steel', 'stick', 'still', 'stock', 'stone', 'stood', 'store',
  'storm', 'story', 'strip', 'stuck', 'study', 'stuff', 'style', 'sugar', 'suite', 'super',
  'sweet', 'table', 'taken', 'taste', 'taxes', 'teach', 'teeth', 'terry', 'texas', 'thank',
  'theft', 'their', 'theme', 'there', 'these', 'thick', 'thing', 'think', 'third', 'those',
  'three', 'threw', 'throw', 'tight', 'times', 'tired', 'title', 'today', 'topic', 'total',
  'touch', 'tough', 'tower', 'track', 'trade', 'train', 'treat', 'trend', 'trial', 'tried',
  'tries', 'truck', 'truly', 'trust', 'truth', 'twice', 'under', 'undue', 'union', 'unity',
  'until', 'upper', 'upset', 'urban', 'usage', 'usual', 'valid', 'value', 'video', 'virus',
  'visit', 'vital', 'voice', 'waste', 'watch', 'water', 'wheel', 'where', 'which', 'while',
  'white', 'whole', 'whose', 'woman', 'women', 'world', 'worry', 'worse', 'worst', 'worth',
  'would', 'wound', 'write', 'wrong', 'wrote', 'yield', 'young', 'youth',
];

/** Faster membership check; both answers and accepted guesses come from here. */
const WORDS = new Set(PUZZLE_WORDS);

/** Small deterministic hash so a puzzle can be picked from any seed. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickAnswer(seed: string | number): string {
  const index = hashSeed(String(seed)) % PUZZLE_WORDS.length;
  return PUZZLE_WORDS[index];
}

export function isAcceptedWord(word: string): boolean {
  return WORDS.has(word.toLowerCase());
}

/**
 * Score a guess with the usual two-pass duplicate rule: exact matches claim
 * their letters first, then remaining letters are matched left to right.
 */
export function scoreGuess(answer: string, guess: string): LetterState[] {
  const target = answer.toLowerCase().split('');
  const letters = guess.toLowerCase().split('');
  const result: LetterState[] = letters.map(() => 'absent');
  const remaining: Record<string, number> = {};

  letters.forEach((letter, index) => {
    if (target[index] === letter) result[index] = 'correct';
    else remaining[target[index]] = (remaining[target[index]] ?? 0) + 1;
  });

  letters.forEach((letter, index) => {
    if (result[index] === 'correct') return;
    if ((remaining[letter] ?? 0) > 0) {
      result[index] = 'present';
      remaining[letter] -= 1;
    }
  });

  return result;
}

/** Keyboard hint for every letter already tried. */
export function letterHints(state: PuzzleState): Record<string, LetterState> {
  const hints: Record<string, LetterState> = {};
  const rank: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };
  for (const guess of state.guesses) {
    const scores = scoreGuess(state.answer, guess);
    guess.split('').forEach((letter, index) => {
      const next = scores[index];
      if (!hints[letter] || rank[next] > rank[hints[letter]]) hints[letter] = next;
    });
  }
  return hints;
}

export function startRound(round: number, seed?: string): PuzzleState {
  return {
    answer: pickAnswer(seed ?? `geegle-${round}`),
    guesses: [],
    status: 'playing',
    round,
  };
}

export type SubmitResult =
  | { ok: false; reason: 'short' | 'unknown' | 'finished' }
  | { ok: true; state: PuzzleState };

/** A guess is accepted only when it is five letters, known, and the round is open. */
export function submitGuess(state: PuzzleState, raw: string): SubmitResult {
  const guess = raw.trim().toLowerCase();
  if (state.status !== 'playing') return { ok: false, reason: 'finished' };
  if (!/^[a-z]{5}$/.test(guess)) return { ok: false, reason: 'short' };
  if (!isAcceptedWord(guess)) return { ok: false, reason: 'unknown' };

  const guesses = [...state.guesses, guess];
  const status: GameStatus =
    guess === state.answer ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  return { ok: true, state: { ...state, guesses, status } };
}

export function roundsStats(stats: PuzzleStats, status: GameStatus): PuzzleStats {
  if (status === 'playing') return stats;
  const won = status === 'won';
  const streak = won ? stats.streak + 1 : 0;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  };
}

export function parsePuzzleState(value: unknown): PuzzleState | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.answer !== 'string' || !/^[a-z]{5}$/.test(record.answer)) return null;
  if (!Array.isArray(record.guesses)) return null;
  const guesses = record.guesses.filter(
    (guess): guess is string => typeof guess === 'string' && /^[a-z]{5}$/.test(guess)
  );
  const status: GameStatus =
    record.status === 'won' || record.status === 'lost' ? record.status : 'playing';
  const round = Number.isInteger(record.round) && (record.round as number) >= 1 ? (record.round as number) : 1;
  return { answer: record.answer, guesses, status, round };
}

export function parseStats(value: unknown): PuzzleStats {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const count = (entry: unknown) =>
    Number.isInteger(entry) && (entry as number) >= 0 ? (entry as number) : 0;
  return {
    played: count(record.played),
    won: count(record.won),
    streak: count(record.streak),
    bestStreak: count(record.bestStreak),
  };
}
