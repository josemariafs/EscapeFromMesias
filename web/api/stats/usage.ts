import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema } from '../_lib/db.js';
import { applyCors, handleOptions, readJsonBody, serverError } from '../_lib/http.js';
import {
  isAllowedUsageEvent,
  pruneUsageLogs,
  recordUsageEvents,
  type IncomingUsageEvent,
} from '../_lib/usageLogs.js';

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
const MAX_EVENTS = 25;

interface UsageBody {
  visitorId?: string;
  sessionId?: string;
  events?: IncomingUsageEvent[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await ensureSchema();
    const body = readJsonBody<UsageBody>(req);
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!VISITOR_ID_RE.test(visitorId) || !SESSION_ID_RE.test(sessionId)) {
      applyCors(res);
      res.status(400).json({ error: 'Invalid visitorId or sessionId' });
      return;
    }

    const rawEvents = Array.isArray(body.events) ? body.events : [];
    const events = rawEvents
      .slice(0, MAX_EVENTS)
      .filter((e): e is IncomingUsageEvent => !!e && typeof e.name === 'string' && isAllowedUsageEvent(e.name));

    if (events.length === 0) {
      applyCors(res);
      res.status(400).json({ error: 'No valid events' });
      return;
    }

    const accepted = await recordUsageEvents({ visitorId, sessionId, events });

    try {
      if (Math.random() < 0.03) await pruneUsageLogs();
    } catch {
      // No bloquear ingestión si falla la purga.
    }

    applyCors(res);
    res.status(200).json({ accepted });
  } catch (err) {
    serverError(res, err);
  }
}
