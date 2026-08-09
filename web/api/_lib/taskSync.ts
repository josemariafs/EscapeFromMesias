import { timingSafeEqual } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { VercelRequest } from '@vercel/node';
import { fetchTasksFromJson } from '../../src/api/tarkovJson';
import type { GameMode, Task } from '../../src/types';
import { MIN_VALID_TASK_COUNT, TASKS_CACHE_SCHEMA } from '../../src/types';
import { isAuthorized } from './auth.js';
import { getDb } from './db.js';
import { getMadridCivilDayKey, getMadridHour } from './siteAccess.js';

export const TASK_SYNC_MODES: GameMode[] = ['regular', 'seasonal', 'pve'];
export const TASK_SYNC_LANGS = ['es', 'en'] as const;
export type TaskSyncLang = (typeof TASK_SYNC_LANGS)[number];

/** Primera ventana del día (Europe/Madrid). */
export const TASK_SYNC_START_HOUR_MADRID = 5;
/** Reintentos tras el primero (total máx. = 1 + esto). */
export const TASK_SYNC_MAX_ATTEMPTS = 3;
/** Separación mínima entre intentos (cron horario + margen). */
const RETRY_GAP_MS = 50 * 60 * 1000;

export type TaskSyncDayStatus = 'pending' | 'success' | 'failed';

export interface TaskSnapshotMeta {
  gameMode: GameMode;
  lang: TaskSyncLang;
  schemaVersion: number;
  source: string;
  taskCount: number;
  fetchedAt: string;
  updatedAt: string;
}

export interface TaskSyncDayRow {
  day_key: string;
  attempts: number;
  status: TaskSyncDayStatus;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  updated_combinations: number;
}

export interface SyncDecision {
  shouldRun: boolean;
  reason: string;
  dayKey: string;
  attempts: number;
  status: TaskSyncDayStatus | null;
}

export interface SyncCombinationResult {
  gameMode: GameMode;
  lang: TaskSyncLang;
  ok: boolean;
  taskCount?: number;
  error?: string;
}

export interface SyncRunResult {
  dayKey: string;
  attempt: number;
  status: TaskSyncDayStatus;
  results: SyncCombinationResult[];
  updated: number;
  error?: string;
}

function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isCronAuthorized(req: VercelRequest): boolean {
  if (isAuthorized(req)) return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return safeEqualStrings(match[1], secret);
}

export function compressTasks(tasks: Task[]): string {
  return gzipSync(Buffer.from(JSON.stringify(tasks), 'utf8')).toString('base64');
}

export function decompressTasks(payloadGz: string): Task[] {
  const json = gunzipSync(Buffer.from(payloadGz, 'base64')).toString('utf8');
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Snapshot de misiones corrupto (no es un array).');
  }
  return parsed as Task[];
}

async function readSyncDay(dayKey: string): Promise<TaskSyncDayRow | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT day_key, attempts, status, last_attempt_at, last_success_at, last_error, updated_combinations
          FROM task_sync_days WHERE day_key = ?`,
    args: [dayKey],
  });
  const row = result.rows[0] as TaskSyncDayRow | undefined;
  return row ?? null;
}

async function writeSyncDay(row: TaskSyncDayRow): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO task_sync_days (
            day_key, attempts, status, last_attempt_at, last_success_at, last_error, updated_combinations
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day_key) DO UPDATE SET
            attempts = excluded.attempts,
            status = excluded.status,
            last_attempt_at = excluded.last_attempt_at,
            last_success_at = excluded.last_success_at,
            last_error = excluded.last_error,
            updated_combinations = excluded.updated_combinations`,
    args: [
      row.day_key,
      row.attempts,
      row.status,
      row.last_attempt_at,
      row.last_success_at,
      row.last_error,
      row.updated_combinations,
    ],
  });
}

export async function decideSyncRun(options: {
  force?: boolean;
  now?: Date;
}): Promise<SyncDecision> {
  const now = options.now ?? new Date();
  const dayKey = getMadridCivilDayKey(now);
  const hour = getMadridHour(now);
  const existing = await readSyncDay(dayKey);
  const attempts = existing?.attempts ?? 0;
  const status = existing?.status ?? null;

  if (options.force) {
    return {
      shouldRun: true,
      reason: 'forced',
      dayKey,
      attempts,
      status,
    };
  }

  if (status === 'success') {
    return {
      shouldRun: false,
      reason: 'already_success_today',
      dayKey,
      attempts,
      status,
    };
  }

  if (hour < TASK_SYNC_START_HOUR_MADRID) {
    return {
      shouldRun: false,
      reason: `before_${TASK_SYNC_START_HOUR_MADRID}_madrid`,
      dayKey,
      attempts,
      status,
    };
  }

  if (attempts >= TASK_SYNC_MAX_ATTEMPTS) {
    return {
      shouldRun: false,
      reason: 'max_attempts_reached',
      dayKey,
      attempts,
      status,
    };
  }

  if (existing?.last_attempt_at) {
    const elapsed = now.getTime() - new Date(existing.last_attempt_at).getTime();
    if (Number.isFinite(elapsed) && elapsed < RETRY_GAP_MS) {
      return {
        shouldRun: false,
        reason: 'retry_too_soon',
        dayKey,
        attempts,
        status,
      };
    }
  }

  return {
    shouldRun: true,
    reason: attempts === 0 ? 'first_window' : 'retry_window',
    dayKey,
    attempts,
    status,
  };
}

