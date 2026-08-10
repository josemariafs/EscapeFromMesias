import { getStoredSiteKind } from '../api/siteAuth';
import { readOrCreateVisitorId } from './visitorId';

const SESSION_KEY = 'efg-usage-session';
const SESSION_STARTED_KEY = 'efg-usage-session-started';
const FLUSH_MS = 4_000;
const MAX_QUEUE = 40;

export type UsageEventName =
  | 'app_session_start'
  | 'home_choice'
  | 'go_home'
  | 'quest_tab'
  | 'quest_category'
  | 'task_selected'
  | 'task_started'
  | 'task_completed'
  | 'task_reset'
  | 'story_node_selected'
  | 'search_used'
  | 'filter_changed'
  | 'data_source_changed'
  | 'logs_connect'
  | 'logs_disconnect'
  | 'language_changed'
  | 'route_map_opened'
  | 'route_point_added'
  | 'route_point_removed'
  | 'route_arrow_added'
  | 'route_arrow_removed'
  | 'route_map_cleared'
  | 'local_data_wiped';

type UsageProps = Record<string, string | number | boolean | undefined | null>;

interface QueuedEvent {
  name: UsageEventName;
  occurredAt: string;
  props?: Record<string, string | number | boolean>;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let context: Record<string, string> = {};
let listenersBound = false;

function readOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) return existing;
    const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s_tmp_${Date.now().toString(36)}`;
  }
}

function cleanProps(props?: UsageProps): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, 80);
      if (trimmed) out[key] = trimmed;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushUsageEvents();
  }, FLUSH_MS);
}

function ensureLifecycleListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  const flush = () => {
    void flushUsageEvents(true);
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export function setUsageContext(next: {
  gameMode?: string;
  appUsage?: string;
  dataSource?: string;
  lang?: string;
  accessKind?: string;
}): void {
  context = {
    ...context,
    ...(next.gameMode ? { gameMode: next.gameMode } : {}),
    ...(next.appUsage ? { appUsage: next.appUsage } : {}),
    ...(next.dataSource ? { dataSource: next.dataSource } : {}),
    ...(next.lang ? { lang: next.lang } : {}),
    ...(next.accessKind ? { accessKind: next.accessKind } : {}),
  };
}

/** Clave de acceso de la sesión actual (fallback si el contexto React aún no está listo). */
function isAccessKind(value: string | undefined): boolean {
  return (
    value === 'public'
    || value === 'private'
    || value === 'daily'
    || value === 'legacy'
    || value === 'admin'
  );
}

function resolveAccessKind(explicit?: string): string | undefined {
  if (isAccessKind(explicit)) return explicit;
  if (isAccessKind(context.accessKind)) return context.accessKind;
  return getStoredSiteKind() ?? undefined;
}

/** Encola un evento de uso (batch hacia /api/stats/usage). */
export function trackUsage(name: UsageEventName, props?: UsageProps): void {
  if (typeof window === 'undefined') return;
  ensureLifecycleListeners();

  const accessKind = resolveAccessKind(
    typeof props?.accessKind === 'string' ? props.accessKind : undefined,
  );
  const merged = cleanProps({
    ...context,
    ...props,
    ...(accessKind ? { accessKind } : {}),
  });
  queue.push({
    name,
    occurredAt: new Date().toISOString(),
    props: merged,
  });
  if (queue.length > MAX_QUEUE) {
    queue = queue.slice(-MAX_QUEUE);
  }
  if (queue.length >= 12) {
    void flushUsageEvents();
  } else {
    scheduleFlush();
  }
}

export function trackSessionStartOnce(): void {
  try {
    if (sessionStorage.getItem(SESSION_STARTED_KEY) === '1') return;
    sessionStorage.setItem(SESSION_STARTED_KEY, '1');
  } catch {
    // ignore
  }
  trackUsage('app_session_start');
}

export async function flushUsageEvents(useBeacon = false): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const payload = JSON.stringify({
    visitorId: readOrCreateVisitorId(),
    sessionId: readOrCreateSessionId(),
    events: batch,
  });

  try {
    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const ok = navigator.sendBeacon('/api/stats/visit', blob);
      if (ok) return;
    }
    await fetch('/api/stats/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: useBeacon,
    });
  } catch {
    // Reencolar si falla (sin crecer sin límite).
    queue = [...batch, ...queue].slice(-MAX_QUEUE);
  }
}
