export async function extractTextFromImages(files: Blob[]): Promise<string> {
  if (files.length === 0) return '';

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    const parts: string[] = [];
    for (const file of files) {
      const { data: { text } } = await worker.recognize(file);
      parts.push(text);
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
