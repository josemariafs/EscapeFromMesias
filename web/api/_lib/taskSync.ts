import { createHash, timingSafeEqual } from 'node:crypto';
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
/** Metadatos de sync diario a conservar (el resto se purga). */
const SYNC_DAY_RETENTION_DAYS = 14;
/** Historial de cambios de dataset (sin payloads). */
const SNAPSHOT_CHANGE_RETENTION_DAYS = 90;
/** Máx. entradas listadas por tipo en el diff (el conteo total sí se guarda). */
const DIFF_LIST_LIMIT = 40;
/** Máx. líneas de cambio por misión actualizada. */
const DIFF_FIELD_LIMIT = 8;

export type TaskSyncDayStatus = 'pending' | 'success' | 'failed';

export interface TaskDiffEntry {
  id: string;
  name: string;
  changes?: string[];
}

export interface TaskSnapshotDiff {
  added: TaskDiffEntry[];
  removed: TaskDiffEntry[];
  updated: TaskDiffEntry[];
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  truncated: boolean;
}

let taskSchemaReady: Promise<void> | null = null;

async function ensureTaskTableColumn(
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  const db = getDb();
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const hasColumn = info.rows.some((row) => {
    const name = (row as { name?: unknown }).name;
    return name === column;
  });
  if (!hasColumn) {
    await db.execute(ddl);
  }
}

