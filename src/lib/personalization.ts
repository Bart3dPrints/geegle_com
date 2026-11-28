// Personal appearance preferences: accent colour, typeface, text colour,
// wallpaper and the optional clock/date widgets.
//
// Nothing here is required for Geegle to work. The defaults reproduce the
// neutral grayscale appearance exactly, and every value is parsed before use so
// a corrupted local record or another account's data can never leak in.

import {
  DEFAULT_TIME_SETTINGS,
  parseTimeSettings,
  type TimeSettings,
} from './timeSettings';

export type FontKey = 'default' | 'poppins' | 'serif' | 'mono';

export interface Personalization {
  /** Solid accent colour, or null for the neutral default. */
  accent: string | null;
  font: FontKey;
  /** Authored text colour, or null to inherit the neutral default. */
  fontColor: string | null;
  /** Compressed data URL of an uploaded wallpaper, or null. */
  wallpaper: string | null;
  clock: boolean;
  date: boolean;
  /** 12-hour (true) or 24-hour (false) clock. */
  hour12: boolean;
  /** IANA zone, or "auto" for the browser's configured zone. */
  timeZone: string;
}

export const DEFAULT_PERSONALIZATION: Personalization = {
  accent: null,
  font: 'default',
  fontColor: null,
  wallpaper: null,
  clock: false,
  date: false,
  ...DEFAULT_TIME_SETTINGS,
};

/** Readable presets; the first one is the untouched neutral appearance. */
export const ACCENT_PRESETS: { name: string; value: string | null }[] = [
  { name: 'Neutral', value: null },
  { name: 'Amber', value: '#b45309' },
  { name: 'Green', value: '#15803d' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Blue', value: '#1d4ed8' },
];

export const FONT_OPTIONS: { key: FontKey; label: string; stack: string }[] = [
  {
    key: 'default',
    label: 'Default',
    stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  {
    key: 'poppins',
    label: 'Poppins',
    // Self-hosted with the wordmark; no network request is added.
    stack: "'Geegle Wordmark', ui-sans-serif, system-ui, sans-serif",
  },
  {
    key: 'serif',
    label: 'Serif',
    stack: "Georgia, 'Times New Roman', serif",
  },
  {
    key: 'mono',
    label: 'Monospace',
    stack: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const WALLPAPER_DATA = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export const WALLPAPER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
export const WALLPAPER_STORED_MAX_BYTES = 600 * 1024;
const WALLPAPER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** White or near-black text, whichever stays readable on the accent. */
export function contrastText(hex: string): '#ffffff' | '#111111' {
  if (!isHexColor(hex)) return '#ffffff';
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? '#111111' : '#ffffff';
}

export function fontStack(key: FontKey): string {
  return FONT_OPTIONS.find((option) => option.key === key)?.stack ?? FONT_OPTIONS[0].stack;
}

/** A data URL is only accepted when it is an allowed raster image. */
export function isWallpaperDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= WALLPAPER_STORED_MAX_BYTES * 1.4 && WALLPAPER_DATA.test(value);
}

/** Rejects unsupported files before any decoding work begins. */
export function wallpaperFileProblem(file: { type: string; size: number } | null): string | null {
  if (!file) return 'Choose an image first.';
  if (!WALLPAPER_TYPES.includes(file.type)) return 'Choose a PNG, JPEG or WebP image.';
  if (file.size <= 0) return 'That image is empty.';
  if (file.size > WALLPAPER_INPUT_MAX_BYTES) return 'Keep the image under 8 MB.';
  return null;
}

export function parsePersonalization(value: unknown): Personalization {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const font = FONT_OPTIONS.some((option) => option.key === record.font)
    ? (record.font as FontKey)
    : DEFAULT_PERSONALIZATION.font;
  const time = parseTimeSettings(record);
  return {
    accent: isHexColor(record.accent) ? record.accent : null,
    font,
    fontColor: isHexColor(record.fontColor) ? record.fontColor : null,
    wallpaper: isWallpaperDataUrl(record.wallpaper) ? record.wallpaper : null,
    clock: record.clock === true,
    date: record.date === true,
    ...time,
  };
}

/** The clock/date part of a personalization record, for the widgets. */
export function timeSettingsOf(value: Pick<Personalization, keyof TimeSettings>): TimeSettings {
  return { hour12: value.hour12 !== false, timeZone: value.timeZone };
}
