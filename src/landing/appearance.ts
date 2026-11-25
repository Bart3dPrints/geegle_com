export type LandingAppearance = {
  version: 1;
  mode: 'light' | 'dark' | 'system';
  color: string | null;
  image: string | null;
};

export const DEFAULT_APPEARANCE: LandingAppearance = {
  version: 1,
  mode: 'system',
  color: null,
  image: null,
};

export const PRESETS: readonly { name: string; color: string }[] = Object.freeze([
  { name: 'Classic white', color: '#ffffff' },
  { name: 'Charcoal', color: '#364152' },
  { name: 'Soft blue', color: '#dbeafe' },
  { name: 'Sage green', color: '#dce8df' },
  { name: 'Lavender', color: '#e9ddf5' },
  { name: 'Warm beige', color: '#f3e6d0' },
  { name: 'Soft pink', color: '#f8dce5' },
  { name: 'Muted gray', color: '#e5e7eb' },
].map((preset) => Object.freeze(preset)));

const STORAGE_PREFIX = 'geegle-landing-appearance:v1:';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_OUTPUT_EDGE = 2048;
const MAX_OUTPUT_PIXELS = 4_000_000;
const MAX_DATA_URI_LENGTH = 1_000_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_DATA_URI = /^data:image\/(webp|jpeg);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;

function isProducedImageUri(value: string): boolean {
  if (value.length > MAX_DATA_URI_LENGTH) return false;
  const match = IMAGE_DATA_URI.exec(value);
  if (!match || match[2].length === 0) return false;
  return match[1] === 'webp' ? match[2].startsWith('UklGR') : match[2].startsWith('/9j/');
}

export function parseAppearance(value: unknown): LandingAppearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return null;
  if (record.mode !== 'light' && record.mode !== 'dark' && record.mode !== 'system') return null;
  if (record.color !== null && (typeof record.color !== 'string' || !/^#[\da-f]{6}$/i.test(record.color))) return null;
  if (record.image !== null && (typeof record.image !== 'string' || !isProducedImageUri(record.image))) return null;
  return { version: 1, mode: record.mode, color: record.color, image: record.image };
}

function storageKey(accountId?: string): string {
  if (!accountId) return `${STORAGE_PREFIX}guest`;
  return `${STORAGE_PREFIX}account:${encodeURIComponent(accountId)}`;
}

interface CacheEntry {
  value: LandingAppearance;
  synced: boolean;
  edit: string | null;
}

function readEntry(accountId?: string): CacheEntry | null {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(accountId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.format === 2) {
      const value = parseAppearance(data.value);
      return value && typeof data.edit === 'string' && typeof data.synced === 'boolean'
        ? { value, edit: data.edit, synced: data.synced } : null;
    }
    // Old entries have no proof of upload: protect them like local-only edits.
    const value = parseAppearance(data);
    return value ? { value, synced: false, edit: null } : null;
  } catch {
    return null;
  }
}

export function readCachedAppearance(accountId?: string): LandingAppearance | null {
  return readEntry(accountId)?.value ?? null;
}

export function readAppearance(accountId?: string, remote?: unknown): LandingAppearance {
  const cached = readEntry(accountId);
  if (accountId && (!cached || cached.synced)) {
    if (remote === null) return { ...DEFAULT_APPEARANCE };
    const server = parseAppearance(remote);
    if (server) return server;
  }
  return cached?.value ?? { ...DEFAULT_APPEARANCE };
}

export function writeAppearance(value: LandingAppearance, accountId?: string): string {
  const parsed = parseAppearance(value);
  if (!parsed) throw new TypeError('Invalid landing appearance');
  try {
    const edit = crypto.randomUUID();
    globalThis.localStorage.setItem(storageKey(accountId), JSON.stringify({ format: 2, value: parsed, synced: false, edit }));
    return edit;
  } catch {
    throw new Error('Unable to save landing appearance');
  }
}

export function confirmAppearanceSync(accountId: string, edit: string): void {
  const entry = readEntry(accountId);
  // A late acknowledgement must not mark a subsequent local edit as uploaded.
  if (entry?.edit === edit) {
    globalThis.localStorage.setItem(storageKey(accountId), JSON.stringify({ format: 2, ...entry, synced: true }));
  }
}

function dimensionsFromHeader(type: string, bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const uint24le = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
  if (type === 'image/png') {
    if (bytes.length < 24 || view.getUint32(0) !== 0x89504e47 || view.getUint32(12) !== 0x49484452) return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === 'image/webp') {
    if (bytes.length < 30 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP') return null;
    const kind = String.fromCharCode(...bytes.subarray(12, 16));
    if (kind === 'VP8X') return { width: 1 + uint24le(24), height: 1 + uint24le(27) };
    if (kind === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const b1 = bytes[21];
      const b2 = bytes[22];
      const b3 = bytes[23];
      const b4 = bytes[24];
      return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) };
    }
    return null;
  }
  if (type !== 'image/jpeg' || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function outputCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('Canvas encoding is unavailable');
}

async function encodeCanvas(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed')), type, quality);
  });
}

function blobDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read encoded image'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid encoded image'));
    reader.readAsDataURL(blob);
  });
}

export async function compressBackground(file: File): Promise<string> {
  if (!IMAGE_TYPES.has(file.type)) throw new TypeError('Choose a JPEG, PNG, or WebP image');
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new RangeError('Image must be no larger than 10 MB');
  const bytes = new Uint8Array(await file.slice(0, MAX_IMAGE_BYTES).arrayBuffer());
  const dimensions = dimensionsFromHeader(file.type, bytes);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) throw new TypeError('Image dimensions could not be read');
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) throw new RangeError('Image dimensions are too large');

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new RangeError('Image dimensions are invalid or too large');
    }
    const scale = Math.min(1, MAX_OUTPUT_EDGE / bitmap.width, MAX_OUTPUT_EDGE / bitmap.height, Math.sqrt(MAX_OUTPUT_PIXELS / (bitmap.width * bitmap.height)));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = outputCanvas(width, height);
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new Error('Canvas drawing is unavailable');
    context.drawImage(bitmap, 0, 0, width, height);

    for (const type of ['image/webp', 'image/jpeg']) {
      for (const quality of [0.82, 0.68, 0.52, 0.38]) {
        const blob = await encodeCanvas(canvas, type, quality);
        if (blob.type !== type) break;
        const dataUri = await blobDataUri(blob);
        if (dataUri.length <= MAX_DATA_URI_LENGTH) return dataUri;
      }
    }
    throw new RangeError('Compressed image exceeds the storage limit');
  } finally {
    bitmap.close();
  }
}

function parseColor(color: string): [number, number, number] | null {
  const hex = color.trim().match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      return [0, 1, 2].map((index) => parseInt(hex[index] + hex[index], 16)) as [number, number, number];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
    }
    return null;
  }
  const rgb = color.trim().match(/^rgba?\(\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/i);
  if (!rgb) return null;
  const percent = /%\s*[, ]/.test(color);
  return [1, 2, 3].map((index) => {
    const parsed = Number(rgb[index]);
    return Math.max(0, Math.min(255, percent ? parsed * 2.55 : parsed));
  }) as [number, number, number];
}

export function darkInk(background: string): boolean {
  const rgb = parseColor(background);
  if (!rgb) return false;
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179;
}
