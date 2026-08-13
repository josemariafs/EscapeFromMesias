import type { VercelRequest, VercelResponse } from '@vercel/node';
import { gzipSync } from 'node:zlib';
import { ensureSchema } from '../_lib/db.js';
import { applyCors, handleOptions, serverError } from '../_lib/http.js';
import {
  readTaskSnapshot,
  type TaskSyncLang,
} from '../_lib/taskSync.js';
import type { GameMode } from '../_lib/eftTypes.js';

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

    const body = JSON.stringify({
      tasks: snapshot.tasks,
      fetchedAt: snapshot.meta.fetchedAt,
      updatedAt: snapshot.meta.updatedAt,
      source: snapshot.meta.source,
      taskCount: snapshot.meta.taskCount,
      schemaVersion: snapshot.meta.schemaVersion,
      gameMode,
      lang,
    });

    applyCors(res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');

    const acceptEncoding = String(req.headers['accept-encoding'] ?? '');
    if (acceptEncoding.includes('gzip') && body.length > 64_000) {
      res.setHeader('Content-Encoding', 'gzip');
      res.status(200).send(gzipSync(Buffer.from(body, 'utf8')));
      return;
    }

    res.status(200).send(body);
  } catch (err) {
    serverError(res, err);
  }
}
