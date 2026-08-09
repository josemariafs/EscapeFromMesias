const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_CHARS = 900_000;
const MAX_TITLE = 120;
const MAX_MESSAGE = 4_000;

export interface FeedbackAttachment {
  filename: string;
  contentType: string;
  /** Raw base64 (sin prefijo data:) */
  content: string;
}

export interface FeedbackPayload {
  title: string;
  message: string;
  accessKind?: string;
  attachments: FeedbackAttachment[];
}

function parseDataUrl(dataUrl: string): { contentType: string; content: string; ext: string } | null {
  const match = /^data:(image\/(jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const contentType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  const subtype = contentType.split('/')[1] ?? 'jpeg';
  const content = match[3].replace(/\s+/g, '');
  if (!content || content.length > MAX_ATTACHMENT_CHARS) return null;
  return { contentType, content, ext: subtype === 'jpeg' ? 'jpg' : subtype };
}

export function normalizeFeedbackInput(raw: {
  title?: unknown;
  message?: unknown;
  accessKind?: unknown;
  images?: unknown;
}): FeedbackPayload | { error: string } {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (!title || title.length > MAX_TITLE) {
    return { error: `Title is required (max ${MAX_TITLE} chars)` };
  }
  if (!message || message.length > MAX_MESSAGE) {
    return { error: `Message is required (max ${MAX_MESSAGE} chars)` };
  }

  const accessKind =
    typeof raw.accessKind === 'string' && raw.accessKind.trim()
      ? raw.accessKind.trim().slice(0, 32)
      : undefined;

  const images = Array.isArray(raw.images) ? raw.images : [];
  if (images.length > MAX_ATTACHMENTS) {
    return { error: `Too many images (max ${MAX_ATTACHMENTS})` };
  }

  const attachments: FeedbackAttachment[] = [];
  for (let i = 0; i < images.length; i += 1) {
    const item = images[i];
    if (typeof item !== 'string') {
      return { error: 'Invalid image payload' };
    }
    const parsed = parseDataUrl(item);
    if (!parsed) {
      return { error: 'Invalid or oversized image' };
    }
    attachments.push({
      filename: `screenshot-${i + 1}.${parsed.ext}`,
      contentType: parsed.contentType,
      content: parsed.content,
    });
  }

  return { title, message, accessKind, attachments };
}

export async function sendFeedbackEmail(payload: FeedbackPayload): Promise<void> {
  const to = process.env.ADMIN_EMAIL?.trim();
  if (!to) {
    throw new Error('ADMIN_EMAIL is not configured');
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const from =
    process.env.FEEDBACK_FROM_EMAIL?.trim()
    || 'Escape From Gorditos <onboarding@resend.dev>';

  const kindLine = payload.accessKind ? `Access: ${payload.accessKind}\n` : '';
  const text = `${kindLine}Title: ${payload.title}\n\n${payload.message}\n`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `[EFG Feedback] ${payload.title}`,
      text,
      html: `<p><strong>Title:</strong> ${escapeHtml(payload.title)}</p>
${payload.accessKind ? `<p><strong>Access:</strong> ${escapeHtml(payload.accessKind)}</p>` : ''}
<p>${escapeHtml(payload.message).replace(/\n/g, '<br/>')}</p>`,
      attachments: payload.attachments.map((file) => ({
        filename: file.filename,
        content: file.content,
        content_type: file.contentType,
      })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = `Email provider error (${response.status})`;
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { message?: string };
        if (parsed.message) message = parsed.message;
        else message = `${message}: ${detail.slice(0, 220)}`;
      } catch {
        message = `${message}: ${detail.slice(0, 220)}`;
      }
    }
    throw new Error(message);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
