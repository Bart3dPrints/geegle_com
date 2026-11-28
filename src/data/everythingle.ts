// The complete Everythingle collection, recorded from the provider's own
// inventory (https://everythingle.com/about, 50 games, checked 2026-11-28).
//
// Everythingle's Terms of Service forbid copying, reselling or redistributing
// the site or its games, so Geegle does not proxy, mirror or rehost them. Every
// game below is reachable at its official provider page; the word formats that
// Geegle implements itself are marked with `local` and are original code with
// original word data, never a copy of the provider's build.

export type EverythingleCategory =
  | 'Word'
  | 'Prompt'
  | 'Meaning'
  | 'Geography'
  | 'Music & pop culture'
  | 'Numbers & science'
  | 'Strategy';

/** A Geegle-native implementation of this game's format. */
export type LocalGameId = 'five-letter' | 'dordle' | 'quordle' | 'word500' | 'middle-word';

export interface EverythingleGame {
  slug: string;
  title: string;
  blurb: string;
  category: EverythingleCategory;
  /** Set only when Geegle has its own playable implementation of the format. */
  local?: LocalGameId;
}

export const EVERYTHINGLE_CATEGORIES: EverythingleCategory[] = [
  'Word',
  'Prompt',
  'Meaning',
  'Geography',
  'Music & pop culture',
  'Numbers & science',
  'Strategy',
];

