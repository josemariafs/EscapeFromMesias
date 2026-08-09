export interface AdminSyncDayRow {
  dayKey: string;
  attempts: number;
  status: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  updatedCombinations: number;
}

export interface AdminDashboardSummary {
  impressions: number;
  uniqueBrowsers: number;
  online: number;
  fixedPoints: number;
  timezone: string;
  visitsToday: number;
  uniquesToday: number;
  visitsYesterday: number;
  uniquesYesterday: number;
  visits7d: number;
  uniques7d: number;
  avgVisits7d: number;
  visitsDeltaPct: number | null;
  changes7d: number;
  totalTasksEs: number;
  snapshotCount: number;
  oldestFetchedAt: string | null;
  lastDatasetChangeAt: string | null;
  lastSync: AdminSyncDayRow | null;
}

export interface AdminSnapshotRow {
  gameMode: string;
  lang: string;
  schemaVersion: number;
  source: string;
  contentHash: string | null;
  taskCount: number;
  fetchedAt: string;
  updatedAt: string;
  changedAt: string | null;
}

export interface AdminChangeRow {
  id: string;
  gameMode: string;
  lang: string;
  contentHash: string;
  previousHash: string | null;
  taskCount: number;
  source: string;
  detectedAt: string;
}

export interface AdminDailyVisitRow {
  dayKey: string;
  visits: number;
  uniqueVisitors: number;
}

export interface AdminDashboardData {
  summary: AdminDashboardSummary;
  snapshots: AdminSnapshotRow[];
  syncDays: AdminSyncDayRow[];
  changes: AdminChangeRow[];
  dailyVisits: AdminDailyVisitRow[];
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || 'Request failed';
  }
}

export async function fetchAdminDashboard(token: string): Promise<AdminDashboardData> {
  const res = await fetch('/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AdminDashboardData;
}

export async function forceTaskSync(token: string): Promise<unknown> {
  const res = await fetch('/api/cron/sync-tasks?force=1', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export type AdminUsageAccessKind = 'public' | 'private' | 'daily' | 'legacy';
export type AdminUsageAccessFilter = AdminUsageAccessKind | 'unknown';

export interface AdminUsageEventRow {
  id: string;
  visitorId: string;
  sessionId: string;
  eventName: string;
  accessKind: string | null;
  props: Record<string, string | number | boolean> | null;
  dayKey: string;
  occurredAt: string;
}

export interface AdminUsageData {
  timezone: string;
  retentionDays: number;
  accessKind: AdminUsageAccessFilter | null;
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
  recent: AdminUsageEventRow[];
}

export async function fetchAdminUsage(
  token: string,
  accessKind?: AdminUsageAccessFilter | 'all' | null,
): Promise<AdminUsageData> {
  const params = new URLSearchParams();
  if (accessKind && accessKind !== 'all') params.set('accessKind', accessKind);
  const qs = params.toString();
  const res = await fetch(`/api/admin/usage${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AdminUsageData;
}
