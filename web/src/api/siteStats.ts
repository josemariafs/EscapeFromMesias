export interface VisitStats {
  impressions: number;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || 'Request failed';
  }
}

export async function fetchImpressions(): Promise<number> {
  const res = await fetch('/api/stats/visit');
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data = (await res.json()) as VisitStats;
  return typeof data.impressions === 'number' ? data.impressions : 0;
}

export async function registerVisit(visitorId: string): Promise<number> {
  const res = await fetch('/api/stats/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data = (await res.json()) as VisitStats;
  return typeof data.impressions === 'number' ? data.impressions : 0;
}
