import { getStoredSiteSession } from './siteAuth';
import type { RouteEnvironment } from '../types/routes';

export type KbReportStatus = 'pending' | 'accepted' | 'rejected';

export interface KbDocumentReport {
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

export interface SubmitKbReportInput {
  mapKey: string;
  environment: RouteEnvironment;
  left: number;
  top: number;
  label?: string;
  imageUrl: string;
}

export type SubmitKbReportResult =
  | { ok: true; report: KbDocumentReport }
  | { ok: false; error: string };

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function submitKbDocumentReport(
  input: SubmitKbReportInput,
): Promise<SubmitKbReportResult> {
  const token = getStoredSiteSession();
  if (!token) return { ok: false, error: 'session' };

  try {
    const res = await fetch('/api/kb-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        mapKey: input.mapKey,
        environment: input.environment,
        left: input.left,
        top: input.top,
        label: input.label ?? null,
        imageUrl: input.imageUrl,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error?.trim() || `http_${res.status}` };
    }
    const data = (await res.json()) as { report: KbDocumentReport };
    return { ok: true, report: data.report };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function fetchKbDocumentReports(
  token: string,
  status: KbReportStatus = 'pending',
): Promise<KbDocumentReport[]> {
  const res = await fetch(`/api/kb-reports?status=${encodeURIComponent(status)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error?.trim() || `http_${res.status}`);
  }
  const data = (await res.json()) as { reports: KbDocumentReport[] };
  return data.reports ?? [];
}

export async function reviewKbDocumentReport(
  token: string,
  reportId: string,
  action: 'accept' | 'reject',
): Promise<KbDocumentReport> {
  const res = await fetch('/api/kb-reports', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ id: reportId, action }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error?.trim() || `http_${res.status}`);
  }
  const data = (await res.json()) as { report: KbDocumentReport };
  return data.report;
}
