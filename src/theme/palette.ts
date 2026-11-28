// Site-wide theme tokens.
//
// A preset is a complete palette, not an accent colour: it derives a tinted
// neutral scale and a set of surfaces from one hue, then layers a coordinated
// accent on top. Existing components keep using Tailwind's `neutral-*` classes;
// tailwind.config maps that scale onto these CSS variables, so choosing a
// preset restyles every Geegle-owned surface without touching each file.
//
// The neutral scale is mirrored in dark mode, so a base utility such as
// `text-neutral-700` is readable in both modes. That is why components must not
// carry `dark:` colour overrides: they would invert an already-adapted value.
//
// Everything here is pure: no DOM access, no storage. `applyTheme` does the
// writing.

export type ThemeMode = 'light' | 'dark' | 'system';

/** Lightness percentages that make one preset's surfaces recognisable. */
export interface SurfaceTone {
  bg: number;
  header: number;
  card: number;
  elevated: number;
  border: number;
  chat: number;
  bubbleIn: number;
}

export interface ThemePreset {
  id: string;
  name: string;
  /** Hue of the neutral family, 0-360. */
  hue: number;
  /** Saturation percentage of the neutral family (0 = pure gray). */
  sat: number;
  /** Accent in light mode and in dark mode. */
  accent: [string, string];
  /** Optional outgoing-bubble default; accent is used when absent. */
  bubble?: [string, string];
  /** Surface lightness where the default derived surfaces would be too close. */
  surfaces?: { light?: Partial<SurfaceTone>; dark?: Partial<SurfaceTone> };
  swatch: string;
  family: 'neutral' | 'cool' | 'warm' | 'nature' | 'vivid';
}

const preset = (
  id: string,
  name: string,
  hue: number,
  sat: number,
  accent: [string, string],
  family: ThemePreset['family'],
  bubble?: [string, string],
): ThemePreset => ({ id, name, hue, sat, accent, bubble, family, swatch: accent[0] });

/** Ordered light → dark; the ordering is used for the generated scale. */
export const NEUTRAL_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type NeutralStop = (typeof NEUTRAL_STOPS)[number];

export const THEME_PRESETS: ThemePreset[] = [
  preset('neutral', 'Neutral', 0, 0, ['#171717', '#f5f5f5'], 'neutral'),
  preset('blue', 'Blue', 217, 24, ['#2563eb', '#93c5fd'], 'cool'),
  preset('sky', 'Light blue', 200, 26, ['#0284c7', '#7dd3fc'], 'cool'),
  preset('red', 'Red', 0, 22, ['#dc2626', '#fca5a5'], 'warm'),
  preset('green', 'Green', 145, 20, ['#16a34a', '#86efac'], 'nature'),
  preset('yellow', 'Yellow', 45, 26, ['#ca8a04', '#fde047'], 'warm'),
  preset('orange', 'Orange', 24, 28, ['#ea580c', '#fdba74'], 'warm'),
  preset('purple', 'Purple', 268, 24, ['#7c3aed', '#c4b5fd'], 'vivid'),
  preset('pink', 'Pink', 330, 24, ['#db2777', '#f9a8d4'], 'vivid'),
  preset('cyan', 'Cyan', 188, 24, ['#0891b2', '#67e8f9'], 'cool'),
  preset('teal', 'Teal', 172, 22, ['#0d9488', '#5eead4'], 'nature'),
  preset('indigo', 'Indigo', 245, 26, ['#4f46e5', '#a5b4fc'], 'cool'),
  preset('navy', 'Navy', 222, 40, ['#1e3a8a', '#93c5fd'], 'cool'),
  preset('lime', 'Lime', 90, 24, ['#65a30d', '#bef264'], 'nature'),
  preset('mint', 'Mint', 158, 22, ['#10b981', '#6ee7b7'], 'nature'),
  preset('lavender', 'Lavender', 275, 30, ['#7c3aed', '#ddd6fe'], 'vivid'),
  preset('rose', 'Rose', 350, 26, ['#e11d48', '#fda4af'], 'warm'),
  preset('brown', 'Brown', 28, 18, ['#92400e', '#d6b28c'], 'warm'),
  preset('beige', 'Beige', 40, 20, ['#a16207', '#e7d3a8'], 'warm'),
  // Three genuinely different neutral themes: a mid-gray palette, a bright
  // white one and a near-black one, rather than the same ramp with a different
  // accent colour.
  {
    ...preset('gray', 'Gray', 0, 0, ['#525252', '#d4d4d4'], 'neutral'),
    surfaces: {
      light: { bg: 93, header: 96, card: 99, elevated: 97, border: 85, chat: 98, bubbleIn: 89 },
      dark: { bg: 12, header: 15, card: 18, elevated: 23, border: 30, chat: 14, bubbleIn: 26 },
    },
  },
  {
    ...preset('white', 'White', 210, 4, ['#1f2937', '#e5e7eb'], 'neutral'),
    surfaces: {
      light: { bg: 98.5, header: 100, card: 100, elevated: 99.5, border: 91, chat: 99, bubbleIn: 95 },
      dark: { bg: 7, header: 9, card: 11.5, elevated: 15, border: 23, chat: 8.5, bubbleIn: 18 },
    },
  },
  {
    ...preset('black', 'Black', 0, 0, ['#0a0a0a', '#fafafa'], 'neutral'),
    surfaces: {
      light: { bg: 99, header: 100, card: 100, elevated: 98.5, border: 90, chat: 100, bubbleIn: 95 },
      dark: { bg: 2, header: 3.5, card: 5.5, elevated: 9, border: 17, chat: 3, bubbleIn: 11 },
    },
  },
];

