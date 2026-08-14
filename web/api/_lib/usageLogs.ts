import { randomUUID } from 'node:crypto';
import { getDb } from './db.js';
import { getMadridCivilDayKey } from './siteAccess.js';

/** Retención de eventos crudos y agregados diarios (Europe/Madrid). */
export const USAGE_RETENTION_DAYS = 90;

export const USAGE_ACCESS_KINDS = ['public', 'private', 'mv', 'daily', 'legacy', 'admin'] as const;
export type UsageAccessKind = (typeof USAGE_ACCESS_KINDS)[number];
/** Filtro admin: claves reales + eventos sin access_kind. */
export type UsageAccessFilter = UsageAccessKind | 'unknown';

export const USAGE_EVENT_NAMES = [
  'app_session_start',
  'home_choice',
  'go_home',
  'quest_tab',
  'quest_category',
  'task_selected',
  'task_started',
  'task_completed',
  'task_reset',
  'story_node_selected',
  'search_used',
  'filter_changed',
  'data_source_changed',
  'logs_connect',
  'logs_disconnect',
  'language_changed',
  'route_map_opened',
  'route_point_added',
  'route_point_removed',
  'route_map_cleared',
  'local_data_wiped',
] as const;

export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number];

const ALLOWED = new Set<string>(USAGE_EVENT_NAMES);
const ACCESS_KIND_SET = new Set<string>(USAGE_ACCESS_KINDS);

const SAFE_PROP_KEYS = new Set([
  'choice',
  'tab',
  'category',
  'taskId',
  'nodeId',
  'filter',
  'value',
  'source',
  'lang',
  'mapKey',
  'gameMode',
  'appUsage',
  'dataSource',
  'status',
  'accessKind',
]);

export interface IncomingUsageEvent {
  name: string;
  occurredAt?: string;
  props?: Record<string, unknown>;
}

export interface StoredUsageEvent {
  id: string;
  visitorId: string;
  sessionId: string;
  eventName: string;
  accessKind: string | null;
  props: Record<string, string | number | boolean> | null;
  dayKey: string;
  occurredAt: string;
}

function dayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  return getMadridCivilDayKey(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000));
}

export function isAllowedUsageEvent(name: string): name is UsageEventName {
  return ALLOWED.has(name);
}

export function isUsageAccessKind(value: string): value is UsageAccessKind {
  return ACCESS_KIND_SET.has(value);
}

export function isUsageAccessFilter(value: string): value is UsageAccessFilter {
  return value === 'unknown' || isUsageAccessKind(value);
}

