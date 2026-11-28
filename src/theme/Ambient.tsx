// Ambient lighting.
//
// A soft field of colour behind the interface, derived from the active theme or
// from the open conversation's background. It covers the whole surface with
// overlapping blobs and a matching base tint, then blurs the result, so there is
// no boundary where the light stops and no hard edge between colour regions.
// The layer is static (no animation loop) and ignores pointers.
//
// Changing palette cross-fades the previous field out over roughly a third of a
// second: gradients themselves cannot be interpolated, but opacity can.

import { useEffect, useRef, useState } from 'react';
import { paletteFromColor, paletteFromImage, type AmbientPalette } from './imagePalette';

/** Overlapping blobs spread across the surface, all with long falloffs. */
function fieldImage(palette: AmbientPalette): string {
  return [
    `radial-gradient(85% 75% at 12% 4%, ${palette[0]} 0%, transparent 100%)`,
    `radial-gradient(75% 70% at 88% 0%, ${palette[1]} 0%, transparent 100%)`,
    `radial-gradient(95% 85% at 50% 108%, ${palette[2]} 0%, transparent 100%)`,
    `radial-gradient(80% 70% at 0% 88%, ${palette[1]} 0%, transparent 100%)`,
    `radial-gradient(80% 70% at 100% 82%, ${palette[0]} 0%, transparent 100%)`,
    `radial-gradient(60% 55% at 50% 45%, ${palette[2]} 0%, transparent 100%)`,
  ].join(',');
}

function AmbientField({ palette, strength }: { palette: AmbientPalette; strength: number }) {
  return (
    <div
      className="absolute -inset-[12%]"
      style={{
        opacity: strength,
        transition: 'opacity 340ms ease',
        backgroundImage: fieldImage(palette),
        // The base tint guarantees the far corners still carry the palette, so
        // the wash never returns to a visibly different plain background.
        backgroundColor: `color-mix(in srgb, var(--geegle-bg) 86%, ${palette[0]})`,
        filter: 'blur(48px)',
      }}
    />
  );
}

export function AmbientLayer({
  palette,
  opacity = 0.5,
  fixed = true,
}: {
  palette: AmbientPalette;
  opacity?: number;
  fixed?: boolean;
}) {
  const signature = palette.join('|');
  const shownSignature = useRef(signature);
  const [shown, setShown] = useState(palette);
  const [leaving, setLeaving] = useState<AmbientPalette | null>(null);
  const [leavingFaded, setLeavingFaded] = useState(false);

  useEffect(() => {
    if (shownSignature.current === signature) return;
    const previous = shown;
    shownSignature.current = signature;
    setLeaving(previous);
    setLeavingFaded(false);
    setShown(palette);
    // Paint the outgoing field at full strength once, then fade it out.
    const frame = requestAnimationFrame(() => setLeavingFaded(true));
    const clear = setTimeout(() => setLeaving(null), 400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(clear);
    };
    // `shown` is intentionally excluded: it is the value being replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div
      aria-hidden="true"
      data-ambient="on"
      className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 -z-10 overflow-hidden`}
    >
      {leaving && <AmbientField palette={leaving} strength={leavingFaded ? 0 : opacity} />}
      <AmbientField palette={shown} strength={opacity} />
    </div>
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
  const signature = palette.join('|');
  const shownSignature = useRef(signature);
  const [shown, setShown] = useState(palette);
  const [leaving, setLeaving] = useState<AmbientPalette | null>(null);
  const [leavingFaded, setLeavingFaded] = useState(false);

  useEffect(() => {
    if (shownSignature.current === signature) return;
    const previous = shown;
    shownSignature.current = signature;
    setLeaving(previous);
    setLeavingFaded(false);
    setShown(palette);
    const frame = requestAnimationFrame(() => setLeavingFaded(true));
    const clear = setTimeout(() => setLeaving(null), 400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!enabled) return null;

  const field = (value: AmbientPalette, strength: number) => (
    <div
      className="absolute -inset-6 rounded-[28px]"
      style={{
        backgroundImage: [
          `radial-gradient(70% 85% at 6% 0%, ${value[0]} 0%, transparent 100%)`,
          `radial-gradient(70% 85% at 94% 2%, ${value[1]} 0%, transparent 100%)`,
          `radial-gradient(90% 90% at 50% 104%, ${value[2]} 0%, transparent 100%)`,
          `radial-gradient(70% 80% at 50% 50%, ${value[2]} 0%, transparent 100%)`,
        ].join(','),
        opacity: strength,
        filter: 'blur(22px)',
        transition: 'opacity 340ms ease',
      }}
    />
  );

  return (
    <div aria-hidden="true" data-chat-ambient="on" className="pointer-events-none absolute -inset-6 -z-10 overflow-hidden rounded-[28px]">
      {leaving && field(leaving, leavingFaded ? 0 : 0.4)}
      {field(shown, 0.4)}
    </div>
  );
}

/** The ambient wash currently active for the site theme. */
export function readThemeAmbient(): AmbientPalette {
  if (typeof document === 'undefined') return ['transparent', 'transparent', 'transparent'];
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim() || 'transparent';
  return [read('--geegle-ambient-1'), read('--geegle-ambient-2'), read('--geegle-ambient-3')];
}
