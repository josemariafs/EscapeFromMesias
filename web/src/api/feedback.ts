import { getStoredSiteSession } from './siteAuth';

export interface SubmitFeedbackInput {
  title: string;
  message: string;
  images: string[];
}

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
  const token = getStoredSiteSession();
  if (!token) {
    return { ok: false, error: 'session' };
  }

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        title: input.title,
        message: input.message,
        images: input.images,
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      const raw = data?.error?.trim() || `http_${res.status}`;
      return { ok: false, error: raw };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}
