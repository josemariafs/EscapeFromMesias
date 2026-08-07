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
import { applyCors, handleOptions, readJsonBody, serverError } from '../_lib/http.js';
import { normalizeImageUrl } from '../_lib/image.js';
import { isValidMapKey } from '../_lib/maps.js';
import {
  DEFAULT_FIXED_MARKER_TYPE,
  isIconMarkerType,
  normalizeMarkerType,
} from '../_lib/markers.js';

interface CreateBody {
  mapKey?: string;
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
      const result = await db.execute(
        `SELECT id, map_key, left_pct, top_pct, color, label, image_url, marker_type, created_at, updated_at
         FROM fixed_route_points
         ORDER BY map_key ASC, created_at ASC`,
      );
      const points = result.rows.map((row) => rowToDto(row as unknown as FixedRoutePointRow));
      applyCors(res);
      res.status(200).json({ points });
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
      const markerParsed = normalizeMarkerType(body.markerType);
      if (markerParsed.ok === false) {
        applyCors(res);
        res.status(400).json({ error: markerParsed.error });
        return;
      }
      const markerType = markerParsed.value ?? DEFAULT_FIXED_MARKER_TYPE;
      const label =
        isIconMarkerType(markerType)
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
          (id, map_key, left_pct, top_pct, color, label, image_url, marker_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, mapKey, leftPct, topPct, color, label, imageUrl, markerType, now, now],
      });

      applyCors(res);
      res.status(201).json({
        point: rowToDto({
          id,
          map_key: mapKey,
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
