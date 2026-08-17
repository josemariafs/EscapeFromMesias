import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createFixedRoutePoint,
  deleteFixedRoutePoint,
  fetchFixedRouteImages,
  fetchFixedRoutePoint,
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

export function useFixedRouteMaps(
  environment: RouteEnvironment,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled !== false;
  const [points, setPoints] = useState<FixedRoutePoint[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const imageInflightRef = useRef(new Map<string, Promise<string | undefined>>());
  const mapInflightRef = useRef(new Map<string, Promise<void>>());

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
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
  }, [enabled, environment]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ensureImage = useCallback(async (id: string): Promise<string | undefined> => {
    const existing = pointsRef.current.find((point) => point.id === id);
    if (existing?.imageUrl) return existing.imageUrl;
    if (!existing?.hasImage && !existing?.imageUrl) return undefined;

    const pending = imageInflightRef.current.get(id);
    if (pending) return pending;

    const promise = fetchFixedRoutePoint(id)
      .then((point) => {
        setPoints((prev) => prev.map((item) => (
          item.id === id
            ? {
                ...item,
                ...point,
                hasImage: Boolean(point.imageUrl) || Boolean(point.hasImage),
              }
            : item
        )));
        return point.imageUrl;
      })
      .finally(() => {
        imageInflightRef.current.delete(id);
      });
    imageInflightRef.current.set(id, promise);
    return promise;
  }, []);

  const prefetchMapImages = useCallback(async (mapKey: string): Promise<void> => {
    if (!mapKey) return;
    const pending = mapInflightRef.current.get(mapKey);
    if (pending) return pending;

    const needsFetch = pointsRef.current.some(
      (point) => point.mapKey === mapKey && point.hasImage && !point.imageUrl,
    );
    if (!needsFetch) return;

    const promise = fetchFixedRouteImages(environment, mapKey)
      .then((withImages) => {
        const byId = new Map(withImages.map((point) => [point.id, point]));
        setPoints((prev) => prev.map((point) => {
          const next = byId.get(point.id);
          if (!next) return point;
          return {
            ...point,
            ...next,
            hasImage: Boolean(next.imageUrl) || Boolean(next.hasImage),
          };
        }));
      })
      .finally(() => {
        mapInflightRef.current.delete(mapKey);
      });
    mapInflightRef.current.set(mapKey, promise);
    return promise;
  }, [environment]);

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
          return prev.map((p) => {
            if (p.id !== id) return p;
            const nextImageUrl = point.hasImage === false
              ? undefined
              : (point.imageUrl ?? p.imageUrl);
            return {
              ...p,
              ...point,
              environment: pointEnv,
              imageUrl: nextImageUrl,
              hasImage: point.hasImage ?? Boolean(nextImageUrl),
            };
          });
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
    ensureImage,
    prefetchMapImages,
  };
}
