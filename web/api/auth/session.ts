import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasSiteAccessPasswords, resolveSiteSession } from '../_lib/auth.js';
import { applyCors, handleOptions, readJsonBody } from '../_lib/http.js';

interface SessionBody {
  token?: string;
}

/** Comprueba sesión y devuelve el tipo de acceso. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!hasSiteAccessPasswords()) {
    applyCors(res);
    res.status(503).json({
      error: 'PERMANENT_TOKEN_PUBLIC / PERMANENT_TOKEN_PRIVATE are not configured',
    });
    return;
  }

  const body = readJsonBody<SessionBody>(req);
  const token = typeof body.token === 'string' ? body.token : '';
  const result = resolveSiteSession(token);

  if (!result.ok) {
    applyCors(res);
    res.status(401).json({ ok: false });
    return;
  }

  applyCors(res);
  res.status(200).json({ ok: true, kind: result.kind });
}
