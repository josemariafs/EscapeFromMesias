import type { FixedRoutePoint, RouteEnvironment } from '../types/routes';

export interface FixedRoutesResponse {
  points: FixedRoutePoint[];
  environment?: RouteEnvironment;
}

export interface CreateFixedRoutePointInput {
  mapKey: string;
  environment: RouteEnvironment;
  left: number;
  top: number;
  color: string;
  label?: string | null;
  imageUrl?: string | null;
  markerType?: 'default' | 'kb-document' | 'kb-underground' | 'question' | 'kb' | null;
}

export interface UpdateFixedRoutePointInput {
  mapKey?: string;
  environment?: RouteEnvironment;
  left?: number;
  top?: number;
  color?: string;
  label?: string | null;
  imageUrl?: string | null;
  markerType?: 'default' | 'kb-document' | 'kb-underground' | 'question' | 'kb' | null;
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

export async function fetchFixedRoutes(
  environment: RouteEnvironment,
): Promise<FixedRoutePoint[]> {
  const params = new URLSearchParams({ environment });
  const res = await fetch(`/api/fixed-routes?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as FixedRoutesResponse;
  return Array.isArray(data.points) ? data.points : [];
}

export async function fetchFixedRoutePoint(id: string): Promise<FixedRoutePoint> {
  const res = await fetch(`/api/fixed-routes/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as { point: FixedRoutePoint };
  if (!data.point?.id) {
    throw new Error('Invalid fixed route point');
  }
  return data.point;
}

export async function fetchFixedRouteImages(
  environment: RouteEnvironment,
  mapKey: string,
): Promise<FixedRoutePoint[]> {
  const params = new URLSearchParams({ environment, mapKey, images: '1' });
  const res = await fetch(`/api/fixed-routes?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as FixedRoutesResponse;
  return Array.isArray(data.points) ? data.points : [];
}

export async function verifyAdminToken(token: string): Promise<void> {
  const res = await fetch('/api/admin/dashboard?view=ping', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.ok) return;
  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  if (res.status === 503) {
    throw new Error('ADMIN_TOKEN no configurado en el servidor');
  }
  throw new Error(await parseErrorMessage(res));
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
