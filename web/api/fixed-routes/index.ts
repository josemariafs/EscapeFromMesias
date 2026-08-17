import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthorized, unauthorizedBody } from '../_lib/auth.js';
import {
  clampPct,
  ensureSchema,
  getDb,
  newFixedPointId,
  rowToDto,
  type FixedRoutePointRow,
} from '../_lib/db.js';
import {
  DEFAULT_ROUTE_ENVIRONMENT,
  normalizeRouteEnvironment,
} from '../_lib/environment.js';
import { applyCors, handleOptions, readJsonBody, sendJson, serverError } from '../_lib/http.js';
import { normalizeImageUrl } from '../_lib/image.js';
import { isValidMapKey } from '../_lib/maps.js';
import {
  DEFAULT_FIXED_MARKER_TYPE,
  isLabellessMarkerType,
  normalizeMarkerType,
} from '../_lib/markers.js';

interface CreateBody {
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
    await ensureSchema();
    const db = getDb();

    if (req.method === 'GET') {
      const rawEnv = Array.isArray(req.query.environment)
        ? req.query.environment[0]
        : req.query.environment;
      const envParsed = normalizeRouteEnvironment(rawEnv ?? DEFAULT_ROUTE_ENVIRONMENT);
      if (envParsed.ok === false) {
        applyCors(res);
        res.status(400).json({ error: envParsed.error });
        return;
      }

      const rawMapKey = Array.isArray(req.query.mapKey) ? req.query.mapKey[0] : req.query.mapKey;
      const mapKey = typeof rawMapKey === 'string' ? rawMapKey.trim() : '';
      const rawImages = Array.isArray(req.query.images) ? req.query.images[0] : req.query.images;
      const includeImages = rawImages === '1' || rawImages === 'true';

      if (includeImages) {
        if (!isValidMapKey(mapKey)) {
          applyCors(res);
          res.status(400).json({ error: 'mapKey is required when images=1' });
          return;
        }
        const result = await db.execute({
          sql: `SELECT id, map_key, environment, left_pct, top_pct, color, label, image_url, marker_type, created_at, updated_at
                FROM fixed_route_points
                WHERE environment = ? AND map_key = ?
                ORDER BY created_at ASC`,
          args: [envParsed.value, mapKey],
        });
        const points = result.rows.map((row) => rowToDto(row as unknown as FixedRoutePointRow));
        sendJson(req, res, 200, { points, environment: envParsed.value, mapKey }, {
          cacheControl: 'public, s-maxage=120, stale-while-revalidate=600, max-age=60',
        });
        return;
      }

      const result = await db.execute({
        sql: `SELECT id, map_key, environment, left_pct, top_pct, color, label,
                     CASE WHEN image_url IS NOT NULL AND length(image_url) > 0 THEN 1 ELSE 0 END AS has_image,
                     marker_type, created_at, updated_at
              FROM fixed_route_points
              WHERE environment = ?
              ORDER BY map_key ASC, created_at ASC`,
        args: [envParsed.value],
      });
      const points = result.rows.map((row) =>
        rowToDto(row as unknown as FixedRoutePointRow, { includeImage: false }),
      );
      sendJson(req, res, 200, { points, environment: envParsed.value }, {
        cacheControl: 'public, s-maxage=60, stale-while-revalidate=300, max-age=30',
      });
      return;
    }

    if (req.method === 'POST') {
      if (!isAuthorized(req)) {
        applyCors(res);
        res.status(401).json(unauthorizedBody());
        return;
      }

      const body = readJsonBody<CreateBody>(req);
      const mapKey = typeof body.mapKey === 'string' ? body.mapKey.trim() : '';
      const left = typeof body.left === 'number' ? body.left : Number.NaN;
      const top = typeof body.top === 'number' ? body.top : Number.NaN;
      const color = typeof body.color === 'string' ? body.color.trim() : '';
      const envParsed = normalizeRouteEnvironment(body.environment);
      if (envParsed.ok === false) {
        applyCors(res);
        res.status(400).json({ error: envParsed.error });
        return;
      }
      const environment = envParsed.value;
      const markerParsed = normalizeMarkerType(body.markerType);
      if (markerParsed.ok === false) {
        applyCors(res);
        res.status(400).json({ error: markerParsed.error });
        return;
      }
      const markerType = markerParsed.value ?? DEFAULT_FIXED_MARKER_TYPE;
      const label =
        isLabellessMarkerType(markerType)
          ? null
          : typeof body.label === 'string' && body.label.trim()
            ? body.label.trim().slice(0, 80)
            : null;
      const imageParsed = normalizeImageUrl(body.imageUrl);
      if (imageParsed.ok === false) {
        applyCors(res);
        res.status(400).json({ error: imageParsed.error });
        return;
      }
      const imageUrl = imageParsed.value ?? null;

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
      if (!color || color.length > 32) {
        applyCors(res);
        res.status(400).json({ error: 'Invalid color' });
        return;
      }

      const id = newFixedPointId();
      const now = new Date().toISOString();
      const leftPct = clampPct(left);
      const topPct = clampPct(top);

      await db.execute({
        sql: `INSERT INTO fixed_route_points
          (id, map_key, environment, left_pct, top_pct, color, label, image_url, marker_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, mapKey, environment, leftPct, topPct, color, label, imageUrl, markerType, now, now],
      });

      applyCors(res);
      res.status(201).json({
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
          created_at: now,
          updated_at: now,
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
