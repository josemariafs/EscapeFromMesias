import type { FixedRoutePoint } from '../types/routes';

export interface FixedRoutesResponse {
  points: FixedRoutePoint[];
}

export interface CreateFixedRoutePointInput {
  mapKey: string;
  left: number;
  top: number;
  color: string;
  label?: string | null;
  imageUrl?: string | null;
  markerType?: 'default' | 'kb' | 'question' | null;
}

export interface UpdateFixedRoutePointInput {
  mapKey?: string;
  left?: number;
  top?: number;
  color?: string;
  label?: string | null;
  imageUrl?: string | null;
  markerType?: 'default' | 'kb' | 'question' | null;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || 'Request failed';
  }
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchFixedRoutes(): Promise<FixedRoutePoint[]> {
  const res = await fetch('/api/fixed-routes');
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as FixedRoutesResponse;
  return Array.isArray(data.points) ? data.points : [];
}

export async function verifyAdminToken(token: string): Promise<void> {
  const res = await fetch('/api/admin/ping', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
}

export async function createFixedRoutePoint(
  token: string,
  input: CreateFixedRoutePointInput,
): Promise<FixedRoutePoint> {
  const res = await fetch('/api/fixed-routes', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as { point: FixedRoutePoint };
  return data.point;
}

export async function updateFixedRoutePoint(
  token: string,
  id: string,
  input: UpdateFixedRoutePointInput,
): Promise<FixedRoutePoint> {
  const res = await fetch(`/api/fixed-routes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as { point: FixedRoutePoint };
  return data.point;
}

export async function deleteFixedRoutePoint(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/fixed-routes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
}
