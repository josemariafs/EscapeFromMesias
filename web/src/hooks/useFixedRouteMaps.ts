import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createFixedRoutePoint,
  deleteFixedRoutePoint,
  fetchFixedRoutes,
  updateFixedRoutePoint,
  type CreateFixedRoutePointInput,
  type UpdateFixedRoutePointInput,
} from '../api/fixedRoutes';
import type {
  FixedRouteMapsData,
  FixedRoutePoint,
  RouteEnvironment,
} from '../types/routes';

function groupByMap(points: FixedRoutePoint[]): FixedRouteMapsData {
  const next: FixedRouteMapsData = {};
  for (const point of points) {
    const list = next[point.mapKey] ?? [];
    list.push(point);
    next[point.mapKey] = list;
  }
  return next;
}

export function useFixedRouteMaps(environment: RouteEnvironment) {
  const [points, setPoints] = useState<FixedRoutePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFixedRoutes(environment);
      setPoints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fixed routes');
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const routes = useMemo(() => groupByMap(points), [points]);

  const getPoints = useCallback(
    (mapKey: string): FixedRoutePoint[] => routes[mapKey] ?? [],
    [routes],
  );

  const addPoint = useCallback(async (
    token: string,
    input: Omit<CreateFixedRoutePointInput, 'environment'> & { environment?: RouteEnvironment },
  ) => {
    const point = await createFixedRoutePoint(token, {
      ...input,
      environment: input.environment ?? environment,
    });
    setPoints((prev) => [...prev, point]);
    return point;
  }, [environment]);

  const patchPoint = useCallback(
    async (token: string, id: string, input: UpdateFixedRoutePointInput) => {
      // Actualización optimista (p. ej. al arrastrar) para que el mapa no espere al PATCH.
      if (input.left != null || input.top != null) {
        setPoints((prev) =>
          prev.map((p) => (
            p.id === id
              ? {
                  ...p,
                  left: input.left ?? p.left,
                  top: input.top ?? p.top,
                }
              : p
          )),
        );
      }
      try {
        const point = await updateFixedRoutePoint(token, id, input);
        setPoints((prev) => {
          // Respuestas antiguas sin `environment` se tratan como el bucket actual.
          const pointEnv = point.environment ?? environment;
          if (pointEnv !== environment) {
            return prev.filter((p) => p.id !== id);
          }
          return prev.map((p) => (p.id === id ? { ...point, environment: pointEnv } : p));
        });
        return point;
      } catch (err) {
        // Si falla el guardado, recargar para no dejar una posición falsa en UI.
        void reload();
        throw err;
      }
    },
    [environment, reload],
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