export function sanitizeUsageProps(
  raw: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!SAFE_PROP_KEYS.has(key)) continue;
    if (typeof value === 'boolean' || typeof value === 'number') {
      if (typeof value === 'number' && !Number.isFinite(value)) continue;
      out[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, 80);
      if (trimmed) out[key] = trimmed;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function extractAccessKind(
  props: Record<string, string | number | boolean> | null,
): UsageAccessKind | null {
  const raw = props?.accessKind;
  if (typeof raw !== 'string') return null;
  return isUsageAccessKind(raw) ? raw : null;
}

export async function recordUsageEvents(input: {
  visitorId: string;
  sessionId: string;
  events: IncomingUsageEvent[];
  now?: Date;
}): Promise<number> {
  const now = input.now ?? new Date();
  const db = getDb();
  let written = 0;

  for (const event of input.events) {
    if (!isAllowedUsageEvent(event.name)) continue;
    const occurred = event.occurredAt && Number.isFinite(Date.parse(event.occurredAt))
      ? new Date(event.occurredAt)
      : now;
    const dayKey = getMadridCivilDayKey(occurred);
    const occurredAt = occurred.toISOString();
    const props = sanitizeUsageProps(event.props);
    const accessKind = extractAccessKind(props);
    const id = randomUUID();

    await db.execute({
      sql: `INSERT INTO usage_events
              (id, visitor_id, session_id, event_name, access_kind, props_json, day_key, occurred_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.visitorId,
        input.sessionId,
        event.name,
        accessKind,
        props ? JSON.stringify(props) : null,
        dayKey,
        occurredAt,
      ],
    });

    const hit = await db.execute({
      sql: `INSERT INTO usage_daily_event_visitors (day_key, event_name, visitor_id)
            VALUES (?, ?, ?)
            ON CONFLICT(day_key, event_name, visitor_id) DO NOTHING`,
      args: [dayKey, event.name, input.visitorId],
    });
    const isNewUnique = Number(hit.rowsAffected ?? 0) > 0;

    await db.execute({
      sql: `INSERT INTO usage_daily_counts
              (day_key, event_name, count, unique_visitors, updated_at)
            VALUES (?, ?, 1, ?, ?)
            ON CONFLICT(day_key, event_name) DO UPDATE SET
              count = count + 1,
              unique_visitors = unique_visitors + ?,
              updated_at = excluded.updated_at`,
      args: [dayKey, event.name, isNewUnique ? 1 : 0, occurredAt, isNewUnique ? 1 : 0],
    });

    written += 1;
  }

  return written;
}

export async function pruneUsageLogs(now = new Date()): Promise<void> {
  const cutoff = dayKeyDaysAgo(USAGE_RETENTION_DAYS, now);
  const db = getDb();
  await db.batch(
    [
      { sql: `DELETE FROM usage_events WHERE day_key < ?`, args: [cutoff] },
      { sql: `DELETE FROM usage_daily_counts WHERE day_key < ?`, args: [cutoff] },
      { sql: `DELETE FROM usage_daily_event_visitors WHERE day_key < ?`, args: [cutoff] },
    ],
    'write',
  );
}

/** Borra eventos sin access_kind y reconstruye agregados diarios. */
export async function purgeUnclassifiedUsageEvents(): Promise<{ deleted: number }> {
  const db = getDb();
  const before = await db.execute({
    sql: `SELECT COUNT(*) AS n
          FROM usage_events
          WHERE access_kind IS NULL OR TRIM(access_kind) = ''`,
    args: [],
  });
  const deleted = num((before.rows[0] as { n?: unknown } | undefined)?.n);

  await db.execute({
    sql: `DELETE FROM usage_events
          WHERE access_kind IS NULL OR TRIM(access_kind) = ''`,
    args: [],
  });

  // Los agregados no distinguen por clave: reconstruir desde lo que queda.
  await db.batch(
    [
      { sql: `DELETE FROM usage_daily_counts`, args: [] },
      { sql: `DELETE FROM usage_daily_event_visitors`, args: [] },
    ],
    'write',
  );

  await db.execute({
    sql: `INSERT INTO usage_daily_event_visitors (day_key, event_name, visitor_id)
          SELECT DISTINCT day_key, event_name, visitor_id
          FROM usage_events`,
    args: [],
  });

  await db.execute({
    sql: `INSERT INTO usage_daily_counts
            (day_key, event_name, count, unique_visitors, updated_at)
          SELECT day_key,
                 event_name,
                 COUNT(*) AS count,
                 COUNT(DISTINCT visitor_id) AS unique_visitors,
                 MAX(occurred_at) AS updated_at
          FROM usage_events
          GROUP BY day_key, event_name`,
    args: [],
  });

  return { deleted };
}

function num(raw: unknown): number {
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function parseProps(raw: unknown): Record<string, string | number | boolean> | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string | number | boolean>;
  } catch {
    return null;
  }
}

function accessKindClause(accessKind: UsageAccessFilter | null): {
  sql: string;
  args: string[];
} {
  if (!accessKind) return { sql: '', args: [] };
  if (accessKind === 'unknown') {
    return { sql: ' AND (access_kind IS NULL OR TRIM(access_kind) = \'\')', args: [] };
  }
  return { sql: ' AND access_kind = ?', args: [accessKind] };
}

export type DailyTrafficAccessKey = UsageAccessKind | 'unknown';

export interface DailyTrafficByAccessRow {
  dayKey: string;
  visits: number;
  uniqueVisitors: number;
  byAccess: Record<DailyTrafficAccessKey, { visits: number; uniqueVisitors: number }>;
}

function emptyAccessBuckets(): Record<
  DailyTrafficAccessKey,
  { visits: number; uniqueVisitors: number }
> {
  return {
    public: { visits: 0, uniqueVisitors: 0 },
    private: { visits: 0, uniqueVisitors: 0 },
    mv: { visits: 0, uniqueVisitors: 0 },
    daily: { visits: 0, uniqueVisitors: 0 },
    legacy: { visits: 0, uniqueVisitors: 0 },
    admin: { visits: 0, uniqueVisitors: 0 },
    unknown: { visits: 0, uniqueVisitors: 0 },
  };
}

function normalizeTrafficAccessKey(raw: unknown): DailyTrafficAccessKey {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (isUsageAccessKind(value)) return value;
  return 'unknown';
}

/**
 * Tráfico diario apilable por tipo de pass.
 * Usa `app_session_start` (sesión con accessKind), no el contador global sin tipar.
 */
export async function readDailyTrafficByAccess(days = 30): Promise<DailyTrafficByAccessRow[]> {
  const db = getDb();
  const from = dayKeyDaysAgo(Math.max(1, days) - 1);
  const result = await db.execute({
    sql: `SELECT day_key,
                 COALESCE(NULLIF(TRIM(access_kind), ''), 'unknown') AS access_kind,
                 COUNT(*) AS visits,
                 COUNT(DISTINCT visitor_id) AS unique_visitors
          FROM usage_events
          WHERE day_key >= ?
            AND event_name = 'app_session_start'
          GROUP BY day_key, COALESCE(NULLIF(TRIM(access_kind), ''), 'unknown')
          ORDER BY day_key ASC`,
    args: [from],
  });

  const map = new Map<string, DailyTrafficByAccessRow>();
  for (const row of result.rows) {
    const r = row as Record<string, unknown>;
    const dayKey = String(r.day_key);
    const kind = normalizeTrafficAccessKey(r.access_kind);
    const visits = num(r.visits);
    const uniqueVisitors = num(r.unique_visitors);
    let entry = map.get(dayKey);
    if (!entry) {
      entry = {
        dayKey,
        visits: 0,
        uniqueVisitors: 0,
        byAccess: emptyAccessBuckets(),
      };
      map.set(dayKey, entry);
    }
    entry.byAccess[kind] = { visits, uniqueVisitors };
    entry.visits += visits;
    // Suma de únicos por pass (un visitante con 2 passes el mismo día cuenta 2).
    entry.uniqueVisitors += uniqueVisitors;
  }

  return [...map.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export async function readUsageAdminSnapshot(
  days = 30,
  accessKind: UsageAccessFilter | null = null,
): Promise<{
  accessKind: UsageAccessFilter | null;
  byAccessKind: { accessKind: string; count: number }[];
  summary: {
    events7d: number;
    uniques7d: number;
    eventsToday: number;
    topEvent7d: string | null;
  };
  dailyTotals: { dayKey: string; events: number; uniqueVisitors: number }[];
  byEvent7d: { eventName: string; count: number; uniqueVisitors: number }[];
  byProp7d: {
    eventName: string;
    propKey: string;
    propValue: string;
    count: number;
  }[];
  recent: StoredUsageEvent[];
}> {
  const db = getDb();
  const from30 = dayKeyDaysAgo(Math.max(1, days) - 1);
  const from7 = dayKeyDaysAgo(6);
  const today = getMadridCivilDayKey();
  const filter = accessKindClause(accessKind);

  const [dailyResult, byEventResult, recentResult, uniques7dResult, byAccessResult] =
    await Promise.all([
      db.execute({
        sql: `SELECT day_key,
                     COUNT(*) AS events,
                     COUNT(DISTINCT visitor_id) AS unique_visitors
              FROM usage_events
              WHERE day_key >= ?${filter.sql}
              GROUP BY day_key
              ORDER BY day_key ASC`,
        args: [from30, ...filter.args],
      }),
      db.execute({
        sql: `SELECT event_name,
                     COUNT(*) AS count,
                     COUNT(DISTINCT visitor_id) AS unique_visitors
              FROM usage_events
              WHERE day_key >= ?${filter.sql}
              GROUP BY event_name
              ORDER BY count DESC`,
        args: [from7, ...filter.args],
      }),
      db.execute({
        sql: `SELECT id, visitor_id, session_id, event_name, access_kind, props_json, day_key, occurred_at
              FROM usage_events
              WHERE 1 = 1${filter.sql}
              ORDER BY occurred_at DESC
              LIMIT 80`,
        args: [...filter.args],
      }),
      db.execute({
        sql: `SELECT COUNT(DISTINCT visitor_id) AS n
              FROM usage_events
              WHERE day_key >= ?${filter.sql}`,
        args: [from7, ...filter.args],
      }),
      // Distribución global (sin filtro) para el selector del admin.
      db.execute({
        sql: `SELECT COALESCE(access_kind, 'unknown') AS access_kind, COUNT(*) AS count
              FROM usage_events
              WHERE day_key >= ?
              GROUP BY COALESCE(access_kind, 'unknown')
              ORDER BY count DESC`,
        args: [from7],
      }),
    ]);

  const dailyTotals = dailyResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      dayKey: String(r.day_key),
      events: num(r.events),
      uniqueVisitors: num(r.unique_visitors),
    };
  });

  const byEvent7d = byEventResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      eventName: String(r.event_name),
      count: num(r.count),
      uniqueVisitors: num(r.unique_visitors),
    };
  });

  const recent: StoredUsageEvent[] = recentResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const props = parseProps(r.props_json);
    const kind =
      typeof r.access_kind === 'string' && r.access_kind
        ? r.access_kind
        : typeof props?.accessKind === 'string'
          ? String(props.accessKind)
          : null;
    return {
      id: String(r.id),
      visitorId: String(r.visitor_id),
      sessionId: String(r.session_id),
      eventName: String(r.event_name),
      accessKind: kind,
      props,
      dayKey: String(r.day_key),
      occurredAt: String(r.occurred_at),
    };
  });

  const byAccessKind = byAccessResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      accessKind: String(r.access_kind),
      count: num(r.count),
    };
  });

  const propEvents = [
    'home_choice',
    'quest_tab',
    'quest_category',
    'data_source_changed',
    'language_changed',
    'route_map_opened',
    'filter_changed',
  ];
  const propResult = await db.execute({
    sql: `SELECT event_name, props_json
          FROM usage_events
          WHERE day_key >= ?
            AND event_name IN (${propEvents.map(() => '?').join(',')})
            AND props_json IS NOT NULL
            ${filter.sql}
          ORDER BY occurred_at DESC
          LIMIT 2000`,
    args: [from7, ...propEvents, ...filter.args],
  });

  const propCounts = new Map<string, number>();
  for (const row of propResult.rows) {
    const r = row as { event_name?: unknown; props_json?: unknown };
    const eventName = String(r.event_name ?? '');
    const props = parseProps(r.props_json);
    if (!props) continue;
    const keyCandidates = ['choice', 'tab', 'category', 'source', 'lang', 'mapKey', 'value', 'filter'];
    for (const propKey of keyCandidates) {
      const raw = props[propKey];
      if (raw == null) continue;
      const propValue = String(raw).slice(0, 80);
      const mapKey = `${eventName}\t${propKey}\t${propValue}`;
      propCounts.set(mapKey, (propCounts.get(mapKey) ?? 0) + 1);
      break;
    }
  }

  const byProp7d = [...propCounts.entries()]
    .map(([key, count]) => {
      const [eventName, propKey, propValue] = key.split('\t');
      return { eventName, propKey, propValue, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  const events7d = byEvent7d.reduce((sum, row) => sum + row.count, 0);
  const eventsToday = dailyTotals.find((d) => d.dayKey === today)?.events ?? 0;
  const uniques7d = num((uniques7dResult.rows[0] as { n?: unknown } | undefined)?.n);

  return {
    accessKind,
    byAccessKind,
    summary: {
      events7d,
      uniques7d,
      eventsToday,
      topEvent7d: byEvent7d[0]?.eventName ?? null,
    },
    dailyTotals,
    byEvent7d,
    byProp7d,
    recent,
  };
}
