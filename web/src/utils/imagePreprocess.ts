/** Regiones típicas de la columna "Task" en capturas de Tarkov (1920×1080 aprox.). */
const TASK_COLUMN_CROPS = [
  { x: 0.08, y: 0.15, w: 0.42, h: 0.78 },
  { x: 0.12, y: 0.18, w: 0.28, h: 0.72 },
] as const;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export image'));
    }, 'image/png');
  });
}

function renderCrop(img: HTMLImageElement, crop: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const sx = Math.round(img.naturalWidth * crop.x);
  const sy = Math.round(img.naturalHeight * crop.y);
  const sw = Math.round(img.naturalWidth * crop.w);
  const sh = Math.round(img.naturalHeight * crop.h);
  const targetWidth = Math.max(1200, Math.round(sw * 2.2));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = Math.round((sh / sw) * targetWidth);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.filter = 'grayscale(1) contrast(1.45) brightness(1.08)';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return canvas;
}

/** Recorta y mejora zonas de la captura donde suelen aparecer los nombres de misión. */
export async function preprocessScreenshotForOcr(file: Blob): Promise<Blob[]> {
  const img = await loadImage(file);
  const blobs: Blob[] = [];

  for (const crop of TASK_COLUMN_CROPS) {
    const canvas = renderCrop(img, crop);
    blobs.push(await canvasToBlob(canvas));
  }

  return blobs;
}
