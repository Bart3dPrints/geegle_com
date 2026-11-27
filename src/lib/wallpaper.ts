// Wallpaper preparation: the chosen image is decoded, scaled down and encoded
// as WebP before it is stored. That keeps the preference small enough for the
// account settings record and avoids keeping the user's original file.
//
// Only raster images reach the canvas; the file type and size are checked
// before decoding, so arbitrary content is never stored as a wallpaper.

import {
  WALLPAPER_INPUT_MAX_BYTES,
  WALLPAPER_STORED_MAX_BYTES,
  wallpaperFileProblem,
} from './personalization';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

export type WallpaperResult = { ok: true; dataUrl: string } | { ok: false; error: string };

function scaledSize(width: number, height: number) {
  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareWallpaper(file: File): Promise<WallpaperResult> {
  const problem = wallpaperFileProblem(file);
  if (problem) return { ok: false, error: problem };
  if (file.size > WALLPAPER_INPUT_MAX_BYTES) {
    return { ok: false, error: 'Keep the image under 8 MB.' };
  }

  // Prefer the decoder API, with an <img> fallback for browsers or files it
  // cannot handle. Both paths only ever receive an allowed raster image.
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | null = null;
  try {
    source = await createImageBitmap(file);
  } catch {
    try {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('decode failed'));
        image.src = objectUrl!;
      });
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return { ok: false, error: 'That image could not be read.' };
    }
  }

  try {
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) return { ok: false, error: 'That image could not be read.' };
    const size = scaledSize(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return { ok: false, error: 'This browser cannot prepare the image.' };
    context.drawImage(source, 0, 0, size.width, size.height);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL('image/webp', quality);
    // Step the quality down until the stored preference is small enough.
    while (dataUrl.length * 0.75 > WALLPAPER_STORED_MAX_BYTES && quality > 0.4) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/webp', quality);
    }
    if (!dataUrl.startsWith('data:image/webp;base64,')) {
      return { ok: false, error: 'This browser cannot encode the image.' };
    }
    if (dataUrl.length * 0.75 > WALLPAPER_STORED_MAX_BYTES) {
      return { ok: false, error: 'That image is too large. Choose a smaller one.' };
    }
    return { ok: true, dataUrl };
  } finally {
    if (source instanceof ImageBitmap) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
