import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthorized, unauthorizedBody } from '../_lib/auth.js';
import {
  ensureSchema,
  getDb,
  kbReportRowToDto,
  newFixedPointId,
  rowToDto,
  type KbDocumentReportRow,
} from '../_lib/db.js';
import { applyCors, handleOptions, readJsonBody, serverError } from '../_lib/http.js';

interface ReviewBody {
  action?: string;
}

const KB_FIXED_COLOR = '#e6a817';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    applyCors(res);
    res.status(401).json(unauthorizedBody());
    return;
  }

  try {
    await ensureSchema();
    const db = getDb();

    const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id) {
      applyCors(res);
      res.status(400).json({ error: 'Missing report id' });
      return;
    }

    const body = readJsonBody<ReviewBody>(req);
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    if (action !== 'accept' && action !== 'reject') {
      applyCors(res);
      res.status(400).json({ error: 'action must be accept or reject' });
      return;
    }

    const existing = await db.execute({
      sql: `SELECT id, map_key, environment, left_pct, top_pct, label, image_url,
                   status, submitted_by, created_at, updated_at, reviewed_at, fixed_point_id
            FROM kb_document_reports
            WHERE id = ?
            LIMIT 1`,
      args: [id],
    });
    const row = existing.rows[0] as unknown as KbDocumentReportRow | undefined;
    if (!row) {
      applyCors(res);
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    if (row.status !== 'pending') {
      applyCors(res);
      res.status(409).json({ error: 'Report already reviewed' });
      return;
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      await db.execute({
        sql: `UPDATE kb_document_reports
              SET status = 'rejected', updated_at = ?, reviewed_at = ?
              WHERE id = ?`,
        args: [now, now, id],
      });
      applyCors(res);
      res.status(200).json({
        report: kbReportRowToDto({
          ...row,
          status: 'rejected',
          updated_at: now,
          reviewed_at: now,
        }),
      });
      return;
    }

    const fixedId = newFixedPointId();
    await db.batch(
      [
        {
          sql: `INSERT INTO fixed_route_points
            (id, map_key, environment, left_pct, top_pct, color, label, image_url, marker_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'kb-document', ?, ?)`,
          args: [
            fixedId,
            row.map_key,
            row.environment,
            row.left_pct,
            row.top_pct,
            KB_FIXED_COLOR,
            row.label,
            row.image_url,
            now,
            now,
          ],
        },
        {
          sql: `UPDATE kb_document_reports
                SET status = 'accepted', updated_at = ?, reviewed_at = ?, fixed_point_id = ?
                WHERE id = ?`,
          args: [now, now, fixedId, id],
        },
      ],
      'write',
    );

    applyCors(res);
    res.status(200).json({
      report: kbReportRowToDto({
        ...row,
        status: 'accepted',
        updated_at: now,
        reviewed_at: now,
        fixed_point_id: fixedId,
      }),
      point: rowToDto({
        id: fixedId,
        map_key: row.map_key,
        environment: row.environment,
        left_pct: row.left_pct,
        top_pct: row.top_pct,
        color: KB_FIXED_COLOR,
        label: row.label,
        image_url: row.image_url,
        marker_type: 'kb-document',
        created_at: now,
        updated_at: now,
      }),
    });
  } catch (err) {
    serverError(res, err);
  }
}
