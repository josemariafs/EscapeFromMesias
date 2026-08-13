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
  newKbReportId,
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
