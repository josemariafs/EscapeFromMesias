import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { InValue } from '@libsql/client';
import { getAdminToken, isAuthorized, unauthorizedBody } from '../_lib/auth.js';
import { ensureSchema, getDb } from '../_lib/db.js';
import { applyCors, handleOptions, serverError } from '../_lib/http.js';
import { getMadridCivilDayKey } from '../_lib/siteAccess.js';
import { readDailyStats } from '../_lib/siteStatsDaily.js';
import {
  isUsageAccessFilter,
  readDailyTrafficByAccess,
  readUsageAdminSnapshot,
} from '../_lib/usageLogs.js';

const ONLINE_WINDOW_MS = 60_000;

function num(raw: unknown): number {
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

async function countSql(sql: string, args: InValue[] = []): Promise<number> {
  const db = getDb();
  const result = await db.execute({ sql, args });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return 0;
  if ('n' in row) return num(row.n);
  const first = Object.values(row)[0];
  return num(first);
}

function dayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  return getMadridCivilDayKey(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000));
}

/** Panel admin: dashboard (+ uso con ?view=usage). */
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

  const view = typeof req.query.view === 'string' ? req.query.view.trim() : '';
  // Ping de auth: sin tocar Turso (si la DB falla, no debe parecer "token inválido").
  if (view === 'ping') {
    applyCors(res);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
    return;
  }

  try {
    await ensureSchema();
    // Carga diferida: el ping de auth no debe depender de taskSync/tarkovJson.
    const { ensureTaskSyncSchema } = await import('../_lib/taskSync.js');
    await ensureTaskSyncSchema();

    if (view === 'usage') {
      const raw = typeof req.query.accessKind === 'string' ? req.query.accessKind.trim() : '';
      const accessKind = raw && isUsageAccessFilter(raw) ? raw : null;
      const snapshot = await readUsageAdminSnapshot(30, accessKind);
      applyCors(res);
      res.status(200).json({
        timezone: 'Europe/Madrid',
        retentionDays: 90,
        ...snapshot,
      });
      return;
    }

    const db = getDb();
    const today = getMadridCivilDayKey();
    const yesterday = dayKeyDaysAgo(1);
    const weekAgo = dayKeyDaysAgo(6);
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

    const [
      impressions,
      uniqueBrowsers,
      online,
      fixedPoints,
      changes7d,
      dailyStats,
      dailyVisits,
      todayStats,
      yesterdayStats,
      snapshotsResult,
      syncDaysResult,
      changesResult,
    ] = await Promise.all([
      countSql(`SELECT value AS n FROM site_stats WHERE key = 'impressions'`),
      countSql(`SELECT COUNT(*) AS n FROM site_visitors WHERE visit_count > 0`),
      countSql(`SELECT COUNT(*) AS n FROM site_visitors WHERE last_seen_at >= ?`, [onlineSince]),
      countSql(`SELECT COUNT(*) AS n FROM fixed_route_points`),
      countSql(`SELECT COUNT(*) AS n FROM task_snapshot_changes WHERE detected_at >= ?`, [
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      ]),
      readDailyStats(30),
      readDailyTrafficByAccess(30),
      db.execute({
        sql: `SELECT visits, unique_visitors FROM site_daily_stats WHERE day_key = ?`,
        args: [today],
      }),
      db.execute({
        sql: `SELECT visits, unique_visitors FROM site_daily_stats WHERE day_key = ?`,
        args: [yesterday],
      }),
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
        sql: `SELECT id, game_mode, lang, content_hash, previous_hash, task_count,
                     previous_task_count, diff_json, source, detected_at
              FROM task_snapshot_changes
              ORDER BY detected_at DESC
              LIMIT 120`,
        args: [],
      }),
    ]);

    const todayRow = todayStats.rows[0] as { visits?: unknown; unique_visitors?: unknown } | undefined;
    const ydayRow = yesterdayStats.rows[0] as { visits?: unknown; unique_visitors?: unknown } | undefined;
    const visitsToday = num(todayRow?.visits);
    const uniquesToday = num(todayRow?.unique_visitors);
    const visitsYesterday = num(ydayRow?.visits);
    const uniquesYesterday = num(ydayRow?.unique_visitors);

    const weekSlice = dailyStats.filter((d) => d.dayKey >= weekAgo);
    const visits7d = weekSlice.reduce((sum, d) => sum + d.visits, 0);
    const uniques7d = weekSlice.reduce((sum, d) => sum + d.uniqueVisitors, 0);
    const avgVisits7d = weekSlice.length > 0 ? visits7d / weekSlice.length : 0;

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
      let diff: unknown = null;
      if (typeof r.diff_json === 'string' && r.diff_json.trim()) {
        try {
          diff = JSON.parse(r.diff_json);
        } catch {
          diff = null;
        }
      }
      const previousTaskCount =
        r.previous_task_count == null ? null : Number(r.previous_task_count);
      return {
        id: String(r.id),
        gameMode: String(r.game_mode),
        lang: String(r.lang),
        contentHash: String(r.content_hash ?? ''),
        previousHash: r.previous_hash ? String(r.previous_hash) : null,
        taskCount: Number(r.task_count) || 0,
        previousTaskCount: Number.isFinite(previousTaskCount) ? previousTaskCount : null,
        diff,
        source: String(r.source ?? ''),
        detectedAt: String(r.detected_at ?? ''),
      };
    });

    const lastSync = syncDays[0] ?? null;
    const oldestFetchMs = snapshots.reduce<number | null>((acc, s) => {
      const t = Date.parse(s.fetchedAt);
      if (!Number.isFinite(t)) return acc;
      return acc == null ? t : Math.min(acc, t);
    }, null);
    const freshestChangeMs = snapshots.reduce<number | null>((acc, s) => {
      const t = Date.parse(s.changedAt ?? '');
      if (!Number.isFinite(t)) return acc;
      return acc == null ? t : Math.max(acc, t);
    }, null);

    const totalTasks = snapshots
      .filter((s) => s.lang === 'es')
      .reduce((sum, s) => sum + s.taskCount, 0);

    applyCors(res);
    res.status(200).json({
      summary: {
        impressions,
        uniqueBrowsers,
        online,
        fixedPoints,
        timezone: 'Europe/Madrid',
        visitsToday,
        uniquesToday,
        visitsYesterday,
        uniquesYesterday,
        visits7d,
        uniques7d,
        avgVisits7d: Math.round(avgVisits7d * 10) / 10,
        visitsDeltaPct:
          visitsYesterday > 0
            ? Math.round(((visitsToday - visitsYesterday) / visitsYesterday) * 1000) / 10
            : null,
        changes7d,
        totalTasksEs: totalTasks,
        snapshotCount: snapshots.length,
        oldestFetchedAt: oldestFetchMs ? new Date(oldestFetchMs).toISOString() : null,
        lastDatasetChangeAt: freshestChangeMs ? new Date(freshestChangeMs).toISOString() : null,
        lastSync,
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
