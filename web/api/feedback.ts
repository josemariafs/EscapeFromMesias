import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasSiteAccessPasswords, resolveSiteSession } from './_lib/auth.js';
import { normalizeFeedbackInput, sendFeedbackEmail } from './_lib/feedbackMail.js';
import { applyCors, handleOptions, readJsonBody, serverError } from './_lib/http.js';

interface FeedbackBody {
  token?: string;
  title?: string;
  message?: string;
  images?: string[];
}

/** Feedback / reportes de usuarios autenticados → ADMIN_EMAIL (Resend). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!hasSiteAccessPasswords()) {
    applyCors(res);
    res.status(503).json({ error: 'Site access is not configured' });
    return;
  }

  try {
    const body = readJsonBody<FeedbackBody>(req);
    const token = typeof body.token === 'string' ? body.token : '';
    const session = resolveSiteSession(token);
    if (!session.ok) {
      applyCors(res);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const normalized = normalizeFeedbackInput({
      title: body.title,
      message: body.message,
      images: body.images,
      accessKind: session.kind,
    });
    if ('error' in normalized) {
      applyCors(res);
      res.status(400).json({ error: normalized.error });
      return;
    }

    await sendFeedbackEmail(normalized);
    applyCors(res);
    res.status(200).json({ ok: true });
  } catch (err) {
    serverError(res, err);
  }
}
