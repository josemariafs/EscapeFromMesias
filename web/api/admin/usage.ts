import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminToken, isAuthorized, unauthorizedBody } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/db.js';
import { applyCors, handleOptions, serverError } from '../_lib/http.js';
import { isUsageAccessFilter, readUsageAdminSnapshot } from '../_lib/usageLogs.js';

/** Panel admin: logs de uso agregados + recientes. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!getAdminToken()) {
    applyCors(res);
    res.status(503).json({ error: 'ADMIN_TOKEN is not configured' });
    return;
  }

  if (!isAuthorized(req)) {
    applyCors(res);
    res.status(401).json(unauthorizedBody());
    return;
  }

  try {
    await ensureSchema();
    const raw = typeof req.query.accessKind === 'string' ? req.query.accessKind.trim() : '';
    const accessKind = raw && isUsageAccessFilter(raw) ? raw : null;
    const snapshot = await readUsageAdminSnapshot(30, accessKind);
    applyCors(res);
    res.status(200).json({
      timezone: 'Europe/Madrid',
      retentionDays: 90,
      ...snapshot,
    });
  } catch (err) {
    serverError(res, err);
  }
}
