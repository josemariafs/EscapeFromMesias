import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getSpanishAuthWeekKey,
  getWeeklyAccessCode,
  hasSiteAccessPasswords,
  resolveSiteSession,
} from '../_lib/auth.js';
import { applyCors, handleOptions, readJsonBody } from '../_lib/http.js';

interface DailyCodeBody {
  token?: string;
}

/** Solo sesiones `public` pueden ver el código semanal activo. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!hasSiteAccessPasswords()) {
    applyCors(res);
    res.status(503).json({ error: 'Site access is not configured' });
    return;
  }

  const body = readJsonBody<DailyCodeBody>(req);
  const token = typeof body.token === 'string' ? body.token : '';
  const session = resolveSiteSession(token);

  if (!session.ok) {
    applyCors(res);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (session.kind !== 'public') {
    applyCors(res);
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const code = getWeeklyAccessCode();
  if (!code) {
    applyCors(res);
    res.status(503).json({ error: 'Weekly code is not configured' });
    return;
  }

  const weekKey = getSpanishAuthWeekKey();
  applyCors(res);
  res.status(200).json({
    ok: true,
    code,
    dayKey: weekKey,
    weekKey,
    rotatesAtHour: 5,
    rotatesOn: 'monday',
    timeZone: 'Europe/Madrid',
  });
}
