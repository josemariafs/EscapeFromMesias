import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, getDb } from '../_lib/db.js';
import { applyCors, handleOptions, readJsonBody, serverError } from '../_lib/http.js';

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

interface VisitBody {
  visitorId?: string;
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
