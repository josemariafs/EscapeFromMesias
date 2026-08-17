import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema } from '../_lib/db.js';
import {
  applyCors,
  etagMatches,
  handleOptions,
  sendJson,
  sendNotModified,
  serverError,
} from '../_lib/http.js';
import {
  readTaskSnapshot,
  type TaskSyncLang,
} from '../_lib/taskSync.js';
import type { GameMode } from '../_lib/eftTypes.js';

const TASKS_CACHE_CONTROL = 'public, s-maxage=900, stale-while-revalidate=86400, max-age=300';

function parseGameMode(value: unknown): GameMode | null {
  if (value === 'regular' || value === 'pve' || value === 'seasonal') return value;
  return null;
}

function parseLang(value: unknown): TaskSyncLang | null {
  if (value === 'es' || value === 'en') return value;
  return null;
}

/**
 * Sirve el snapshot de misiones almacenado en Turso (rellenado por el cron).
 * GET /api/tasks?gameMode=regular|seasonal|pve&lang=es|en
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    applyCors(res);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await ensureSchema();

    const gameMode = parseGameMode(req.query.gameMode);
    const lang = parseLang(req.query.lang);
    if (!gameMode || !lang) {
      applyCors(res);
      res.status(400).json({
        error: 'Query params requeridos: gameMode=regular|seasonal|pve y lang=es|en',
      });
      return;
    }

    const snapshot = await readTaskSnapshot(gameMode, lang);
    if (!snapshot) {
      applyCors(res);
      res.status(503).json({
        error:
          'Aún no hay misiones sincronizadas en el servidor. '
          + 'Espera al cron de las 05:00 (Europe/Madrid) o fuerza /api/cron/sync-tasks?force=1',
      });
      return;
    }

    const etag = snapshot.meta.contentHash
      ? `"${snapshot.meta.contentHash}"`
      : undefined;
    if (etag && etagMatches(req.headers['if-none-match'], etag)) {
      sendNotModified(res, TASKS_CACHE_CONTROL, etag);
      return;
    }

    sendJson(req, res, 200, {
      tasks: snapshot.tasks,
      fetchedAt: snapshot.meta.fetchedAt,
      updatedAt: snapshot.meta.updatedAt,
      source: snapshot.meta.source,
      taskCount: snapshot.meta.taskCount,
      schemaVersion: snapshot.meta.schemaVersion,
      gameMode,
      lang,
    }, {
      cacheControl: TASKS_CACHE_CONTROL,
      etag,
    });
  } catch (err) {
    serverError(res, err);
  }
}
