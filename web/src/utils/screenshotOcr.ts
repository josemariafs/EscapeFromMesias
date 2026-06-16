import { preprocessScreenshotForOcr } from './imagePreprocess';

export async function extractTextFromImages(files: Blob[]): Promise<string> {
  if (files.length === 0) return '';

  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng');
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
  });

  try {
    const parts: string[] = [];

    for (const file of files) {
      let variants: Blob[];
      try {
        variants = await preprocessScreenshotForOcr(file);
      } catch {
        variants = [file];
      }

      for (const variant of variants) {
        const { data: { text } } = await worker.recognize(variant);
        if (text.trim()) parts.push(text);
      }
    }

    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}

export function getImagesFromClipboardEvent(event: ClipboardEvent): Blob[] {
  const items = event.clipboardData?.items;
  if (!items) return [];

  const images: Blob[] = [];
  for (const item of items) {
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) images.push(file);
  }
  return images;
}
