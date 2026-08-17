import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthorized, unauthorizedBody } from '../_lib/auth.js';
import {
  clampPct,
  ensureSchema,
  getDb,
  resolveRowEnvironment,
  rowToDto,
  type FixedRoutePointRow,
} from '../_lib/db.js';
import { normalizeRouteEnvironment } from '../_lib/environment.js';
import { applyCors, handleOptions, readJsonBody, sendJson, serverError } from '../_lib/http.js';
import { normalizeImageUrl } from '../_lib/image.js';
import { isValidMapKey } from '../_lib/maps.js';
import {
  DEFAULT_FIXED_MARKER_TYPE,
  isLabellessMarkerType,
  normalizeMarkerType,
  resolveMarkerType,
} from '../_lib/markers.js';

interface PatchBody {
  mapKey?: string;
  environment?: string | null;
  left?: number;
  top?: number;
  color?: string;
  label?: string | null;
  imageUrl?: string | null;
  markerType?: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      applyCors(res);
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    await ensureSchema();
    const db = getDb();

    if (req.method === 'GET') {
      const existing = await db.execute({
        sql: `SELECT id, map_key, environment, left_pct, top_pct, color, label, image_url, marker_type, created_at, updated_at
              FROM fixed_route_points WHERE id = ?`,
        args: [id],
      });
      if (existing.rows.length === 0) {
        applyCors(res);
        res.status(404).json({ error: 'Not found' });
        return;
      }
      sendJson(req, res, 200, {
        point: rowToDto(existing.rows[0] as unknown as FixedRoutePointRow),
      }, {
        cacheControl: 'public, s-maxage=300, stale-while-revalidate=3600, max-age=120',
      });
      return;
    }

    if (!isAuthorized(req)) {
      applyCors(res);
      res.status(401).json(unauthorizedBody());
      return;
    }

    if (req.method === 'DELETE') {
      const result = await db.execute({
        sql: 'DELETE FROM fixed_route_points WHERE id = ?',
        args: [id],
      });
      if (result.rowsAffected === 0) {
        applyCors(res);
        res.status(404).json({ error: 'Not found' });
        return;
      }
      applyCors(res);
      res.status(204).end();
      return;
    }

    if (req.method === 'PATCH') {
      const existing = await db.execute({
        sql: `SELECT id, map_key, environment, left_pct, top_pct, color, label, image_url, marker_type, created_at, updated_at
              FROM fixed_route_points WHERE id = ?`,
        args: [id],
      });
      if (existing.rows.length === 0) {
        applyCors(res);
        res.status(404).json({ error: 'Not found' });
        return;
      }

      const current = existing.rows[0] as unknown as FixedRoutePointRow;
      const body = readJsonBody<PatchBody>(req);

      let mapKey = current.map_key;
      let environment = resolveRowEnvironment(current.environment);
      let leftPct = current.left_pct;
      let topPct = current.top_pct;
      let color = current.color;
      let label = current.label;
      let imageUrl = current.image_url;
      let markerType = resolveMarkerType(current.marker_type);

      if (body.mapKey !== undefined) {
        const next = typeof body.mapKey === 'string' ? body.mapKey.trim() : '';
        if (!isValidMapKey(next)) {
          applyCors(res);
          res.status(400).json({ error: 'Invalid mapKey' });
          return;
        }
        mapKey = next;
      }
      if (body.environment !== undefined) {
        const envParsed = normalizeRouteEnvironment(body.environment);
        if (envParsed.ok === false) {
          applyCors(res);
          res.status(400).json({ error: envParsed.error });
          return;
        }
        environment = envParsed.value;
      }
      if (body.left !== undefined) {
        if (typeof body.left !== 'number' || !Number.isFinite(body.left)) {
          applyCors(res);
          res.status(400).json({ error: 'left must be a number' });
          return;
        }
        leftPct = clampPct(body.left);
      }
      if (body.top !== undefined) {
        if (typeof body.top !== 'number' || !Number.isFinite(body.top)) {
          applyCors(res);
          res.status(400).json({ error: 'top must be a number' });
          return;
        }
        topPct = clampPct(body.top);
      }
      if (body.color !== undefined) {
        const next = typeof body.color === 'string' ? body.color.trim() : '';
        if (!next || next.length > 32) {
          applyCors(res);
          res.status(400).json({ error: 'Invalid color' });
          return;
        }
        color = next;
      }
      if (body.markerType !== undefined) {
        const markerParsed = normalizeMarkerType(body.markerType);
        if (markerParsed.ok === false) {
          applyCors(res);
          res.status(400).json({ error: markerParsed.error });
          return;
        }
        markerType = markerParsed.value ?? DEFAULT_FIXED_MARKER_TYPE;
      }
      if (body.label !== undefined) {
        if (body.label == null || body.label === '' || isLabellessMarkerType(markerType)) {
          label = null;
        } else if (typeof body.label === 'string') {
          label = body.label.trim().slice(0, 80) || null;
        } else {
          applyCors(res);
          res.status(400).json({ error: 'Invalid label' });
          return;
        }
      } else if (isLabellessMarkerType(markerType)) {
        label = null;
      }
      if (body.imageUrl !== undefined) {
        const imageParsed = normalizeImageUrl(body.imageUrl);
        if (imageParsed.ok === false) {
          applyCors(res);
          res.status(400).json({ error: imageParsed.error });
          return;
        }
        imageUrl = imageParsed.value ?? null;
      }

      const now = new Date().toISOString();
      await db.execute({
        sql: `UPDATE fixed_route_points
              SET map_key = ?, environment = ?, left_pct = ?, top_pct = ?, color = ?, label = ?, image_url = ?, marker_type = ?, updated_at = ?
              WHERE id = ?`,
        args: [mapKey, environment, leftPct, topPct, color, label, imageUrl, markerType, now, id],
      });

      applyCors(res);
      res.status(200).json({
        point: rowToDto({
          id,
          map_key: mapKey,
          environment,
          left_pct: leftPct,
          top_pct: topPct,
          color,
          label,
          image_url: imageUrl,
          marker_type: markerType,
          created_at: current.created_at,
          updated_at: now,
        }, { includeImage: body.imageUrl !== undefined }),
      });
      return;
    }

    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    serverError(res, err);
  }
}
