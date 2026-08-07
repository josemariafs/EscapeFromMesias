const MAX_IMAGE_CHARS = 600_000;
const DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;

export function normalizeImageUrl(value: unknown): {
  ok: true;
  value: string | null | undefined;
} | {
  ok: false;
  error: string;
} {
  if (value === undefined) return { ok: true, value: undefined };
  if (value == null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: 'Invalid imageUrl' };

  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > MAX_IMAGE_CHARS) {
    return { ok: false, error: 'imageUrl too large' };
  }

  if (DATA_IMAGE_RE.test(trimmed)) {
    return { ok: true, value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: 'Invalid imageUrl' };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: 'Invalid imageUrl' };
  }
}
