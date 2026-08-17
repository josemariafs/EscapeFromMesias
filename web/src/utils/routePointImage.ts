/** Límite de caracteres para data URLs / URLs guardadas en Turso. */
export const MAX_FIXED_POINT_IMAGE_CHARS = 600_000;

const MAX_EDGE_PX = 720;
const JPEG_QUALITY = 0.72;

export function isValidFixedPointImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FIXED_POINT_IMAGE_CHARS) return false;

  if (trimmed.startsWith('data:image/')) {
    return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(trimmed);
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Not an image file');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (dataUrl.length > MAX_FIXED_POINT_IMAGE_CHARS) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    }
    if (dataUrl.length > MAX_FIXED_POINT_IMAGE_CHARS) {
      throw new Error('Image too large after compression');
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
