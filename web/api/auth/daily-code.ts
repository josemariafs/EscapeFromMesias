import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  canRevealWeeklyCode,
  getRevealableWeeklyCode,
  getSpanishAuthWeekKey,
  hasSiteAccessPasswords,
  resolveSiteSession,
} from '../_lib/auth.js';
import { applyCors, handleOptions, readJsonBody } from '../_lib/http.js';

interface DailyCodeBody {
  token?: string;
}

/** Solo sesiones permanentes `public` y `mv` revelan el código de su audiencia. */
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
  const now = new Date();
  const session = resolveSiteSession(token, now);

  if (!session.ok) {
    applyCors(res);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!canRevealWeeklyCode(session.kind)) {
    applyCors(res);
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const code = getRevealableWeeklyCode(session.kind, now);
  if (!code) {
    applyCors(res);
    res.status(503).json({ error: 'Weekly code is not configured' });
    return;
  }

  const weekKey = getSpanishAuthWeekKey(now);
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
