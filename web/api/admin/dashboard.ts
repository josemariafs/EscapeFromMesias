import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminToken, isAuthorized, unauthorizedBody } from '../_lib/auth.js';
import { ensureSchema, getDb } from '../_lib/db.js';
import { applyCors, handleOptions, serverError } from '../_lib/http.js';
import { readDailyStats } from '../_lib/siteStatsDaily.js';

const ONLINE_WINDOW_MS = 60_000;

async function countOnline(): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM site_visitors WHERE last_seen_at >= ?`,
    args: [since],
  });
  const raw = result.rows[0]?.n ?? (result.rows[0] as { 'COUNT(*)'?: unknown })?.['COUNT(*)'];
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

async function readImpressions(): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT value FROM site_stats WHERE key = 'impressions'`,
    args: [],
  });
  const raw = result.rows[0]?.value;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

async function countBrowsers(): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM site_visitors WHERE visit_count > 0`,
    args: [],
  });
  const raw = result.rows[0]?.n ?? (result.rows[0] as { 'COUNT(*)'?: unknown })?.['COUNT(*)'];
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Panel admin: snapshots, historial de cambios, sync y visitas diarias. */
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
    const db = getDb();

    const [impressions, uniqueBrowsers, online, dailyVisits, snapshotsResult, syncDaysResult, changesResult] =
      await Promise.all([
        readImpressions(),
        countBrowsers(),
        countOnline(),
        readDailyStats(30),
        db.execute({
          sql: `SELECT game_mode, lang, schema_version, source, content_hash, task_count,
                       fetched_at, updated_at, changed_at
                FROM task_snapshots
                ORDER BY game_mode ASC, lang ASC`,
          args: [],
        }),
        db.execute({
          sql: `SELECT day_key, attempts, status, last_attempt_at, last_success_at,
                       last_error, updated_combinations
                FROM task_sync_days
                ORDER BY day_key DESC
                LIMIT 14`,
          args: [],
        }),
        db.execute({
          sql: `SELECT id, game_mode, lang, content_hash, previous_hash, task_count, source, detected_at
                FROM task_snapshot_changes
                ORDER BY detected_at DESC
                LIMIT 40`,
          args: [],
        }),
      ]);

    const snapshots = snapshotsResult.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        gameMode: String(r.game_mode),
        lang: String(r.lang),
        schemaVersion: Number(r.schema_version) || 0,
        source: String(r.source ?? ''),
        contentHash: r.content_hash ? String(r.content_hash) : null,
        taskCount: Number(r.task_count) || 0,
        fetchedAt: String(r.fetched_at ?? ''),
        updatedAt: String(r.updated_at ?? ''),
        changedAt: r.changed_at ? String(r.changed_at) : null,
      };
    });

    const syncDays = syncDaysResult.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        dayKey: String(r.day_key),
        attempts: Number(r.attempts) || 0,
        status: String(r.status),
        lastAttemptAt: r.last_attempt_at ? String(r.last_attempt_at) : null,
        lastSuccessAt: r.last_success_at ? String(r.last_success_at) : null,
        lastError: r.last_error ? String(r.last_error) : null,
        updatedCombinations: Number(r.updated_combinations) || 0,
      };
    });

    const changes = changesResult.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        gameMode: String(r.game_mode),
        lang: String(r.lang),
        contentHash: String(r.content_hash ?? ''),
        previousHash: r.previous_hash ? String(r.previous_hash) : null,
        taskCount: Number(r.task_count) || 0,
        source: String(r.source ?? ''),
        detectedAt: String(r.detected_at ?? ''),
      };
    });

    applyCors(res);
    res.status(200).json({
      summary: {
        impressions,
        uniqueBrowsers,
        online,
        timezone: 'Europe/Madrid',
      },
      snapshots,
      syncDays,
      changes,
      dailyVisits,
    });
  } catch (err) {
    serverError(res, err);
  }
}
