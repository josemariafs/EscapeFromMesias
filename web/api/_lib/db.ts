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
  hasImage?: boolean;
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

async function ensureColumn(db: Client, column: string, ddl: string): Promise<void> {
  const info = await db.execute('PRAGMA table_info(fixed_route_points)');
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
        ],
        'write',
      );
      await ensureColumn(db, 'image_url', 'ALTER TABLE fixed_route_points ADD COLUMN image_url TEXT');
      await ensureColumn(
        db,
        'marker_type',
        'ALTER TABLE fixed_route_points ADD COLUMN marker_type TEXT',
      );
      // Nullable + backfill: más compatible con LibSQL/Turso que NOT NULL DEFAULT en ALTER.
      await ensureColumn(
        db,
        'environment',
        'ALTER TABLE fixed_route_points ADD COLUMN environment TEXT',
      );
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
      await db.batch(
        [
          `CREATE TABLE IF NOT EXISTS kb_document_reports (
            id TEXT PRIMARY KEY,
            map_key TEXT NOT NULL,
            environment TEXT NOT NULL,
            left_pct REAL NOT NULL,
            top_pct REAL NOT NULL,
            label TEXT,
            image_url TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            submitted_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            reviewed_at TEXT,
            fixed_point_id TEXT
          )`,
          `CREATE INDEX IF NOT EXISTS idx_kb_reports_status_created
            ON kb_document_reports(status, created_at DESC)`,
          `CREATE TABLE IF NOT EXISTS version_news (
            id TEXT PRIMARY KEY,
            news TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
          )`,
        ],
        'write',
      );
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export type KbReportStatus = 'pending' | 'accepted' | 'rejected';

export interface KbDocumentReportRow {
  id: string;
  map_key: string;
  environment: string;
  left_pct: number;
  top_pct: number;
  label: string | null;
  image_url: string;
  status: string;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  fixed_point_id: string | null;
}

export interface KbDocumentReportDto {
  id: string;
  mapKey: string;
  environment: RouteEnvironment;
  left: number;
  top: number;
  label?: string;
  imageUrl: string;
  status: KbReportStatus;
  submittedBy?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  fixedPointId?: string;
}

export function resolveKbReportStatus(value: string | null | undefined): KbReportStatus {
  if (value === 'accepted' || value === 'rejected') return value;
  return 'pending';
}

export function kbReportRowToDto(row: KbDocumentReportRow): KbDocumentReportDto {
  return {
    id: row.id,
    mapKey: row.map_key,
    environment: resolveRowEnvironment(row.environment),
    left: row.left_pct,
    top: row.top_pct,
    label: row.label ?? undefined,
    imageUrl: row.image_url,
    status: resolveKbReportStatus(row.status),
    submittedBy: row.submitted_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at ?? undefined,
    fixedPointId: row.fixed_point_id ?? undefined,
  };
}

export function newKbReportId(): string {
  return `kbr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const VERSION_NEWS_ROW_ID = 'current';

export interface VersionNewsDto {
  news: string;
  updatedAt: string | null;
}

export async function getVersionNews(): Promise<VersionNewsDto> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT news, updated_at FROM version_news WHERE id = ? LIMIT 1`,
    args: [VERSION_NEWS_ROW_ID],
  });
  const row = result.rows[0] as { news?: unknown; updated_at?: unknown } | undefined;
  if (!row) {
    return { news: '', updatedAt: null };
  }
  return {
    news: typeof row.news === 'string' ? row.news : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

export async function setVersionNews(news: string): Promise<VersionNewsDto> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO version_news (id, news, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            news = excluded.news,
            updated_at = excluded.updated_at`,
    args: [VERSION_NEWS_ROW_ID, news, updatedAt],
  });
  return { news, updatedAt };
}

export function resolveRowEnvironment(value: string | null | undefined): RouteEnvironment {
  return isRouteEnvironment(value) ? value : DEFAULT_ROUTE_ENVIRONMENT;
}

export function rowToDto(
  row: FixedRoutePointRow & { has_image?: number | boolean | null },
  opts?: { includeImage?: boolean },
): FixedRoutePointDto {
  const includeImage = opts?.includeImage !== false;
  const imageUrl = includeImage ? (row.image_url ?? undefined) : undefined;
  const hasImage =
    Boolean(row.image_url)
    || Number(row.has_image) === 1
    || row.has_image === true;
  return {
    id: row.id,
    mapKey: row.map_key,
    environment: resolveRowEnvironment(row.environment),
    left: row.left_pct,
    top: row.top_pct,
    color: row.color,
    label: row.label ?? undefined,
    imageUrl,
    hasImage,
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