export const DEFAULT_THEME_ID = 'blue';

export function themePreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((entry) => entry.id === id) ?? THEME_PRESETS[1];
}

/** CSS variables that make up one resolved theme. */
export interface ThemeColors {
  neutral: Record<NeutralStop, string>;
  bg: string;
  header: string;
  card: string;
  elevated: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string;
  hover: string;
  selected: string;
  chat: string;
  /** Text-entry surface and its ink, including the search field. */
  field: string;
  fieldText: string;
  bubbleOut: string;
  bubbleOutInk: string;
  bubbleIn: string;
  bubbleInInk: string;
  scrim: string;
  ambient: [string, string, string];
}

const hsl = (h: number, s: number, l: number) => `${h} ${s}% ${l}%`;
const hex = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

function neutralScale(hue: number, sat: number, dark: boolean): Record<NeutralStop, string> {
  // A tinted ramp: the same family from 50 to 950. Dark mode mirrors the ramp
  // so `dark:` variants keep working without a second set of classes.
  const light: Record<NeutralStop, number> = {
    50: 98.5, 100: 96.5, 200: 92, 300: 87, 400: 66, 500: 48, 600: 38, 700: 29, 800: 21, 900: 14, 950: 8,
  };
  const darkMap: Record<NeutralStop, number> = {
    50: 9, 100: 12, 200: 17, 300: 24, 400: 45, 500: 56, 600: 67, 700: 77, 800: 86, 900: 92, 950: 97,
  };
  const map = dark ? darkMap : light;
  const out = {} as Record<NeutralStop, string>;
  for (const stop of NEUTRAL_STOPS) {
    // Saturation tapers at the extremes so pure white and black stay clean.
    const edge = stop <= 50 || stop >= 900 ? 0.45 : 1;
    out[stop] = hsl(hue, Math.round(sat * edge), map[stop]);
  }
  return out;
}

type Channels = [number, number, number];

