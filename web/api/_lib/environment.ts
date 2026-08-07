export type RouteEnvironment = 'regular' | 'seasonal';

export const DEFAULT_ROUTE_ENVIRONMENT: RouteEnvironment = 'seasonal';

export function isRouteEnvironment(value: unknown): value is RouteEnvironment {
  return value === 'regular' || value === 'seasonal';
}

export function normalizeRouteEnvironment(
  value: unknown,
): { ok: true; value: RouteEnvironment } | { ok: false; error: string } {
  if (value == null || value === '') {
    return { ok: true, value: DEFAULT_ROUTE_ENVIRONMENT };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Invalid environment' };
  }
  const trimmed = value.trim();
  if (!isRouteEnvironment(trimmed)) {
    return { ok: false, error: 'environment must be regular or seasonal' };
  }
  return { ok: true, value: trimmed };
}
