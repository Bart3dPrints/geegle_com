// Representative colours for ambient lighting.
//
// A solid colour is converted directly. An uploaded picture is sampled once,
// downscaled to a tiny canvas, and its dominant colours are cached by URL, so
// re-rendering the chat never re-reads the image. Nothing is sampled on a
// timer and nothing runs while the interface is stationary.

export type AmbientPalette = [string, string, string];

const cache = new Map<string, AmbientPalette>();

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([\da-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  return [0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16)) as [number, number, number];
}

const rgb = (channels: [number, number, number]) => `rgb(${channels.map(clamp).join(', ')})`;

const towards = (
  channels: [number, number, number],
  target: [number, number, number],
  amount: number,
): [number, number, number] => [
  channels[0] + (target[0] - channels[0]) * amount,
  channels[1] + (target[1] - channels[1]) * amount,
  channels[2] + (target[2] - channels[2]) * amount,
];

/** Ambient wash derived from one solid colour. */
export function paletteFromColor(hex: string): AmbientPalette {
  const key = `color:${hex.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const channels = hexToRgb(hex) ?? [60, 60, 60];
  const palette: AmbientPalette = [
    rgb(towards(channels, [255, 255, 255], 0.18)),
    rgb(towards(channels, [255, 255, 255], 0.42)),
    rgb(towards(channels, [0, 0, 0], 0.25)),
  ];
  cache.set(key, palette);
  return palette;
}

interface Point {
  r: number;
  g: number;
  b: number;
  weight: number;
}

/**
 * Reads up to three dominant colours from a picture. The image is drawn once at
 * 24×24, so decoding cost is bounded regardless of the source resolution.
 */
export async function paletteFromImage(url: string): Promise<AmbientPalette> {
  const key = `image:${url}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const fallback: AmbientPalette = ['rgb(82, 82, 82)', 'rgb(120, 120, 120)', 'rgb(50, 50, 50)'];
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = 'anonymous';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image_unavailable'));
      element.src = url;
    });
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return fallback;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    const buckets = new Map<string, Point>();
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 128) continue;
      // Bucket to 32 levels per channel: enough to find distinct regions,
      // cheap enough to run in one pass over 576 pixels.
      const r = data[index] & 0xe0;
      const g = data[index + 1] & 0xe0;
      const b = data[index + 2] & 0xe0;
      const bucket = `${r},${g},${b}`;
      const point = buckets.get(bucket) ?? { r: 0, g: 0, b: 0, weight: 0 };
      point.r += data[index];
      point.g += data[index + 1];
      point.b += data[index + 2];
      point.weight += 1;
      buckets.set(bucket, point);
    }
    const ordered = [...buckets.values()].sort((a, b) => b.weight - a.weight).slice(0, 3);
    if (ordered.length === 0) return fallback;
    const colors = ordered.map((point) =>
      rgb([point.r / point.weight, point.g / point.weight, point.b / point.weight] as [number, number, number]),
    );
    const palette: AmbientPalette = [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[1] ?? colors[0]];
    cache.set(key, palette);
    return palette;
  } catch {
    cache.set(key, fallback);
    return fallback;
  }
}

/** Only used by tests and by a background replacement. */
export function forgetAmbient(url: string): void {
  cache.delete(`image:${url}`);
}
