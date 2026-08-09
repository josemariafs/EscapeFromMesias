import { getDb } from './db.js';
import { getMadridCivilDayKey } from './siteAccess.js';

/** Retención de series diarias y hits (Europe/Madrid). */
export const DAILY_STATS_RETENTION_DAYS = 90;

function dayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  return getMadridCivilDayKey(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000));
}

/** Registra una visita de sesión en el contador diario (Madrid). */
export async function recordDailyVisit(visitorId: string, now = new Date()): Promise<void> {
  const db = getDb();
  const dayKey = getMadridCivilDayKey(now);
  const iso = now.toISOString();

  const hit = await db.execute({
    sql: `INSERT INTO site_daily_visitor_hits (day_key, visitor_id)
          VALUES (?, ?)
          ON CONFLICT(day_key, visitor_id) DO NOTHING`,
    args: [dayKey, visitorId],
  });
  const isNewUnique = Number(hit.rowsAffected ?? 0) > 0;

  await db.execute({
    sql: `INSERT INTO site_daily_stats (day_key, visits, unique_visitors, updated_at)
          VALUES (?, 1, ?, ?)
          ON CONFLICT(day_key) DO UPDATE SET
            visits = visits + 1,
            unique_visitors = unique_visitors + ?,
            updated_at = excluded.updated_at`,
    args: [dayKey, isNewUnique ? 1 : 0, iso, isNewUnique ? 1 : 0],
  });
}

export async function pruneDailyStats(now = new Date()): Promise<void> {
  const cutoff = dayKeyDaysAgo(DAILY_STATS_RETENTION_DAYS, now);
  const db = getDb();
  await db.batch(
    [
      {
        sql: `DELETE FROM site_daily_visitor_hits WHERE day_key < ?`,
        args: [cutoff],
      },
      {
        sql: `DELETE FROM site_daily_stats WHERE day_key < ?`,
        args: [cutoff],
      },
    ],
    'write',
  );
}

export async function readDailyStats(days = 30): Promise<
  { dayKey: string; visits: number; uniqueVisitors: number }[]
> {
  const db = getDb();
  const from = dayKeyDaysAgo(Math.max(1, days) - 1);
  const result = await db.execute({
    sql: `SELECT day_key, visits, unique_visitors
          FROM site_daily_stats
          WHERE day_key >= ?
          ORDER BY day_key ASC`,
    args: [from],
  });
  return result.rows.map((row) => {
    const r = row as { day_key: string; visits: number; unique_visitors: number };
    return {
      dayKey: String(r.day_key),
      visits: Number(r.visits) || 0,
      uniqueVisitors: Number(r.unique_visitors) || 0,
    };
  });
}
