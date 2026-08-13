import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  hasSiteAccessPasswords,
  isAuthorized,
  resolveSiteSession,
  unauthorizedBody,
} from '../_lib/auth.js';
import {
  clampPct,
  ensureSchema,
  getDb,
  kbReportRowToDto,
  newFixedPointId,
  newKbReportId,
  rowToDto,
  type KbDocumentReportRow,
} from '../_lib/db.js';
import {
  DEFAULT_ROUTE_ENVIRONMENT,
  normalizeRouteEnvironment,
} from '../_lib/environment.js';
import { applyCors, handleOptions, readJsonBody, serverError } from '../_lib/http.js';
import { normalizeImageUrl } from '../_lib/image.js';
import { isValidMapKey } from '../_lib/maps.js';

interface CreateBody {
  token?: string;
  mapKey?: string;
  environment?: string | null;
  left?: number;
  top?: number;
  label?: string | null;
  imageUrl?: string | null;
}

interface ReviewBody {
  id?: string;
  action?: string;
}

const KB_FIXED_COLOR = '#e6a817';

async function handleReview(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!isAuthorized(req)) {
    applyCors(res);
    res.status(401).json(unauthorizedBody());
    return;
  }

  const db = getDb();
  const body = readJsonBody<ReviewBody>(req);
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!id) {
    applyCors(res);
    res.status(400).json({ error: 'Missing report id' });
    return;
  }
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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  try {
    await ensureSchema();
    const db = getDb();

    if (req.method === 'GET') {
      if (!isAuthorized(req)) {
        applyCors(res);
        res.status(401).json(unauthorizedBody());
        return;
      }

      const rawStatus = Array.isArray(req.query.status)
        ? req.query.status[0]
        : req.query.status;
      const status =
        rawStatus === 'accepted' || rawStatus === 'rejected' || rawStatus === 'pending'
          ? rawStatus
          : 'pending';

      const result = await db.execute({
        sql: `SELECT id, map_key, environment, left_pct, top_pct, label, image_url,
                     status, submitted_by, created_at, updated_at, reviewed_at, fixed_point_id
              FROM kb_document_reports
              WHERE status = ?
              ORDER BY created_at DESC
              LIMIT 200`,
        args: [status],
      });
      const reports = result.rows.map((row) =>
        kbReportRowToDto(row as unknown as KbDocumentReportRow),
      );
      applyCors(res);
      res.status(200).json({ reports, status });
      return;
    }

    if (req.method === 'PATCH') {
      await handleReview(req, res);
      return;
    }

    if (req.method === 'POST') {
      if (!hasSiteAccessPasswords()) {
        applyCors(res);
        res.status(503).json({ error: 'Site access is not configured' });
        return;
      }

      const body = readJsonBody<CreateBody>(req);
      const token = typeof body.token === 'string' ? body.token : '';
      const session = resolveSiteSession(token);
      if (!session.ok) {
        applyCors(res);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const mapKey = typeof body.mapKey === 'string' ? body.mapKey.trim() : '';
      const left = typeof body.left === 'number' ? body.left : Number.NaN;
      const top = typeof body.top === 'number' ? body.top : Number.NaN;
      const envParsed = normalizeRouteEnvironment(body.environment ?? DEFAULT_ROUTE_ENVIRONMENT);
      if (envParsed.ok === false) {
        applyCors(res);
        res.status(400).json({ error: envParsed.error });
        return;
      }
      const label =
        typeof body.label === 'string' && body.label.trim()
          ? body.label.trim().slice(0, 80)
          : null;
      const imageParsed = normalizeImageUrl(body.imageUrl);
      if (imageParsed.ok === false) {
        applyCors(res);
        res.status(400).json({ error: imageParsed.error });
        return;
      }
      if (!imageParsed.value) {
        applyCors(res);
        res.status(400).json({ error: 'imageUrl is required' });
        return;
      }
      if (!isValidMapKey(mapKey)) {
        applyCors(res);
        res.status(400).json({ error: 'Invalid mapKey' });
        return;
      }
      if (!Number.isFinite(left) || !Number.isFinite(top)) {
        applyCors(res);
        res.status(400).json({ error: 'left and top must be numbers' });
        return;
      }

      const id = newKbReportId();
      const now = new Date().toISOString();
      const leftPct = clampPct(left);
      const topPct = clampPct(top);
      const environment = envParsed.value;

      await db.execute({
        sql: `INSERT INTO kb_document_reports
          (id, map_key, environment, left_pct, top_pct, label, image_url, status,
           submitted_by, created_at, updated_at, reviewed_at, fixed_point_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL, NULL)`,
        args: [
          id,
          mapKey,
          environment,
          leftPct,
          topPct,
          label,
          imageParsed.value,
          session.kind,
          now,
          now,
        ],
      });

      applyCors(res);
      res.status(201).json({
        report: kbReportRowToDto({
          id,
          map_key: mapKey,
          environment,
          left_pct: leftPct,
          top_pct: topPct,
          label,
          image_url: imageParsed.value,
          status: 'pending',
          submitted_by: session.kind,
          created_at: now,
          updated_at: now,
          reviewed_at: null,
          fixed_point_id: null,
        }),
      });
      return;
    }

    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    serverError(res, err);
  }
}
