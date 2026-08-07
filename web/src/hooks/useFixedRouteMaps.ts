import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createFixedRoutePoint,
  deleteFixedRoutePoint,
  fetchFixedRoutes,
  updateFixedRoutePoint,
  type CreateFixedRoutePointInput,
  type UpdateFixedRoutePointInput,
} from '../api/fixedRoutes';
import type { FixedRouteMapsData, FixedRoutePoint } from '../types/routes';

function groupByMap(points: FixedRoutePoint[]): FixedRouteMapsData {
  const next: FixedRouteMapsData = {};
  for (const point of points) {
    const list = next[point.mapKey] ?? [];
    list.push(point);
    next[point.mapKey] = list;
  }
  return next;
}

export function useFixedRouteMaps() {
  const [points, setPoints] = useState<FixedRoutePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFixedRoutes();
      setPoints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fixed routes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const routes = useMemo(() => groupByMap(points), [points]);

  const getPoints = useCallback(
    (mapKey: string): FixedRoutePoint[] => routes[mapKey] ?? [],
    [routes],
  );

  const addPoint = useCallback(async (token: string, input: CreateFixedRoutePointInput) => {
    const point = await createFixedRoutePoint(token, input);
    setPoints((prev) => [...prev, point]);
    return point;
  }, []);

  const patchPoint = useCallback(
    async (token: string, id: string, input: UpdateFixedRoutePointInput) => {
      const point = await updateFixedRoutePoint(token, id, input);
      setPoints((prev) => prev.map((p) => (p.id === id ? point : p)));
      return point;
    },
    [],
  );

  const removePoint = useCallback(async (token: string, id: string) => {
    await deleteFixedRoutePoint(token, id);
    setPoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    points,
    routes,
    loading,
    error,
    reload,
    getPoints,
    addPoint,
    patchPoint,
    removePoint,
  };
}
