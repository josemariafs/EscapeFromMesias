import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasSiteAccessPasswords, resolveSiteLogin } from '../_lib/auth.js';
import { applyCors, handleOptions, readJsonBody } from '../_lib/http.js';

interface LoginBody {
  password?: string;
}

/** Valida tokens permanentes o el código semanal ES y emite sesión. */
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

  const body = readJsonBody<LoginBody>(req);
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  const result = resolveSiteLogin(password);

  if (!result.ok) {
    applyCors(res);
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  applyCors(res);
  res.status(200).json({
    ok: true,
    token: result.token,
    kind: result.kind,
  });
}
