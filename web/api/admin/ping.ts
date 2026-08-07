import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminToken, isAuthorized, unauthorizedBody } from '../_lib/auth.js';
import { applyCors, handleOptions } from '../_lib/http.js';

/** Comprueba que el Bearer token coincide con ADMIN_TOKEN. */
export default function handler(req: VercelRequest, res: VercelResponse) {
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

  applyCors(res);
  res.status(200).json({ ok: true });
}