/** Tablas de sync/snapshots + columnas de diff (idempotente). */
export async function ensureTaskSyncSchema(): Promise<void> {
  if (!taskSchemaReady) {
    taskSchemaReady = (async () => {
      const db = getDb();
      await db.batch(
        [
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
            previous_task_count INTEGER,
            diff_json TEXT,
            source TEXT NOT NULL,
            detected_at TEXT NOT NULL
          )`,
          `CREATE INDEX IF NOT EXISTS idx_task_snapshot_changes_detected
            ON task_snapshot_changes(detected_at DESC)`,
        ],
        'write',
      );
      await ensureTaskTableColumn(
        'task_snapshot_changes',
        'previous_task_count',
        'ALTER TABLE task_snapshot_changes ADD COLUMN previous_task_count INTEGER',
      );
      await ensureTaskTableColumn(
        'task_snapshot_changes',
        'diff_json',
        'ALTER TABLE task_snapshot_changes ADD COLUMN diff_json TEXT',
      );
    })().catch((err) => {
      taskSchemaReady = null;
      throw err;
    });
  }
  await taskSchemaReady;
}

function summarizeTask(task: Task): TaskDiffEntry {
  return { id: task.id, name: task.name || task.normalizedName || task.id };
}

function describeTaskFieldChanges(prev: Task, next: Task): string[] {
  const out: string[] = [];
  const push = (line: string) => {
    if (out.length < DIFF_FIELD_LIMIT) out.push(line);
  };

  if (prev.name !== next.name) {
    push(`nombre: «${prev.name}» → «${next.name}»`);
  }
  if (prev.minPlayerLevel !== next.minPlayerLevel) {
    push(`nivel mínimo: ${prev.minPlayerLevel ?? '—'} → ${next.minPlayerLevel ?? '—'}`);
  }
  if (prev.experience !== next.experience) {
    push(`experiencia: ${prev.experience} → ${next.experience}`);
  }
  if (prev.kappaRequired !== next.kappaRequired) {
    push(`kappa: ${String(prev.kappaRequired)} → ${String(next.kappaRequired)}`);
  }
  if (prev.factionName !== next.factionName) {
    push(`facción: ${prev.factionName ?? '—'} → ${next.factionName ?? '—'}`);
  }
  if (prev.trader?.name !== next.trader?.name) {
    push(`trader: ${prev.trader?.name ?? '—'} → ${next.trader?.name ?? '—'}`);
  }
  if ((prev.map?.name ?? null) !== (next.map?.name ?? null)) {
    push(`mapa: ${prev.map?.name ?? '—'} → ${next.map?.name ?? '—'}`);
  }
  if (prev.wikiLink !== next.wikiLink) {
    push('enlace wiki actualizado');
  }

  const prevReqs = (prev.taskRequirements ?? [])
    .map((r) => r.task?.name ?? r.task?.id)
    .filter(Boolean)
    .join(', ');
  const nextReqs = (next.taskRequirements ?? [])
    .map((r) => r.task?.name ?? r.task?.id)
    .filter(Boolean)
    .join(', ');
  if (prevReqs !== nextReqs) {
    push(`prerrequisitos: ${prevReqs || '—'} → ${nextReqs || '—'}`);
  }

  const prevObj = new Map((prev.objectives ?? []).map((o) => [o.id, o]));
  const nextObj = new Map((next.objectives ?? []).map((o) => [o.id, o]));
  for (const [id, nObj] of nextObj) {
    const pObj = prevObj.get(id);
    if (!pObj) {
      push(`+ objetivo: ${nObj.description || nObj.type || id}`);
      continue;
    }
    if (pObj.description !== nObj.description) {
      push(`objetivo «${pObj.description || id}» → «${nObj.description || id}»`);
    } else if (
      pObj.type !== nObj.type
      || pObj.count !== nObj.count
      || pObj.optional !== nObj.optional
    ) {
      push(`objetivo «${nObj.description || id}» (tipo/cantidad/opcional)`);
    }
  }
  for (const [id, pObj] of prevObj) {
    if (!nextObj.has(id)) {
      push(`− objetivo: ${pObj.description || pObj.type || id}`);
    }
  }

  if (out.length === 0) {
    push('contenido interno distinto (recompensas u otros campos)');
  }
  return out;
}

/** Compara listas de misiones y produce un resumen compacto para el admin. */
export function diffTaskLists(previous: Task[], next: Task[]): TaskSnapshotDiff {
  const prevMap = new Map(previous.map((t) => [t.id, t]));
  const nextMap = new Map(next.map((t) => [t.id, t]));

  const addedAll: TaskDiffEntry[] = [];
  const removedAll: TaskDiffEntry[] = [];
  const updatedAll: TaskDiffEntry[] = [];

  for (const task of next) {
    const prev = prevMap.get(task.id);
    if (!prev) {
      addedAll.push(summarizeTask(task));
      continue;
    }
    if (JSON.stringify(prev) !== JSON.stringify(task)) {
      updatedAll.push({
        ...summarizeTask(task),
        changes: describeTaskFieldChanges(prev, task),
      });
    }
  }
  for (const task of previous) {
    if (!nextMap.has(task.id)) {
      removedAll.push(summarizeTask(task));
    }
  }

  const truncated =
    addedAll.length > DIFF_LIST_LIMIT
    || removedAll.length > DIFF_LIST_LIMIT
    || updatedAll.length > DIFF_LIST_LIMIT;

  return {
    added: addedAll.slice(0, DIFF_LIST_LIMIT),
    removed: removedAll.slice(0, DIFF_LIST_LIMIT),
    updated: updatedAll.slice(0, DIFF_LIST_LIMIT),
    addedCount: addedAll.length,
    removedCount: removedAll.length,
    updatedCount: updatedAll.length,
    truncated,
  };
}

async function readStoredTasks(
  gameMode: GameMode,
  lang: TaskSyncLang,
): Promise<{ hash: string | null; tasks: Task[] } | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT content_hash, payload_gz FROM task_snapshots
          WHERE game_mode = ? AND lang = ?`,
    args: [gameMode, lang],
  });
  const row = result.rows[0] as { content_hash?: string | null; payload_gz?: string } | undefined;
  if (!row?.payload_gz) return null;
  try {
    const tasks = decompressTasks(row.payload_gz);
    const hash =
      typeof row.content_hash === 'string' && row.content_hash.length > 0
        ? row.content_hash
        : hashTasks(tasks);
    return { hash, tasks };
  } catch {
    return null;
  }
}

export interface TaskSnapshotMeta {
  gameMode: GameMode;
  lang: TaskSyncLang;
  schemaVersion: number;
  source: string;
  taskCount: number;
  fetchedAt: string;
  updatedAt: string;
  contentHash?: string | null;
  unchanged?: boolean;
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
  unchanged?: boolean;
  error?: string;
}

export interface SyncRunResult {
  dayKey: string;
  attempt: number;
  status: TaskSyncDayStatus;
  results: SyncCombinationResult[];
  /** Combinaciones OK cuyo payload cambió. */
  updated: number;
  /** Combinaciones OK iguales al snapshot previo (solo fecha). */
  unchanged: number;
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

export function hashTasks(tasks: Task[]): string {
  return createHash('sha256').update(JSON.stringify(tasks)).digest('hex');
}

function madridDayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  const ms = now.getTime() - daysAgo * 24 * 60 * 60 * 1000;
  return getMadridCivilDayKey(new Date(ms));
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

/** Purge metadatos de sync antiguos; los snapshots de misiones son 1 fila por modo/idioma. */
async function pruneOldSyncDays(now = new Date()): Promise<void> {
  const cutoff = madridDayKeyDaysAgo(SYNC_DAY_RETENTION_DAYS, now);
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM task_sync_days WHERE day_key < ?`,
    args: [cutoff],
  });
}

async function pruneSnapshotChanges(now = new Date()): Promise<void> {
  const cutoffIso = new Date(
    now.getTime() - SNAPSHOT_CHANGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM task_snapshot_changes WHERE detected_at < ?`,
    args: [cutoffIso],
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

async function readStoredContentHash(
  gameMode: GameMode,
  lang: TaskSyncLang,
): Promise<string | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT content_hash, payload_gz FROM task_snapshots
          WHERE game_mode = ? AND lang = ?`,
    args: [gameMode, lang],
  });
  const row = result.rows[0] as { content_hash?: string | null; payload_gz?: string } | undefined;
  if (!row) return null;
  if (typeof row.content_hash === 'string' && row.content_hash.length > 0) {
    return row.content_hash;
  }
  // Migración: snapshots previos sin hash → calcular una vez desde el payload.
  if (row.payload_gz) {
    try {
      const hash = hashTasks(decompressTasks(row.payload_gz));
      await db.execute({
        sql: `UPDATE task_snapshots SET content_hash = ? WHERE game_mode = ? AND lang = ?`,
        args: [hash, gameMode, lang],
      });
      return hash;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Guarda el snapshot solo si el contenido cambió.
 * Si es idéntico al almacenado, solo actualiza fetched_at / updated_at.
 */
export async function upsertTaskSnapshot(
  gameMode: GameMode,
  lang: TaskSyncLang,
  tasks: Task[],
  source: string,
): Promise<TaskSnapshotMeta> {
  if (tasks.length < MIN_VALID_TASK_COUNT) {
    throw new Error(`Lista incompleta (${tasks.length} misiones).`);
  }

  await ensureTaskSyncSchema();

  const now = new Date().toISOString();
  const contentHash = hashTasks(tasks);
  const previous = await readStoredTasks(gameMode, lang);
  const previousHash = previous?.hash ?? null;
  const previousTasks = previous?.tasks ?? [];
  const db = getDb();

  if (previousHash && previousHash === contentHash) {
    // Solo refrescar fecha de comprobación; no tocar updated_at/changed_at ni el payload.
    await db.execute({
      sql: `UPDATE task_snapshots
            SET fetched_at = ?, source = ?, schema_version = ?, content_hash = ?
            WHERE game_mode = ? AND lang = ?`,
      args: [now, source, TASKS_CACHE_SCHEMA, contentHash, gameMode, lang],
    });
    return {
      gameMode,
      lang,
      schemaVersion: TASKS_CACHE_SCHEMA,
      source,
      taskCount: tasks.length,
      fetchedAt: now,
      updatedAt: now,
      contentHash,
      unchanged: true,
    };
  }

  const diff = diffTaskLists(previousTasks, tasks);
  const previousTaskCount = previousTasks.length;
  const payloadGz = compressTasks(tasks);
  await db.execute({
    sql: `INSERT INTO task_snapshots (
            game_mode, lang, schema_version, source, payload_gz, content_hash, task_count,
            fetched_at, updated_at, changed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(game_mode, lang) DO UPDATE SET
            schema_version = excluded.schema_version,
            source = excluded.source,
            payload_gz = excluded.payload_gz,
            content_hash = excluded.content_hash,
            task_count = excluded.task_count,
            fetched_at = excluded.fetched_at,
            updated_at = excluded.updated_at,
            changed_at = excluded.changed_at`,
    args: [
      gameMode,
      lang,
      TASKS_CACHE_SCHEMA,
      source,
      payloadGz,
      contentHash,
      tasks.length,
      now,
      now,
      now,
    ],
  });

  await db.execute({
    sql: `INSERT INTO task_snapshot_changes (
            id, game_mode, lang, content_hash, previous_hash, task_count,
            previous_task_count, diff_json, source, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `tsc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      gameMode,
      lang,
      contentHash,
      previousHash,
      tasks.length,
      previousTaskCount,
      JSON.stringify(diff),
      source,
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
    contentHash,
    unchanged: false,
  };
}

export async function readTaskSnapshot(
  gameMode: GameMode,
  lang: TaskSyncLang,
): Promise<{ tasks: Task[]; meta: TaskSnapshotMeta } | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT game_mode, lang, schema_version, source, payload_gz, content_hash, task_count, fetched_at, updated_at
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
        content_hash?: string | null;
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
      contentHash: row.content_hash ?? null,
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
    const meta = await upsertTaskSnapshot(gameMode, lang, tasks, source);
    return {
      gameMode,
      lang,
      ok: true,
      taskCount: tasks.length,
      unchanged: Boolean(meta.unchanged),
    };
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
 * - 1 fila por (gameMode, lang): no hay historial de payloads.
 * - Si el contenido es idéntico, solo se actualiza la fecha.
 * - Se purgan metadatos de sync con más de 14 días.
 */
async function syncAllCombinations(): Promise<SyncCombinationResult[]> {
  const jobs: { gameMode: GameMode; lang: TaskSyncLang }[] = [];
  for (const gameMode of TASK_SYNC_MODES) {
    for (const lang of TASK_SYNC_LANGS) {
      jobs.push({ gameMode, lang });
    }
  }

  // Paralelismo limitado: más rápido que secuencial, sin saturar tarkov.dev.
  const results: SyncCombinationResult[] = new Array(jobs.length);
  const concurrency = 3;
  let next = 0;

  async function worker(): Promise<void> {
    while (next < jobs.length) {
      const idx = next;
      next += 1;
      const job = jobs[idx];
      results[idx] = await syncOne(job.gameMode, job.lang);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()),
  );
  return results;
}

export async function runTaskSync(options: {
  force?: boolean;
  now?: Date;
}): Promise<{ skipped: true; decision: SyncDecision } | { skipped: false; run: SyncRunResult }> {
  await ensureTaskSyncSchema();
  const decision = await decideSyncRun(options);
  if (!decision.shouldRun) {
    return { skipped: true, decision };
  }

  const now = options.now ?? new Date();
  const previous = await readSyncDay(decision.dayKey);
  const attempt = decision.attempts + 1;
  const startedAt = now.toISOString();

  // Registrar el intento al inicio: si Vercel corta por timeout, el Detalle
  // sigue mostrando que se lanzó (pending) en lugar de parecer que no pasó nada.
  await writeSyncDay({
    day_key: decision.dayKey,
    attempts: attempt,
    status: 'pending',
    last_attempt_at: startedAt,
    last_success_at: previous?.last_success_at ?? null,
    last_error: previous?.last_error ?? null,
    updated_combinations: previous?.updated_combinations ?? 0,
  });

  const results = await syncAllCombinations();

  const okResults = results.filter((r) => r.ok);
  const updated = okResults.filter((r) => !r.unchanged).length;
  const unchanged = okResults.filter((r) => r.unchanged).length;
  const failed = results.filter((r) => !r.ok);
  const allOk = failed.length === 0;
  const status: TaskSyncDayStatus = allOk ? 'success' : 'failed';
  const error = allOk
    ? null
    : failed.map((f) => `${f.gameMode}/${f.lang}: ${f.error ?? 'error'}`).join(' | ');
  const finishedAt = new Date().toISOString();

  await writeSyncDay({
    day_key: decision.dayKey,
    attempts: attempt,
    status,
    last_attempt_at: startedAt,
    last_success_at: allOk ? finishedAt : previous?.last_success_at ?? null,
    last_error: error,
    updated_combinations: updated,
  });

  try {
    await pruneOldSyncDays(now);
    await pruneSnapshotChanges(now);
  } catch {
    // La sync ya terminó; no fallar el cron por la purga.
  }

  return {
    skipped: false,
    run: {
      dayKey: decision.dayKey,
      attempt,
      status,
      results,
      updated,
      unchanged,
      error: error ?? undefined,
    },
  };
}
