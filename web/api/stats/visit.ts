import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, getDb } from '../_lib/db.js';
import { applyCors, handleOptions, readJsonBody, serverError } from '../_lib/http.js';
import { pruneDailyStats, recordDailyVisit } from '../_lib/siteStatsDaily.js';
import {
  isAllowedUsageEvent,
  pruneUsageLogs,
  recordUsageEvents,
  type IncomingUsageEvent,
} from '../_lib/usageLogs.js';

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
const MAX_EVENTS = 25;

interface VisitBody {
  visitorId?: string;
  sessionId?: string;
  events?: IncomingUsageEvent[];
}

async function readImpressions(): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT value FROM site_stats WHERE key = 'impressions'`,
    args: [],
  });
  const raw = result.rows[0]?.value;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

async function handleUsagePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = readJsonBody<VisitBody>(req);
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
}

/** Visitas (GET/POST) y telemetría de uso (POST con `events`). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  try {
    await ensureSchema();
    const db = getDb();

    if (req.method === 'GET') {
      const impressions = await readImpressions();
      applyCors(res);
      res.status(200).json({ impressions });
      return;
    }

    if (req.method === 'POST') {
      const body = readJsonBody<VisitBody>(req);
      if (Array.isArray(body.events)) {
        await handleUsagePost(req, res);
        return;
      }

      const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
      if (!VISITOR_ID_RE.test(visitorId)) {
        applyCors(res);
        res.status(400).json({ error: 'Invalid visitorId' });
        return;
      }

      const now = new Date().toISOString();
      const existing = await db.execute({
        sql: `SELECT id FROM site_visitors WHERE id = ?`,
        args: [visitorId],
      });

      if (existing.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO site_visitors (id, first_seen_at, last_seen_at, visit_count)
                VALUES (?, ?, ?, 1)`,
          args: [visitorId, now, now],
        });
      } else {
        await db.execute({
          sql: `UPDATE site_visitors
                SET last_seen_at = ?, visit_count = visit_count + 1
                WHERE id = ?`,
          args: [now, visitorId],
        });
      }

      const bumped = await db.execute({
        sql: `INSERT INTO site_stats (key, value) VALUES ('impressions', 1)
              ON CONFLICT(key) DO UPDATE SET value = value + 1
              RETURNING value`,
        args: [],
      });
      const raw = bumped.rows[0]?.value;
      const impressions = typeof raw === 'number' ? raw : Number(raw);

      try {
        await recordDailyVisit(visitorId);
        // Purga ocasional (~2%) para no alargar cada request.
        if (Math.random() < 0.02) await pruneDailyStats();
      } catch {
        // No bloquear el contador global si falla la serie diaria.
      }

      applyCors(res);
      res.status(200).json({
        impressions: Number.isFinite(impressions) ? impressions : await readImpressions(),
      });
      return;
    }

    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    serverError(res, err);
  }
}