export async function upsertTaskSnapshot(
  gameMode: GameMode,
  lang: TaskSyncLang,
  tasks: Task[],
  source: string,
): Promise<TaskSnapshotMeta> {
  if (tasks.length < MIN_VALID_TASK_COUNT) {
    throw new Error(`Lista incompleta (${tasks.length} misiones).`);
  }

  const now = new Date().toISOString();
  const payloadGz = compressTasks(tasks);
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO task_snapshots (
            game_mode, lang, schema_version, source, payload_gz, task_count, fetched_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(game_mode, lang) DO UPDATE SET
            schema_version = excluded.schema_version,
            source = excluded.source,
            payload_gz = excluded.payload_gz,
            task_count = excluded.task_count,
            fetched_at = excluded.fetched_at,
            updated_at = excluded.updated_at`,
    args: [
      gameMode,
      lang,
      TASKS_CACHE_SCHEMA,
      source,
      payloadGz,
      tasks.length,
      now,
      now,
    ],
  });

  return {
    gameMode,
    lang,
    schemaVersion: TASKS_CACHE_SCHEMA,
    source,
    taskCount: tasks.length,
    fetchedAt: now,
    updatedAt: now,
  };
}

export async function readTaskSnapshot(
  gameMode: GameMode,
  lang: TaskSyncLang,
): Promise<{ tasks: Task[]; meta: TaskSnapshotMeta } | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT game_mode, lang, schema_version, source, payload_gz, task_count, fetched_at, updated_at
          FROM task_snapshots WHERE game_mode = ? AND lang = ?`,
    args: [gameMode, lang],
  });
  const row = result.rows[0] as
    | {
        game_mode: string;
        lang: string;
        schema_version: number;
        source: string;
        payload_gz: string;
        task_count: number;
        fetched_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row?.payload_gz) return null;

  const tasks = decompressTasks(row.payload_gz);
  if (tasks.length < MIN_VALID_TASK_COUNT) {
    throw new Error(`Snapshot local incompleto (${tasks.length} misiones).`);
  }

  return {
    tasks,
    meta: {
      gameMode: row.game_mode as GameMode,
      lang: row.lang as TaskSyncLang,
      schemaVersion: Number(row.schema_version),
      source: row.source,
      taskCount: Number(row.task_count),
      fetchedAt: row.fetched_at,
      updatedAt: row.updated_at,
    },
  };
}

async function syncOne(
  gameMode: GameMode,
  lang: TaskSyncLang,
): Promise<SyncCombinationResult> {
  try {
    const tasks = await fetchTasksFromJson(lang, gameMode);
    const source = `json.tarkov.dev/${gameMode === 'seasonal' ? 'pvp-season' : gameMode}`;
    await upsertTaskSnapshot(gameMode, lang, tasks, source);
    return { gameMode, lang, ok: true, taskCount: tasks.length };
  } catch (err) {
    return {
      gameMode,
      lang,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Descarga misiones desde tarkov.dev y las guarda en Turso.
 * No borra snapshots previos si una combinación falla.
 */
export async function runTaskSync(options: {
  force?: boolean;
  now?: Date;
}): Promise<{ skipped: true; decision: SyncDecision } | { skipped: false; run: SyncRunResult }> {
  const decision = await decideSyncRun(options);
  if (!decision.shouldRun) {
    return { skipped: true, decision };
  }

  const now = options.now ?? new Date();
  const previous = await readSyncDay(decision.dayKey);
  const attempt = decision.attempts + 1;
  const startedAt = now.toISOString();
  const results: SyncCombinationResult[] = [];

  for (const gameMode of TASK_SYNC_MODES) {
    for (const lang of TASK_SYNC_LANGS) {
      results.push(await syncOne(gameMode, lang));
    }
  }

  const updated = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const allOk = failed.length === 0;
  const status: TaskSyncDayStatus = allOk ? 'success' : 'failed';
  const error = allOk
    ? null
    : failed.map((f) => `${f.gameMode}/${f.lang}: ${f.error ?? 'error'}`).join(' | ');

  await writeSyncDay({
    day_key: decision.dayKey,
    attempts: attempt,
    status,
    last_attempt_at: startedAt,
    last_success_at: allOk ? startedAt : previous?.last_success_at ?? null,
    last_error: error,
    updated_combinations: updated,
  });

  return {
    skipped: false,
    run: {
      dayKey: decision.dayKey,
      attempt,
      status,
      results,
      updated,
      error: error ?? undefined,
    },
  };
}
