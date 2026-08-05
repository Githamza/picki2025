const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface CompressImageOptions {
  /** Longest edge of the output image. Defaults to 1600px. */
  maxDimension?: number;
  /** JPEG encoding quality (0-1). Defaults to 0.82. */
  quality?: number;
  /** Files below this size that need no resize are returned as-is. Defaults to 200kB. */
  minSizeToCompress?: number;
}

/**
 * Downscales and re-encodes an image in the browser before upload.
 * Photos become JPEG; images with transparency stay PNG. If the
 * re-encoded result is not smaller than the original, the original
 * file is returned unchanged.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.82;
  const minSizeToCompress = options.minSizeToCompress ?? 200 * 1024;

  if (!COMPRESSIBLE_TYPES.includes(file.type)) {
    return file;
  }

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    // Undecodable image: let the server-side validation deal with it.
    return file;
  }

  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
  );
  if (scale === 1 && file.size < minSizeToCompress) {
    return file;
  }

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return file;
  }
  ctx.drawImage(image, 0, 0, width, height);

  const keepAlpha = file.type !== 'image/jpeg' && hasTransparency(ctx, width, height);
  const outputType = keepAlpha ? 'image/png' : 'image/jpeg';

  const blob = await canvasToBlob(canvas, outputType, quality);
  if (!blob || blob.size >= file.size) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}${keepAlpha ? '.png' : '.jpg'}`, {
    type: outputType,
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    image.src = url;
  });
}

function hasTransparency(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  const data = ctx.getImageData(0, 0, width, height).data;
  // Sample every 16th pixel; enough to detect real transparency cheaply.
  for (let i = 3; i < data.length; i += 64) {
    if (data[i] < 250) {
      return true;
    }
  }
  return false;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
