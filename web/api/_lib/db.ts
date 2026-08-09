import { createClient, type Client } from '@libsql/client';
import {
  DEFAULT_ROUTE_ENVIRONMENT,
  isRouteEnvironment,
  type RouteEnvironment,
} from './environment.js';
import {
  resolveMarkerType,
  type FixedMarkerType,
} from './markers.js';

export interface FixedRoutePointRow {
  id: string;
  map_key: string;
  environment: string | null;
  left_pct: number;
  top_pct: number;
  color: string;
  label: string | null;
  image_url: string | null;
  marker_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedRoutePointDto {
  id: string;
  mapKey: string;
  environment: RouteEnvironment;
  left: number;
  top: number;
  color: string;
  label?: string;
  imageUrl?: string;
  markerType: FixedMarkerType;
  source: 'fixed';
  createdAt: string;
  updatedAt: string;
}

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function getDb(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not configured');
  }

  client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });
  return client;
}

async function ensureColumn(
  db: Client,
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const hasColumn = info.rows.some((row) => {
    const name = (row as { name?: unknown }).name;
    return name === column;
  });
  if (!hasColumn) {
    await db.execute(ddl);
  }
}

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      // No indexar `environment` aquí: tablas antiguas aún no tienen la columna.
      await db.batch(
        [
          `CREATE TABLE IF NOT EXISTS fixed_route_points (
            id TEXT PRIMARY KEY,
            map_key TEXT NOT NULL,
            left_pct REAL NOT NULL,
            top_pct REAL NOT NULL,
            color TEXT NOT NULL,
            label TEXT,
            image_url TEXT,
            marker_type TEXT NOT NULL DEFAULT 'default',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`,
          `CREATE INDEX IF NOT EXISTS idx_fixed_routes_map
            ON fixed_route_points(map_key)`,
          `CREATE TABLE IF NOT EXISTS site_stats (
            key TEXT PRIMARY KEY,
            value INTEGER NOT NULL DEFAULT 0
          )`,
          `CREATE TABLE IF NOT EXISTS site_visitors (
            id TEXT PRIMARY KEY,
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            visit_count INTEGER NOT NULL DEFAULT 1
          )`,
          `CREATE INDEX IF NOT EXISTS idx_site_visitors_last_seen
            ON site_visitors(last_seen_at)`,
          `CREATE TABLE IF NOT EXISTS task_snapshots (
            game_mode TEXT NOT NULL,
            lang TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            source TEXT NOT NULL,
            payload_gz TEXT NOT NULL,
            content_hash TEXT,
            task_count INTEGER NOT NULL,
            fetched_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            changed_at TEXT,
            PRIMARY KEY (game_mode, lang)
          )`,
          `CREATE TABLE IF NOT EXISTS task_sync_days (
            day_key TEXT PRIMARY KEY,
            attempts INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            last_attempt_at TEXT,
            last_success_at TEXT,
            last_error TEXT,
            updated_combinations INTEGER NOT NULL DEFAULT 0
          )`,
          `CREATE TABLE IF NOT EXISTS task_snapshot_changes (
            id TEXT PRIMARY KEY,
            game_mode TEXT NOT NULL,
            lang TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            previous_hash TEXT,
            task_count INTEGER NOT NULL,
            source TEXT NOT NULL,
            detected_at TEXT NOT NULL
          )`,
          `CREATE INDEX IF NOT EXISTS idx_task_snapshot_changes_detected
            ON task_snapshot_changes(detected_at DESC)`,
          `CREATE TABLE IF NOT EXISTS site_daily_stats (
            day_key TEXT PRIMARY KEY,
            visits INTEGER NOT NULL DEFAULT 0,
            unique_visitors INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS site_daily_visitor_hits (
            day_key TEXT NOT NULL,
            visitor_id TEXT NOT NULL,
            PRIMARY KEY (day_key, visitor_id)
          )`,
          `CREATE TABLE IF NOT EXISTS usage_events (
            id TEXT PRIMARY KEY,
            visitor_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            access_kind TEXT,
            props_json TEXT,
            day_key TEXT NOT NULL,
            occurred_at TEXT NOT NULL
          )`,
          `CREATE INDEX IF NOT EXISTS idx_usage_events_day
            ON usage_events(day_key DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_usage_events_name_day
            ON usage_events(event_name, day_key DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_usage_events_occurred
            ON usage_events(occurred_at DESC)`,
          // Índice de access_kind: solo tras ensureColumn (tablas ya creadas sin la columna).
          `CREATE TABLE IF NOT EXISTS usage_daily_counts (
            day_key TEXT NOT NULL,
            event_name TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            unique_visitors INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (day_key, event_name)
          )`,
          `CREATE TABLE IF NOT EXISTS usage_daily_event_visitors (
            day_key TEXT NOT NULL,
            event_name TEXT NOT NULL,
            visitor_id TEXT NOT NULL,
            PRIMARY KEY (day_key, event_name, visitor_id)
          )`,
        ],
        'write',
      );
      await ensureColumn(
        db,
        'fixed_route_points',
        'image_url',
        'ALTER TABLE fixed_route_points ADD COLUMN image_url TEXT',
      );
      await ensureColumn(
        db,
        'fixed_route_points',
        'marker_type',
        'ALTER TABLE fixed_route_points ADD COLUMN marker_type TEXT',
      );
      // Nullable + backfill: más compatible con LibSQL/Turso que NOT NULL DEFAULT en ALTER.
      await ensureColumn(
        db,
        'fixed_route_points',
        'environment',
        'ALTER TABLE fixed_route_points ADD COLUMN environment TEXT',
      );
      await ensureColumn(
        db,
        'task_snapshots',
        'content_hash',
        'ALTER TABLE task_snapshots ADD COLUMN content_hash TEXT',
      );
      await ensureColumn(
        db,
        'task_snapshots',
        'changed_at',
        'ALTER TABLE task_snapshots ADD COLUMN changed_at TEXT',
      );
      await ensureColumn(
        db,
        'usage_events',
        'access_kind',
        'ALTER TABLE usage_events ADD COLUMN access_kind TEXT',
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_usage_events_access_day
          ON usage_events(access_kind, day_key DESC)`,
      );
      // Backfill desde props si el cliente ya envió accessKind antes de la columna.
      try {
        await db.execute(`
          UPDATE usage_events
          SET access_kind = json_extract(props_json, '$.accessKind')
          WHERE access_kind IS NULL
            AND props_json IS NOT NULL
            AND json_extract(props_json, '$.accessKind') IS NOT NULL
        `);
      } catch {
        // json_extract puede no estar disponible en algunos runtimes; no bloquear schema.
      }
      // Purga única de eventos de uso sin clave de acceso (datos previos al tracking).
      {
        const purgeFlag = await db.execute({
          sql: `SELECT value FROM site_stats WHERE key = ?`,
          args: ['usage_purge_unclassified_v1'],
        });
        const alreadyPurged = purgeFlag.rows.some((row) => Number((row as { value?: unknown }).value) === 1);
        if (!alreadyPurged) {
          const { purgeUnclassifiedUsageEvents } = await import('./usageLogs.js');
          await purgeUnclassifiedUsageEvents();
          await db.execute({
            sql: `INSERT INTO site_stats (key, value) VALUES (?, 1)
                  ON CONFLICT(key) DO UPDATE SET value = 1`,
            args: ['usage_purge_unclassified_v1'],
          });
        }
      }
      // Puntos previos sin entorno → seasonal (comportamiento histórico de Routes).
      await db.execute({
        sql: `UPDATE fixed_route_points
              SET environment = ?
              WHERE environment IS NULL OR TRIM(environment) = ''`,
        args: [DEFAULT_ROUTE_ENVIRONMENT],
      });
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_fixed_routes_env_map
          ON fixed_route_points(environment, map_key)`,
      );

      // Mapas con SVG rotado 90° CCW → adaptar left/top de puntos fijos una sola vez.
      const mapRotations: { flag: string; mapKey: string }[] = [
        { flag: 'gz_map_rotation_ccw90', mapKey: 'ground-zero' },
        { flag: 'lh_map_rotation_ccw90', mapKey: 'lighthouse' },
        { flag: 'sot_map_rotation_ccw90', mapKey: 'streets-of-tarkov' },
      ];
      for (const { flag, mapKey } of mapRotations) {
        const rotFlag = await db.execute({
          sql: `SELECT value FROM site_stats WHERE key = ?`,
          args: [flag],
        });
        const alreadyRotated = rotFlag.rows.some((row) => {
          const value = (row as { value?: unknown }).value;
          return Number(value) === 1;
        });
        if (!alreadyRotated) {
          const now = new Date().toISOString();
          await db.execute({
            sql: `UPDATE fixed_route_points
                  SET left_pct = top_pct,
                      top_pct = 100.0 - left_pct,
                      updated_at = ?
                  WHERE map_key = ?`,
            args: [now, mapKey],
          });
          await db.execute({
            sql: `INSERT INTO site_stats (key, value) VALUES (?, 1)
                  ON CONFLICT(key) DO UPDATE SET value = 1`,
            args: [flag],
          });
        }
      }
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export function resolveRowEnvironment(value: string | null | undefined): RouteEnvironment {
  return isRouteEnvironment(value) ? value : DEFAULT_ROUTE_ENVIRONMENT;
}

export function rowToDto(row: FixedRoutePointRow): FixedRoutePointDto {
  return {
    id: row.id,
    mapKey: row.map_key,
    environment: resolveRowEnvironment(row.environment),
    left: row.left_pct,
    top: row.top_pct,
    color: row.color,
    label: row.label ?? undefined,
    imageUrl: row.image_url ?? undefined,
    markerType: resolveMarkerType(row.marker_type),
    source: 'fixed',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function newFixedPointId(): string {
  return `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
