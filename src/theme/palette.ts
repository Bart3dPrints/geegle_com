// Site-wide theme tokens.
//
// A preset is a complete palette, not an accent colour: it derives a tinted
// neutral scale and a set of surfaces from one hue, then layers a coordinated
// accent on top. Existing components keep using Tailwind's `neutral-*` classes;
// tailwind.config maps that scale onto these CSS variables, so choosing a
// preset restyles every Geegle-owned surface without touching each file.
//
// Everything here is pure: no DOM access, no storage. `applyTheme` does the
// writing.

export type ThemeMode = 'light' | 'dark' | 'system';

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
  preset('lavender', 'Lavender', 275, 30, ['#8b5cf6', '#ddd6fe'], 'vivid'),
  preset('rose', 'Rose', 350, 26, ['#e11d48', '#fda4af'], 'warm'),
  preset('brown', 'Brown', 28, 18, ['#92400e', '#d6b28c'], 'warm'),
  preset('beige', 'Beige', 40, 20, ['#a16207', '#e7d3a8'], 'warm'),
  preset('gray', 'Gray', 0, 0, ['#525252', '#d4d4d4'], 'neutral'),
  preset('white', 'White', 210, 8, ['#1f2937', '#e5e7eb'], 'neutral'),
  preset('black', 'Black', 0, 0, ['#0a0a0a', '#fafafa'], 'neutral'),
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

/** White or near-black, whichever reads better on the given hex colour. */
export function readableInk(background: string): string {
  const value = background.trim();
  const rgb = value.startsWith('#')
    ? [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
    : null;
  if (!rgb || rgb.some((channel) => Number.isNaN(channel))) return '#ffffff';
  const linear = rgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.5 ? '#111111' : '#ffffff';
}

export interface ThemeOverrides {
  header?: string | null;
  background?: string | null;
  card?: string | null;
  accent?: string | null;
  text?: string | null;
  bubbleOut?: string | null;
}

export function resolveTheme(
  presetId: string,
  dark: boolean,
  overrides: ThemeOverrides = {},
): ThemeColors {
  const spec = themePreset(presetId);
  const neutral = neutralScale(spec.hue, spec.sat, dark);
  const accent = overrides.accent ?? spec.accent[dark ? 1 : 0];
  const bubbleOut = overrides.bubbleOut ?? spec.bubble?.[dark ? 1 : 0] ?? accent;
  const surfaces = dark
    ? {
        bg: hex(spec.hue, spec.sat, 9),
        header: hex(spec.hue, spec.sat, 12.5),
        card: hex(spec.hue, spec.sat, 15),
        elevated: hex(spec.hue, spec.sat, 19),
        border: hex(spec.hue, spec.sat, 26),
        text: hex(spec.hue, spec.sat, 96),
        muted: hex(spec.hue, spec.sat, 66),
        chat: hex(spec.hue, spec.sat, 11.5),
        bubbleIn: hex(spec.hue, spec.sat, 23),
      }
    : {
        bg: hex(spec.hue, spec.sat, 97.5),
        header: hex(spec.hue, spec.sat, 99.5),
        card: hex(spec.hue, spec.sat, 100),
        elevated: hex(spec.hue, spec.sat, 99),
        border: hex(spec.hue, spec.sat, 89),
        text: hex(spec.hue, spec.sat, 12),
        muted: hex(spec.hue, spec.sat, 44),
        chat: hex(spec.hue, spec.sat, 99),
        bubbleIn: hex(spec.hue, spec.sat, 93),
      };

  return {
    neutral,
    bg: overrides.background ?? surfaces.bg,
    header: overrides.header ?? surfaces.header,
    card: overrides.card ?? surfaces.card,
    elevated: surfaces.elevated,
    border: surfaces.border,
    text: overrides.text ?? surfaces.text,
    muted: surfaces.muted,
    accent,
    accentInk: readableInk(accent),
    hover: dark ? hex(spec.hue, spec.sat, 20) : hex(spec.hue, spec.sat, 94),
    selected: dark ? hex(spec.hue, Math.min(60, spec.sat + 10), 26) : hex(spec.hue, Math.min(70, spec.sat + 12), 90),
    chat: surfaces.chat,
    bubbleOut,
    bubbleOutInk: readableInk(bubbleOut),
    bubbleIn: surfaces.bubbleIn,
    bubbleInInk: overrides.text ?? surfaces.text,
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
