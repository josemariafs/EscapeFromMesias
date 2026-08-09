export interface AdminDashboardSummary {
  impressions: number;
  uniqueBrowsers: number;
  online: number;
  timezone: string;
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

export interface AdminSyncDayRow {
  dayKey: string;
  attempts: number;
  status: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  updatedCombinations: number;
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
