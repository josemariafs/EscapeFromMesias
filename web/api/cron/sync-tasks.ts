import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema } from '../_lib/db.js';
import { applyCors, handleOptions, serverError } from '../_lib/http.js';
import { isCronAuthorized, runTaskSync } from '../_lib/taskSync.js';

/**
 * Cron diario de misiones (Europe/Madrid).
 * - Hobby: 1 ejecución/día a las 03:00 UTC (~05:00 Madrid en verano)
 * - La lógica interna sigue soportando reintentos si el plan permite más invocaciones
 * - Si falla: conserva el último snapshot válido en Turso
 *
 * Auth: Authorization Bearer CRON_SECRET (Vercel Cron) o ADMIN_TOKEN.
 * Forzar: GET /api/cron/sync-tasks?force=1
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isCronAuthorized(req)) {
    applyCors(res);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await ensureSchema();
    const force =
      req.query.force === '1'
      || req.query.force === 'true'
      || (typeof req.body === 'object' && req.body != null && (req.body as { force?: unknown }).force === true);

    const outcome = await runTaskSync({ force: Boolean(force) });
    applyCors(res);
    res.status(200).json({ ok: true, ...outcome });
  } catch (err) {
    serverError(res, err);
  }
}
