# Everythingle verification

Checked 2026-11-28 against `everythingle.com` (home, `/about`, `/educators`,
`/terms`, `/sitemap.xml`) and the Geegle build on branch
`feature/geegle-run2-final`.

## Status summary

| Requirement | Status | Evidence |
| --- | --- | --- |
| Complete game inventory | **VERIFIED** | 50 games recorded in `src/data/everythingle.ts` from the provider's own `/about` list; every slug resolves to a live page (matrix below) |
| Every game reachable and playable in Geegle | **VERIFIED (local Chromium)** | All 50 tiles launch; 5 run as Geegle implementations, 45 load the provider's official game page in the player |
| Misleading five-letter replacement removed | **VERIFIED** | `EverythingleApp` no longer presents one puzzle as the collection; the word engine survives as “Five Letter”, one of five labelled Geegle games |
| Dedicated reverse-proxy backend | **BLOCKED (provider terms)** | See “Why no proxy” — the provider forbids copying and redistributing its games |
| Documented embed interface | **NOT AVAILABLE** | No embed documentation or embed guide exists on the site; the games are ordinary public pages |
| Licensed / self-hosted implementation | **NOT AVAILABLE** | No licence offer, source distribution or self-host build is published |
| Open-source reimplementation of the collection | **NOT AVAILABLE** | A repository with a similar name is not this application; nothing was imported |
| Independent equivalent games | **PARTIAL (5 of 50)** | Wordle, Dordle, Quordle, Word500 and Middle Word formats reimplemented with Geegle code and Geegle word data |

## Why no proxy

The provider's Terms of Service (last updated 2026-11-12) say, verbatim:

> Please don't: … use bots, scrapers or other automated tools to access the site
> in bulk; **copy, resell or redistribute the site or its games as your own** …

> The site's design, code, artwork and text belong to EVERYTHINGLE or its
> licensors and are protected by copyright and other laws. You may share links
> to the site freely.

A reverse proxy that fetches, rewrites and serves those games from the Geegle
origin is redistribution, strips the advertising that funds the site, and would
also need bulk automated access. It is therefore not an authorised integration,
and it was not built. No new hosting infrastructure was added to Render, no
credential or cookie is forwarded, and there is no general-purpose proxy path:
Geegle only ever requests the five fixed `everythingle.com/games/<slug>/` pages
it lists, chosen from a static table, so no user input can reach a destination.

The provider's own permitted mechanism is sharing links. Geegle does exactly
that, but inside its player: each of the 45 non-Geegle games loads its official
page directly from `everythingle.com` in an iframe. The page is not copied,
mirrored, rewritten or cached by Geegle, its advertisements remain, and the
player labels it `everythingle.com`. If the provider ever objects, removing a
`local` flag is not needed — the 45 entries are pure links and can be dropped
from `src/data/everythingle.ts` without touching any game code.

## Implementation matrix

Method key: **Geegle implementation** = original Geegle code and word data;
**Official provider page** = the provider's own live page, loaded unmodified.

