import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ROUTE_POINT_COLOR,
  ROUTE_COLOR_LABELS_STORAGE_KEY,
  ROUTE_MAPS_STORAGE_KEY,
  routeColorLabelsStorageKey,
  routeMapsStorageKey,
  type RouteColorLabels,
  type RouteEnvironment,
  type RouteMapsData,
  type RoutePoint,
} from '../types/routes';

function parseRoutes(raw: string | null): RouteMapsData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as RouteMapsData;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseColorLabels(raw: string | null): RouteColorLabels {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as RouteColorLabels;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Lee el bucket indicado; migra la clave legacy solo hacia `seasonal`. */
function readStoredRoutes(environment: RouteEnvironment): RouteMapsData {
  try {
    const keyed = localStorage.getItem(routeMapsStorageKey(environment));
    if (keyed != null) return parseRoutes(keyed);

    if (environment === 'seasonal') {
      const legacy = localStorage.getItem(ROUTE_MAPS_STORAGE_KEY);
      const migrated = parseRoutes(legacy);
      localStorage.setItem(routeMapsStorageKey('seasonal'), JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // ignore
  }
  return {};
}

function readStoredColorLabels(environment: RouteEnvironment): RouteColorLabels {
  try {
    const keyed = localStorage.getItem(routeColorLabelsStorageKey(environment));
    if (keyed != null) return parseColorLabels(keyed);

    if (environment === 'seasonal') {
      const legacy = localStorage.getItem(ROUTE_COLOR_LABELS_STORAGE_KEY);
      const migrated = parseColorLabels(legacy);
      localStorage.setItem(routeColorLabelsStorageKey('seasonal'), JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // ignore
  }
  return {};
}

function newPointId(): string {
  return `rp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useRouteMaps(environment: RouteEnvironment) {
  const [routes, setRoutes] = useState<RouteMapsData>(() => readStoredRoutes(environment));
  const [colorLabels, setColorLabels] = useState<RouteColorLabels>(() =>
    readStoredColorLabels(environment),
  );
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_ROUTE_POINT_COLOR);
  const envRef = useRef(environment);

  useEffect(() => {
    envRef.current = environment;
    setRoutes(readStoredRoutes(environment));
    setColorLabels(readStoredColorLabels(environment));
    setSelectedColor(DEFAULT_ROUTE_POINT_COLOR);
  }, [environment]);

  useEffect(() => {
    localStorage.setItem(routeMapsStorageKey(envRef.current), JSON.stringify(routes));
  }, [routes]);

  useEffect(() => {
    localStorage.setItem(routeColorLabelsStorageKey(envRef.current), JSON.stringify(colorLabels));
  }, [colorLabels]);

  const getPoints = useCallback((mapKey: string): RoutePoint[] => {
    return routes[mapKey] ?? [];
  }, [routes]);

  const setColorLabel = useCallback((color: string, name: string) => {
    setColorLabels((prev) => {
      const trimmed = name.trim();
      if (!trimmed) {
        if (!(color in prev)) return prev;
        const next = { ...prev };
        delete next[color];
        return next;
      }
      if (prev[color] === trimmed) return prev;
      return { ...prev, [color]: trimmed };
    });
  }, []);

  const addPoint = useCallback((mapKey: string, left: number, top: number, color?: string) => {
    const point: RoutePoint = {
      id: newPointId(),
      left: Math.min(100, Math.max(0, left)),
      top: Math.min(100, Math.max(0, top)),
      color: color ?? selectedColor,
    };
    setRoutes((prev) => ({
      ...prev,
      [mapKey]: [...(prev[mapKey] ?? []), point],
    }));
  }, [selectedColor]);

  const removePoint = useCallback((mapKey: string, pointId: string) => {
    setRoutes((prev) => {
      const current = prev[mapKey];
      if (!current) return prev;
      const nextPoints = current.filter((p) => p.id !== pointId);
      const next = { ...prev };
      if (nextPoints.length === 0) {
        delete next[mapKey];
      } else {
        next[mapKey] = nextPoints;
      }
      return next;
    });
  }, []);

  const movePoint = useCallback((mapKey: string, pointId: string, left: number, top: number) => {
    const nextLeft = Math.min(100, Math.max(0, left));
    const nextTop = Math.min(100, Math.max(0, top));
    setRoutes((prev) => {
      const current = prev[mapKey];
      if (!current) return prev;
      let changed = false;
      const nextPoints = current.map((p) => {
        if (p.id !== pointId) return p;
        if (p.left === nextLeft && p.top === nextTop) return p;
        changed = true;
        return { ...p, left: nextLeft, top: nextTop };
      });
      if (!changed) return prev;
      return { ...prev, [mapKey]: nextPoints };
    });
  }, []);

  const undoLast = useCallback((mapKey: string) => {
    setRoutes((prev) => {
      const current = prev[mapKey];
      if (!current?.length) return prev;
      const nextPoints = current.slice(0, -1);
      const next = { ...prev };
      if (nextPoints.length === 0) {
        delete next[mapKey];
      } else {
        next[mapKey] = nextPoints;
      }
      return next;
    });
  }, []);

  const clearMap = useCallback((mapKey: string) => {
    setRoutes((prev) => {
      if (!prev[mapKey]) return prev;
      const next = { ...prev };
      delete next[mapKey];
      return next;
    });
  }, []);

  return {
    routes,
    colorLabels,
    selectedColor,
    setSelectedColor,
    setColorLabel,
    getPoints,
    addPoint,
    removePoint,
    movePoint,
    undoLast,
    clearMap,
  };
}
