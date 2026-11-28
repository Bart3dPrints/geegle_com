// Ambient lighting.
//
// Broad, softly blended colour regions behind the interface, derived from the
// active theme or from the open conversation's background. The layer is
// static (no animation loop), sits behind all content, ignores pointers and
// fades between palettes in roughly a third of a second.

import { useEffect, useState } from 'react';
import { paletteFromColor, paletteFromImage, type AmbientPalette } from './imagePalette';

export function AmbientLayer({
  palette,
  opacity = 0.75,
  fixed = true,
}: {
  palette: AmbientPalette;
  opacity?: number;
  fixed?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      data-ambient="on"
      className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 -z-10 overflow-hidden`}
      style={{
        opacity,
        transition: 'opacity 320ms ease, background-color 320ms ease',
        backgroundImage: [
          `radial-gradient(60% 55% at 12% 8%, ${palette[0]} 0%, transparent 68%)`,
          `radial-gradient(55% 50% at 88% 12%, ${palette[1]} 0%, transparent 70%)`,
          `radial-gradient(75% 70% at 50% 105%, ${palette[2]} 0%, transparent 72%)`,
        ].join(','),
        filter: 'saturate(1.05)',
      }}
    />
  );
}

/**
 * The ambient wash for the open conversation: a solid background contributes
 * its own colour, an uploaded picture contributes its dominant colours.
 * Palettes are cached, so switching back and forth costs nothing.
 */
export function useConversationAmbient({
  kind,
  color,
  imageUrl,
  themeAmbient,
}: {
  kind: 'default' | 'solid' | 'color' | 'image';
  color: string | null;
  imageUrl: string | null;
  themeAmbient: AmbientPalette;
}): AmbientPalette {
  const [state, setState] = useState<AmbientPalette>(themeAmbient);

  useEffect(() => {
    let cancelled = false;
    if (kind === 'image' && imageUrl) {
      void paletteFromImage(imageUrl).then((palette) => {
        if (!cancelled) setState(palette);
      });
    } else if ((kind === 'solid' || kind === 'color') && color) {
      setState(paletteFromColor(color));
    } else {
      setState(themeAmbient);
    }
    return () => {
      cancelled = true;
    };
    // The theme wash is compared by value so a re-render with the same colours
    // does not restart the extraction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, color, imageUrl, themeAmbient.join('|')]);

  return state;
}

/** Soft illumination around the conversation panel, from its own palette. */
export function ChatAmbient({
  palette,
  enabled,
}: {
  palette: AmbientPalette;
  enabled: boolean;
}) {
  if (!enabled) return null;
  return (
    <div
      aria-hidden="true"
      data-chat-ambient="on"
      className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px]"
      style={{
        backgroundImage: [
          `radial-gradient(45% 55% at 8% 0%, ${palette[0]} 0%, transparent 70%)`,
          `radial-gradient(45% 55% at 92% 4%, ${palette[1]} 0%, transparent 72%)`,
          `radial-gradient(60% 60% at 50% 100%, ${palette[2]} 0%, transparent 74%)`,
        ].join(','),
        opacity: 0.55,
        filter: 'blur(6px)',
        transition: 'background-image 340ms ease, opacity 340ms ease',
      }}
    />
  );
}

/** The ambient wash currently active for the site theme. */
export function readThemeAmbient(): AmbientPalette {
  if (typeof document === 'undefined') return ['transparent', 'transparent', 'transparent'];
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim() || 'transparent';
  return [read('--geegle-ambient-1'), read('--geegle-ambient-2'), read('--geegle-ambient-3')];
}
