import type { TaskProgressState } from '../types';

/** Nombre de carpeta de sesión: log_YYYY.MM.DD_H-mm-ss[.sufijo] */
const SESSION_FOLDER_RE = /^log_(\d{4})\.(\d{2})\.(\d{2})_(\d{1,2})-(\d{2})-(\d{2})/;

/** Línea que inicia una entrada de log: fecha hora [offset]| */
const ENTRY_START_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}(?: [+-]\d{2}:\d{2})?\|/gm;

const NOTIFICATION_HEADER = 'Got notification | ChatMessageReceived';

/**
 * Línea de application.log que marca la selección de perfil al entrar al menú principal:
 * "<version>.<build>|<nivel>|<categoría>|SelectProfile ProfileId:<id> AccountId:<n>"
 * (en clientes recientes el mensaje es "CompleteSelectedProfile"). El número de versión
 * cambia con cada wipe/temporada del juego, lo que permite usarlo como frontera de temporada.
 */
const PROFILE_SELECT_RE =
  /^(\d+(?:\.\d+){3})\.\d+\|[^|]*\|[^|]*\|(?:SelectProfile|CompleteSelectedProfile) ProfileId:([a-f0-9]+) AccountId:(\d+)/i;

/** message.type del juego para eventos de misión (10=iniciada, 11=fallida, 12=completada). */
const TASK_MESSAGE_STATUS: Record<number, TarkovLogTaskStatus> = {
  10: 'started',
  11: 'failed',
  12: 'completed',
};

export type TarkovLogTaskStatus = Extract<TaskProgressState, 'started' | 'failed' | 'completed'>;

export interface TarkovLogTaskEvent {
  taskId: string;
  status: TarkovLogTaskStatus;
}

interface RawLogEntry {
  header: string;
  json: string | null;
}

/** Extrae la marca de tiempo (ms UTC) de un nombre de carpeta de sesión, o null si no coincide. */
export function parseSessionFolderTimestamp(folderName: string): number | null {
  const match = folderName.match(SESSION_FOLDER_RE);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

export function isSessionFolderName(folderName: string): boolean {
  return SESSION_FOLDER_RE.test(folderName);
}

/**
 * Comprueba si un nombre de archivo corresponde a un log de notificaciones.
 * No se ancla al inicio del nombre: algunos launchers/versiones anteponen
 * prefijos (fecha, versión, etc.) al nombre base "notifications(.log|_NNN.log)".
 */
export function isNotificationsLogFile(fileName: string): boolean {
  return /notifications(_\d+)?\.log$/i.test(fileName);
}

export function isApplicationLogFile(fileName: string): boolean {
  return /application(_\d+)?\.log$/i.test(fileName);
}

/**
 * Divide el texto de un log en entradas (cabecera + bloque JSON opcional).
 * Cada entrada nueva empieza con una línea "YYYY-MM-DD HH:mm:ss.fff|...".
 */
function splitLogEntries(text: string): RawLogEntry[] {
  const starts: number[] = [];
  ENTRY_START_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENTRY_START_RE.exec(text))) {
    starts.push(match.index);
  }

  const entries: RawLogEntry[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    const chunk = text.slice(start, end);
    const newlineIdx = chunk.indexOf('\n');
    const firstLine = newlineIdx === -1 ? chunk : chunk.slice(0, newlineIdx);
    const rest = newlineIdx === -1 ? '' : chunk.slice(newlineIdx + 1).trim();
    const pipeIdx = firstLine.indexOf('|');
    const header = (pipeIdx === -1 ? firstLine : firstLine.slice(pipeIdx + 1)).trim();
    entries.push({ header, json: rest.startsWith('{') ? rest : null });
  }
  return entries;
}

export interface ProfileSelectEvent {
  version: string;
  profileId: string;
  accountId: string;
}

/**
 * Extrae los eventos "selección de perfil" de un archivo application.log, en orden
 * cronológico. Permite identificar con qué versión del juego (temporada/wipe) y con qué
 * perfil se jugó cada sesión.
 */
export function extractProfileSelectEventsFromLogText(text: string): ProfileSelectEvent[] {
  const events: ProfileSelectEvent[] = [];
  for (const entry of splitLogEntries(text)) {
    const match = entry.header.match(PROFILE_SELECT_RE);
    if (!match) continue;
    events.push({ version: match[1], profileId: match[2], accountId: match[3] });
  }
  return events;
}

/** Devuelve el último evento de selección de perfil de una sesión (estado válido durante toda ella). */
export function getLatestProfileSelectEvent(text: string): ProfileSelectEvent | null {
  const events = extractProfileSelectEventsFromLogText(text);
  return events.length > 0 ? events[events.length - 1] : null;
}

interface ChatTaskMessageJson {
  message?: {
    type?: number | string;
    templateId?: string;
  };
}

/** Extrae eventos de estado de misión (started/failed/completed) de un archivo notifications.log. */
export function extractTaskEventsFromLogText(text: string): TarkovLogTaskEvent[] {
  const events: TarkovLogTaskEvent[] = [];

  for (const entry of splitLogEntries(text)) {
    if (!entry.json || !entry.header.includes(NOTIFICATION_HEADER)) continue;

    let parsed: ChatTaskMessageJson;
    try {
      parsed = JSON.parse(entry.json) as ChatTaskMessageJson;
    } catch {
      continue;
    }

    const rawMessageType = parsed.message?.type;
    const templateId = parsed.message?.templateId;
    if (rawMessageType == null || !templateId) continue;

    // Algunas versiones del cliente serializan "type" como string numérica.
    const messageType = typeof rawMessageType === 'number' ? rawMessageType : Number(rawMessageType);
    if (Number.isNaN(messageType)) continue;

    const status = TASK_MESSAGE_STATUS[messageType];
    if (!status) continue;

    const taskId = templateId.split(' ')[0];
    if (!taskId) continue;

    events.push({ taskId, status });
  }

  return events;
}

/** Aplica eventos en orden cronológico; el último evento por misión determina su estado. */
export function buildTaskStatusMap(
  events: TarkovLogTaskEvent[],
  base?: Record<string, TarkovLogTaskStatus>,
): Record<string, TarkovLogTaskStatus> {
  const map: Record<string, TarkovLogTaskStatus> = { ...base };
  for (const event of events) {
    map[event.taskId] = event.status;
  }
  return map;
}