/** Parses the `#rrggbb` and `hsl(h s% l%)` forms this module produces. */
export function parseColor(value: string): Channels | null {
  const text = value.trim();
  if (text.startsWith('#')) {
    const raw = text.slice(1);
    const full = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
    if (!/^[\da-f]{6}$/i.test(full)) return null;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Channels;
  }
  const match = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i.exec(text);
  if (!match) return null;
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const table: Channels[] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  const [r, g, b] = table[Math.floor(h / 60) % 6];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function luminanceOf([r, g, b]: Channels): number {
  const linear = [r, g, b].map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio between two CSS colours. */
export function contrast(a: string, b: string): number {
  const one = parseColor(a);
  const two = parseColor(b);
  if (!one || !two) return 1;
  const [hi, lo] = [luminanceOf(one), luminanceOf(two)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl([r, g, b]: Channels): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function shift(hex: string, amount: number): string {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return (
    '#' +
    channels
      .map((channel) => Math.max(0, Math.min(255, Math.round(channel * (1 + amount)))))
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * A bubble colour plus an ink that reaches 4.5:1. A chosen colour is nudged a
 * few percent darker or lighter only when neither ink is readable as-is.
 */
export function bubbleInk(background: string, target = 4.5): { background: string; ink: string } {
  if (!/^#[\da-f]{6}$/i.test(background)) return { background, ink: '#ffffff' };
  let colour = background;
  let ink = readableInk(colour);
  for (let step = 0; step < 24 && contrast(ink, colour) < target; step += 1) {
    colour = shift(colour, ink === '#111111' ? -0.05 : 0.07);
    ink = readableInk(colour);
  }
  return { background: colour, ink };
}

/** White or near-black, whichever reads better on the given colour. */
export function readableInk(background: string): string {
  const channels = parseColor(background);
  if (!channels) return '#ffffff';
  const luminance = luminanceOf(channels);
  const onWhite = 1.05 / (luminance + 0.05);
  const onBlack = (luminance + 0.05) / 0.05;
  // Pick whichever ink actually has more contrast, rather than assuming a
  // lightness threshold: mid greens and reds read better dark than white.
  return onWhite >= onBlack ? '#ffffff' : '#111111';
}

/** The more readable of the two candidate inks across every given surface. */
function bestText(base: string, surfaces: string[]): string {
  const score = (colour: string) => Math.min(...surfaces.map((surface) => contrast(colour, surface)));
  if (score(base) >= 4.5) return base;
  const dark = '#111111';
  const light = '#f7f7f7';
  return score(dark) >= score(light) ? dark : light;
}

/**
 * Keeps an explicit text colour readable on the surface it sits on by nudging
 * its lightness, so a chosen colour is preserved as far as possible.
 */
export function readableOn(colour: string, surface: string, target = 4.5): string {
  const channels = parseColor(colour);
  const surfaceChannels = parseColor(surface);
  if (!channels || !surfaceChannels) return colour;
  if (contrast(colour, surface) >= target) return colour;
  const [h, s, start] = toHsl(channels);
  const lighten = luminanceOf(surfaceChannels) < 0.4;
  for (let step = 1; step <= 25; step += 1) {
    const l = Math.max(0, Math.min(100, start + (lighten ? step : -step) * 4));
    const candidate = `hsl(${Math.round(h)} ${Math.round(s)}% ${l}%)`;
    if (contrast(candidate, surface) >= target) return candidate;
  }
  return readableInk(surface);
}

export interface ThemeOverrides {
  header?: string | null;
  background?: string | null;
  card?: string | null;
  accent?: string | null;
  text?: string | null;
  muted?: string | null;
  chat?: string | null;
  field?: string | null;
  fieldText?: string | null;
  bubbleOut?: string | null;
  bubbleIn?: string | null;
}

const BASE_TONE: SurfaceTone = {
  bg: 97.5, header: 99.5, card: 100, elevated: 99, border: 89, chat: 99, bubbleIn: 93,
};
const BASE_TONE_DARK: SurfaceTone = {
  bg: 9, header: 12.5, card: 15, elevated: 19, border: 26, chat: 11.5, bubbleIn: 23,
};

export function resolveTheme(
  presetId: string,
  dark: boolean,
  overrides: ThemeOverrides = {},
): ThemeColors {
  const spec = themePreset(presetId);
  const neutral = neutralScale(spec.hue, spec.sat, dark);
  const accent = overrides.accent ?? spec.accent[dark ? 1 : 0];
  const bubbleOut = overrides.bubbleOut ?? spec.bubble?.[dark ? 1 : 0] ?? accent;

  const tone = { ...(dark ? BASE_TONE_DARK : BASE_TONE), ...(spec.surfaces?.[dark ? 'dark' : 'light'] ?? {}) };
  const at = (lightness: number) => hex(spec.hue, spec.sat, lightness);
  const bg = overrides.background ?? at(tone.bg);
  const header = overrides.header ?? at(tone.header);
  const card = overrides.card ?? at(tone.card);
  const elevated = at(tone.elevated);
  const chat = overrides.chat ?? at(tone.chat);
  const field = overrides.field ?? at(dark ? Math.max(tone.card - 1, 3) : Math.min(tone.card - 1, 100));

  // Text adapts to the surfaces that actually exist after overrides, so a dark
  // card in a light theme still carries readable ink.
  const text = bestText(overrides.text ?? (dark ? at(96) : at(12)), [bg, card, header, chat]);
  const muted = readableOn(overrides.muted ?? (dark ? at(66) : at(44)), bg);
  const fieldText = readableOn(overrides.fieldText ?? text, field);
  const bubbleIn = overrides.bubbleIn ?? at(tone.bubbleIn);
  const bubbleInInk = bestText(overrides.text ?? text, [bubbleIn]);
  const outgoing = bubbleInk(bubbleOut);

  return {
    neutral,
    bg,
    header,
    card,
    elevated,
    border: at(tone.border),
    text,
    muted,
    accent,
    accentInk: readableInk(accent),
    hover: dark ? hex(spec.hue, spec.sat, 20) : hex(spec.hue, spec.sat, 94),
    selected: dark ? hex(spec.hue, Math.min(60, spec.sat + 10), 26) : hex(spec.hue, Math.min(70, spec.sat + 12), 90),
    chat,
    field,
    fieldText,
    bubbleOut: outgoing.background,
    bubbleOutInk: outgoing.ink,
    bubbleIn,
    bubbleInInk,
    scrim: dark ? `rgba(10, 10, 10, 0.82)` : `rgba(250, 250, 250, 0.84)`,
    ambient: ambientFromAccent(accent, dark),
  };
}

/** Three soft, related colours for the ambient lighting layer. */
export function ambientFromAccent(accent: string, dark: boolean): [string, string, string] {
  const match = /^#([\da-f]{6})$/i.exec(accent.trim());
  if (!match) return dark ? ['#1e293b', '#0f172a', '#111827'] : ['#e0e7ff', '#f1f5f9', '#e2e8f0'];
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16));
  // Shift the accent toward its neighbours for a varied but coordinated wash.
  const mix = (channel: number, toward: number, amount: number) =>
    Math.round(channel + (toward - channel) * amount);
  const primary = `rgb(${r}, ${g}, ${b})`;
  const secondary = `rgb(${mix(r, 255, 0.35)}, ${mix(g, 200, 0.25)}, ${mix(b, 255, 0.4)})`;
  const tertiary = `rgb(${mix(r, 255, 0.55)}, ${mix(g, 235, 0.5)}, ${mix(b, 235, 0.55)})`;
  return dark ? [primary, secondary, tertiary] : [secondary, tertiary, `rgb(${mix(r, 255, 0.6)}, ${mix(g, 255, 0.55)}, ${mix(b, 255, 0.6)})`];
}
