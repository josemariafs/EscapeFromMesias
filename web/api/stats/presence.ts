import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, getDb } from '../_lib/db.js';
import { applyCors, handleOptions, readJsonBody, serverError } from '../_lib/http.js';

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
/** Ventana para considerar a un visitante "online". */
const ONLINE_WINDOW_MS = 90_000;

interface PresenceBody {
  visitorId?: string;
}

function onlineSinceIso(): string {
  return new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
}

async function countOnline(): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM site_visitors WHERE last_seen_at >= ?`,
    args: [onlineSinceIso()],
  });
  const raw = result.rows[0]?.n ?? (result.rows[0] as { 'COUNT(*)'?: unknown })?.['COUNT(*)'];
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  try {
    await ensureSchema();
    const db = getDb();

    if (req.method === 'GET') {
      const online = await countOnline();
      applyCors(res);
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=45, max-age=10');
      res.status(200).json({ online, windowMs: ONLINE_WINDOW_MS });
      return;
    }

    if (req.method === 'POST') {
      const body = readJsonBody<PresenceBody>(req);
      const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
      if (!VISITOR_ID_RE.test(visitorId)) {
        applyCors(res);
        res.status(400).json({ error: 'Invalid visitorId' });
        return;
      }

      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO site_visitors (id, first_seen_at, last_seen_at, visit_count)
              VALUES (?, ?, ?, 0)
              ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
        args: [visitorId, now, now],
      });

      const online = await countOnline();
      applyCors(res);
      res.status(200).json({ online, windowMs: ONLINE_WINDOW_MS });
      return;
    }

    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    serverError(res, err);
  }
}