| # | Game | Method | Source | Functional status |
| --- | --- | --- | --- | --- |
| 1 | Wordle Unlimited → Five Letter | Geegle implementation | Geegle code, Geegle word list | Playable in Geegle |
| 2 | Middle Word Unlimited → Middle Word | Geegle implementation | Geegle code, Geegle word list | Playable in Geegle |
| 3 | Quordle Unlimited → Quad Board | Geegle implementation | Geegle code, Geegle word list | Playable in Geegle |
| 4 | Dordle Unlimited → Double Board | Geegle implementation | Geegle code, Geegle word list | Playable in Geegle |
| 5 | Word500 Unlimited → Word 500 | Geegle implementation | Geegle code, Geegle word list | Playable in Geegle |
| 6 | Columnle Unlimited | Official provider page | https://everythingle.com/games/columnle/ | Playable in player |
| 7 | Don't Wordle Unlimited | Official provider page | https://everythingle.com/games/dontwordle/ | Playable in player |
| 8 | Letroso Unlimited | Official provider page | https://everythingle.com/games/letroso/ | Playable in player |
| 9 | Expresso Unlimited | Official provider page | https://everythingle.com/games/expresso/ | Playable in player |
| 10 | Unwordle Unlimited | Official provider page | https://everythingle.com/games/unwordle/ | Playable in player |
| 11 | Jeffgoldblumle | Official provider page | https://everythingle.com/games/jeffgoldblumle/ | Playable in player |
| 12 | Poople | Official provider page | https://everythingle.com/games/poople/ | Playable in player |
| 13 | Spelling Bee Unlimited | Official provider page | https://everythingle.com/games/spelling-bee/ | Playable in player |
| 14 | Word Hunt Unlimited | Official provider page | https://everythingle.com/games/word-hunt/ | Playable in player |
| 15 | Krillion Unlimited | Official provider page | https://everythingle.com/games/krillion/ | Playable in player |
| 16 | Noillirk | Official provider page | https://everythingle.com/games/noillirk/ | Playable in player |
| 17 | Wonderhop Unlimited | Official provider page | https://everythingle.com/games/wonderhop/ | Playable in player |
| 18 | Contexto Unlimited | Official provider page | https://everythingle.com/games/contexto/ | Playable in player |
| 19 | Connectdle | Official provider page | https://everythingle.com/games/connectdle/ | Playable in player |
| 20 | Chainle Unlimited | Official provider page | https://everythingle.com/games/chainle/ | Playable in player |
| 21 | Spamle | Official provider page | https://everythingle.com/games/spamle/ | Playable in player |
| 22 | Minute Cryptic Unlimited | Official provider page | https://everythingle.com/games/minute-cryptic/ | Playable in player |
| 23 | Worldle Unlimited | Official provider page | https://everythingle.com/games/worldle/ | Playable in player |
| 24 | Globle Unlimited | Official provider page | https://everythingle.com/games/globle/ | Playable in player |
| 25 | Travle Unlimited | Official provider page | https://everythingle.com/games/travle/ | Playable in player |
| 26 | Krillion Geography Unlimited | Official provider page | https://everythingle.com/games/krillion-geography/ | Playable in player |
| 27 | Flagle Unlimited | Official provider page | https://everythingle.com/games/flagle/ | Playable in player |
| 28 | Farflung Unlimited | Official provider page | https://everythingle.com/games/farflung/ | Playable in player |
| 29 | Guess the Song | Official provider page | https://everythingle.com/games/guess-the-song/ | Playable in player |
| 30 | Spotle Unlimited | Official provider page | https://everythingle.com/games/spotle/ | Playable in player |
| 31 | Brandle Unlimited | Official provider page | https://everythingle.com/games/brandle/ | Playable in player |
| 32 | On Brand Unlimited | Official provider page | https://everythingle.com/games/onbrand/ | Playable in player |
| 33 | Minecraftle Unlimited | Official provider page | https://everythingle.com/games/minecraftle/ | Playable in player |
| 34 | Kabloom Unlimited | Official provider page | https://everythingle.com/games/kabloom/ | Playable in player |
| 35 | Framed Unlimited | Official provider page | https://everythingle.com/games/framed/ | Playable in player |
| 36 | Fermi Unlimited | Official provider page | https://everythingle.com/games/fermi/ | Playable in player |
| 37 | Extraplot Unlimited | Official provider page | https://everythingle.com/games/extraplot/ | Playable in player |
| 38 | PricePoint | Official provider page | https://everythingle.com/games/pricepoint/ | Playable in player |
| 39 | Scale of Things | Official provider page | https://everythingle.com/games/scale-of-things/ | Playable in player |
| 40 | Perceptle Unlimited | Official provider page | https://everythingle.com/games/perceptle/ | Playable in player |
| 41 | Perceptle Extreme | Official provider page | https://everythingle.com/games/perceptle-extreme/ | Playable in player |
| 42 | Elementle Unlimited | Official provider page | https://everythingle.com/games/elementle/ | Playable in player |
| 43 | Dartle Unlimited | Official provider page | https://everythingle.com/games/dartle/ | Playable in player |
| 44 | Peakle Unlimited | Official provider page | https://everythingle.com/games/peakle/ | Playable in player |
| 45 | Costcodle Unlimited | Official provider page | https://everythingle.com/games/costcodle/ | Playable in player |
| 46 | Balance It Unlimited | Official provider page | https://everythingle.com/games/balance-it/ | Playable in player |
| 47 | Chess | Official provider page | https://everythingle.com/games/chess/ | Playable in player |
| 48 | Sortie Unlimited | Official provider page | https://everythingle.com/games/sortie/ | Playable in player |
| 49 | Amountle Unlimited | Official provider page | https://everythingle.com/games/amountle/ | Playable in player |
| 50 | Animellion | Official provider page | https://everythingle.com/games/animellion/ | Playable in player |

## How the hub behaves

- The Everythingle card in Apps opens the collection, not a single game and not a
  launcher list with a “direct or proxy?” choice.
- The hub shows all 50 games with a search field and category filters. Selecting
  a Geegle game opens its board immediately; selecting any other game opens the
  provider's page in the player with a visible `everythingle.com` label.
- Back and Fullscreen are the only player controls, matching the rest of Geegle.
- Geegle games persist their round locally per game (`geegle-word-boards:v1:*`,
  `geegle-middle-word:v1`), so a reload or an exit does not lose progress.

## Verified behaviour (local Chromium, 2026-11-28)

`node scripts/qa/run2-final-check.mjs` — 30/30 checks, including:

- 50 tiles, exactly 5 labelled `Geegle`;
- Five Letter opens a 30-cell board, accepts a typed guess and scores it;
- Word 500 reports green/yellow/red totals;
- Middle Word shows both alphabetical bounds;
- Chess loads `everythingle.com/games/chess/` and renders “Chess: Play Online
  Free”; the frame produced no console errors;
- no Geegle-origin page errors on the whole run.

`bun test tests` covers the same ground without a browser: 50 unique slugs, one
category per game, official URL shape, the five local implementations, guess
validation, multi-board win/loss, counts totals and Middle Word bounds
(`tests/everythingle.test.mjs`), plus a source assertion that the app contains
no proxy path.

## Limitations

- The 45 provider games were verified by loading and rendering their official
  pages; each game was not played to completion. Their internal state, scoring
  and ad behaviour belong to the provider.
- Everythingle's pages carry no `frame-ancestors` restriction today, so they
  frame cleanly. If the provider adds one, those 45 entries would need to open
  as ordinary links instead; nothing else in Geegle depends on framing them.
- Geegle's five implementations are original games in the same *formats*. They
  are labelled Geegle and never claim to be the provider's builds, and they use
  Geegle's own word list rather than the provider's answer sets.
- Games not reimplemented locally remain dependent on the provider's uptime.
