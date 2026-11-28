// Writes a resolved theme onto the document as CSS variables.
//
// One pass per change: the neutral scale (which tailwind.config maps onto
// `neutral-*`), the semantic surfaces, the chat palette and the ambient wash.
// Nothing here touches individual components, so a theme change is a single
// style write rather than a re-render of the whole tree.

import { NEUTRAL_STOPS, resolveTheme, type ThemeColors, type ThemeOverrides } from './palette';

export function themeVariables(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const stop of NEUTRAL_STOPS) vars[`--geegle-n-${stop}`] = colors.neutral[stop];
  const map: Record<string, string> = {
    bg: colors.bg,
    header: colors.header,
    card: colors.card,
    elevated: colors.elevated,
    border: colors.border,
    text: colors.text,
    muted: colors.muted,
    accent: colors.accent,
    'accent-ink': colors.accentInk,
    // Kept as an alias for code written before the theme rewrite.
    'accent-contrast': colors.accentInk,
    field: colors.field,
    'field-text': colors.fieldText,
    hover: colors.hover,
    selected: colors.selected,
    chat: colors.chat,
    'bubble-out': colors.bubbleOut,
    'bubble-out-ink': colors.bubbleOutInk,
    'bubble-in': colors.bubbleIn,
    'bubble-in-ink': colors.bubbleInInk,
    scrim: colors.scrim,
    'ambient-1': colors.ambient[0],
    'ambient-2': colors.ambient[1],
    'ambient-3': colors.ambient[2],
    // Kept as an alias for the search bar and other text entry written before
    // the field tokens landed.
    'search-bg': colors.field,
  };
  for (const [name, value] of Object.entries(map)) vars[`--geegle-${name}`] = value;
  return vars;
}

/** Applies a theme to an element (the document root by default). */
export function applyTheme(
  presetId: string,
  dark: boolean,
  overrides: ThemeOverrides = {},
  target?: HTMLElement | null,
): ThemeColors {
  const element = target ?? (typeof document === 'undefined' ? null : document.documentElement);
  const colors = resolveTheme(presetId, dark, overrides);
  if (!element) return colors;
  const vars = themeVariables(colors);
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
  element.dataset.geegleTheme = presetId;
  return colors;
}

/** The palette a preset would use, for previews in Settings. */
export function previewTheme(presetId: string, dark: boolean): ThemeColors {
  return resolveTheme(presetId, dark);
}