export const EVERYTHINGLE_GAMES: EverythingleGame[] = [
  // Wordle-style word games
  { slug: 'wordle', title: 'Wordle Unlimited', blurb: 'Guess the five-letter word in six tries.', category: 'Word', local: 'five-letter' },
  { slug: 'middle-word', title: 'Middle Word Unlimited', blurb: 'Find the word hiding alphabetically between two others.', category: 'Word', local: 'middle-word' },
  { slug: 'quordle', title: 'Quordle Unlimited', blurb: 'Solve four Wordles at once in nine tries.', category: 'Word', local: 'quordle' },
  { slug: 'dordle', title: 'Dordle Unlimited', blurb: 'Solve two Wordles at once in seven tries.', category: 'Word', local: 'dordle' },
  { slug: 'word500', title: 'Word500 Unlimited', blurb: 'Eight tries, with only green, yellow and red counts as clues.', category: 'Word', local: 'word500' },
  { slug: 'columnle', title: 'Columnle Unlimited', blurb: 'Write your first five guesses down the columns.', category: 'Word' },
  { slug: 'dontwordle', title: "Don't Wordle Unlimited", blurb: 'Last six guesses without hitting the hidden word.', category: 'Word' },
  { slug: 'letroso', title: 'Letroso Unlimited', blurb: 'Find a secret word of up to ten letters with colour and shape clues.', category: 'Word' },
  { slug: 'expresso', title: 'Expresso Unlimited', blurb: 'Work out the secret expression from colour-coded letters.', category: 'Word' },
  { slug: 'unwordle', title: 'Unwordle Unlimited', blurb: 'You get the final word and the colours; rebuild the guesses.', category: 'Word' },
  { slug: 'jeffgoldblumle', title: 'Jeffgoldblumle', blurb: 'Guess the twelve-letter word in three tries.', category: 'Word' },
  { slug: 'poople', title: 'Poople', blurb: 'A word ladder: change one letter at a time to reach POOP.', category: 'Word' },
  { slug: 'spelling-bee', title: 'Spelling Bee Unlimited', blurb: 'Spell as many words as you can from seven letters.', category: 'Word' },
  { slug: 'word-hunt', title: 'Word Hunt Unlimited', blurb: 'Drag across a 4x4 grid to find words in eighty seconds.', category: 'Word' },

  // Krillion-style prompt games
  { slug: 'krillion', title: 'Krillion Unlimited', blurb: 'Answer prompts against the clock; rarer answers sink deeper.', category: 'Prompt' },
  { slug: 'noillirk', title: 'Noillirk', blurb: 'Answer prompts against the clock; common answers float higher.', category: 'Prompt' },
  { slug: 'wonderhop', title: 'Wonderhop Unlimited', blurb: 'A survey game where the most common or rarest answer wins.', category: 'Prompt' },

  // Word meaning and connection games
  { slug: 'contexto', title: 'Contexto Unlimited', blurb: 'Find the secret word; every guess is ranked by meaning.', category: 'Meaning' },
  { slug: 'connectdle', title: 'Connectdle', blurb: 'Sort sixteen words into four hidden groups.', category: 'Meaning' },
  { slug: 'chainle', title: 'Chainle Unlimited', blurb: 'Type one word that links the clue words in meaning.', category: 'Meaning' },
  { slug: 'spamle', title: 'Spamle', blurb: 'Name as many things in a category as you can before time runs out.', category: 'Meaning' },
  { slug: 'minute-cryptic', title: 'Minute Cryptic Unlimited', blurb: 'Solve a short cryptic clue at a time and try to beat par.', category: 'Meaning' },

  // Geography
  { slug: 'worldle', title: 'Worldle Unlimited', blurb: 'Name the country or territory from its outline.', category: 'Geography' },
  { slug: 'globle', title: 'Globle Unlimited', blurb: 'Find the mystery country on a globe, guided by distance.', category: 'Geography' },
  { slug: 'travle', title: 'Travle Unlimited', blurb: 'Name every country between a start and an end country.', category: 'Geography' },
  { slug: 'krillion-geography', title: 'Krillion Geography Unlimited', blurb: 'Seven geography questions where rarer answers trek further.', category: 'Geography' },
  { slug: 'flagle', title: 'Flagle Unlimited', blurb: 'Guess the flag as it is revealed one piece at a time.', category: 'Geography' },
  { slug: 'farflung', title: 'Farflung Unlimited', blurb: 'Pin a country for each prompt; rarer answers travel further.', category: 'Geography' },

  // Music and pop culture
  { slug: 'guess-the-song', title: 'Guess the Song', blurb: 'Name the track from a split-second clip.', category: 'Music & pop culture' },
  { slug: 'spotle', title: 'Spotle Unlimited', blurb: 'Guess the mystery music artist in ten tries.', category: 'Music & pop culture' },
  { slug: 'brandle', title: 'Brandle Unlimited', blurb: 'Guess the brand from a blurred logo that sharpens.', category: 'Music & pop culture' },
  { slug: 'onbrand', title: 'On Brand Unlimited', blurb: "Mix a famous logo's missing colour from memory.", category: 'Music & pop culture' },
  { slug: 'minecraftle', title: 'Minecraftle Unlimited', blurb: 'Guess the secret crafting recipe in ten tries.', category: 'Music & pop culture' },
  { slug: 'kabloom', title: 'Kabloom Unlimited', blurb: 'Answer seven trivia questions before the volcano erupts.', category: 'Music & pop culture' },
  { slug: 'framed', title: 'Framed Unlimited', blurb: 'Guess the movie from its frames, one more after each miss.', category: 'Music & pop culture' },

  // Numbers, science and perception
  { slug: 'fermi', title: 'Fermi Unlimited', blurb: 'Estimate answers to “how many?” questions.', category: 'Numbers & science' },
  { slug: 'extraplot', title: 'Extraplot Unlimited', blurb: 'Draw where a real chart goes next, then reveal the data.', category: 'Numbers & science' },
  { slug: 'pricepoint', title: 'PricePoint', blurb: 'Guess the real price of everyday and unusual items.', category: 'Numbers & science' },
  { slug: 'scale-of-things', title: 'Scale of Things', blurb: 'Resize a mystery silhouette to its true size.', category: 'Numbers & science' },
  { slug: 'perceptle', title: 'Perceptle Unlimited', blurb: 'Five quick tests of perceptual instinct.', category: 'Numbers & science' },
  { slug: 'perceptle-extreme', title: 'Perceptle Extreme', blurb: 'Perceptle hard mode with moving dots and a bouncing ball.', category: 'Numbers & science' },
  { slug: 'elementle', title: 'Elementle Unlimited', blurb: 'Guess the mystery chemical element in eight tries.', category: 'Numbers & science' },
  { slug: 'dartle', title: 'Dartle Unlimited', blurb: 'Pick three trivia answers whose numbers add up to exactly 100.', category: 'Numbers & science' },
  { slug: 'peakle', title: 'Peakle Unlimited', blurb: 'Name trivia answers that keep climbing higher than the last.', category: 'Numbers & science' },
  { slug: 'costcodle', title: 'Costcodle Unlimited', blurb: 'Guess the price of warehouse-club products.', category: 'Numbers & science' },
  { slug: 'balance-it', title: 'Balance It Unlimited', blurb: 'Slide the stand under a cutout to find its balance point.', category: 'Numbers & science' },

  // Strategy
  { slug: 'chess', title: 'Chess', blurb: 'Play five bots rated 400 to 2000, or send a link and play a friend.', category: 'Strategy' },
  { slug: 'sortie', title: 'Sortie Unlimited', blurb: 'Name the best answer and fly your paper plane higher.', category: 'Strategy' },
  { slug: 'amountle', title: 'Amountle Unlimited', blurb: 'Watch objects pour into a jar and guess how many.', category: 'Strategy' },
  { slug: 'animellion', title: 'Animellion', blurb: 'Name the rarest anime character, show or studio you can.', category: 'Strategy' },
];

/** Provider page for one game. Shared links are explicitly allowed by its terms. */
export function everythingleUrl(slug: string): string {
  return `https://everythingle.com/games/${slug}/`;
}

export const LOCAL_GAME_TITLES: Record<LocalGameId, string> = {
  'five-letter': 'Five Letter',
  dordle: 'Double Board',
  quordle: 'Quad Board',
  word500: 'Word 500',
  'middle-word': 'Middle Word',
};

export function findGame(slug: string): EverythingleGame | undefined {
  return EVERYTHINGLE_GAMES.find((game) => game.slug === slug);
}

export function localGames(): EverythingleGame[] {
  return EVERYTHINGLE_GAMES.filter((game) => game.local);
}
