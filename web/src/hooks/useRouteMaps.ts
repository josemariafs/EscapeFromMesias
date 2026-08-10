import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ROUTE_POINT_COLOR,
  ROUTE_COLOR_LABELS_STORAGE_KEY,
  ROUTE_MAPS_STORAGE_KEY,
  routeArrowsStorageKey,
  routeColorLabelsStorageKey,
  routeMapsStorageKey,
  type RouteArrow,
  type RouteArrowsData,
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

function parseArrows(raw: string | null): RouteArrowsData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as RouteArrowsData;
    if (!parsed || typeof parsed !== 'object') return {};
    const next: RouteArrowsData = {};
    for (const [mapKey, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      next[mapKey] = list.filter(
        (arrow): arrow is RouteArrow =>
          !!arrow
          && typeof arrow.id === 'string'
          && typeof arrow.fromLeft === 'number'
          && typeof arrow.fromTop === 'number'
          && typeof arrow.toLeft === 'number'
          && typeof arrow.toTop === 'number'
          && typeof arrow.color === 'string',
      );
    }
    return next;
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

function readStoredArrows(environment: RouteEnvironment): RouteArrowsData {
  try {
    return parseArrows(localStorage.getItem(routeArrowsStorageKey(environment)));
  } catch {
    return {};
  }
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

function newArrowId(): string {
  return `ra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function useRouteMaps(environment: RouteEnvironment) {
  const [routes, setRoutes] = useState<RouteMapsData>(() => readStoredRoutes(environment));
  const [arrows, setArrows] = useState<RouteArrowsData>(() => readStoredArrows(environment));
  const [colorLabels, setColorLabels] = useState<RouteColorLabels>(() =>
    readStoredColorLabels(environment),
  );
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_ROUTE_POINT_COLOR);
  const envRef = useRef(environment);

  useEffect(() => {
    envRef.current = environment;
    setRoutes(readStoredRoutes(environment));
    setArrows(readStoredArrows(environment));
    setColorLabels(readStoredColorLabels(environment));
    setSelectedColor(DEFAULT_ROUTE_POINT_COLOR);
  }, [environment]);

  useEffect(() => {
    localStorage.setItem(routeMapsStorageKey(envRef.current), JSON.stringify(routes));
  }, [routes]);

  useEffect(() => {
    localStorage.setItem(routeArrowsStorageKey(envRef.current), JSON.stringify(arrows));
  }, [arrows]);

  useEffect(() => {
    localStorage.setItem(routeColorLabelsStorageKey(envRef.current), JSON.stringify(colorLabels));
  }, [colorLabels]);

  const getPoints = useCallback((mapKey: string): RoutePoint[] => {
    return routes[mapKey] ?? [];
  }, [routes]);

  const getArrows = useCallback((mapKey: string): RouteArrow[] => {
    return arrows[mapKey] ?? [];
  }, [arrows]);

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
      left: clampPct(left),
      top: clampPct(top),
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
    const nextLeft = clampPct(left);
    const nextTop = clampPct(top);
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

  const updatePointLabel = useCallback((mapKey: string, pointId: string, label: string) => {
    const trimmed = label.trim();
    setRoutes((prev) => {
      const current = prev[mapKey];
      if (!current) return prev;
      let changed = false;
      const nextPoints = current.map((p) => {
        if (p.id !== pointId) return p;
        const prevLabel = p.label?.trim() ?? '';
        if (prevLabel === trimmed) return p;
        changed = true;
        if (!trimmed) {
          const { label: _removed, ...rest } = p;
          return rest;
        }
        return { ...p, label: trimmed };
      });
      if (!changed) return prev;
      return { ...prev, [mapKey]: nextPoints };
    });
  }, []);

  const addArrow = useCallback((
    mapKey: string,
    fromLeft: number,
    fromTop: number,
    toLeft: number,
    toTop: number,
    color?: string,
  ) => {
    const arrow: RouteArrow = {
      id: newArrowId(),
      fromLeft: clampPct(fromLeft),
      fromTop: clampPct(fromTop),
      toLeft: clampPct(toLeft),
      toTop: clampPct(toTop),
      color: color ?? selectedColor,
    };
    setArrows((prev) => ({
      ...prev,
      [mapKey]: [...(prev[mapKey] ?? []), arrow],
    }));
  }, [selectedColor]);

  const removeArrow = useCallback((mapKey: string, arrowId: string) => {
    setArrows((prev) => {
      const current = prev[mapKey];
      if (!current) return prev;
      const nextArrows = current.filter((a) => a.id !== arrowId);
      const next = { ...prev };
      if (nextArrows.length === 0) {
        delete next[mapKey];
      } else {
        next[mapKey] = nextArrows;
      }
      return next;
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
    setArrows((prev) => {
      if (!prev[mapKey]) return prev;
      const next = { ...prev };
      delete next[mapKey];
      return next;
    });
  }, []);

  return {
    routes,
    arrows,
    colorLabels,
    selectedColor,
    setSelectedColor,
    setColorLabel,
    getPoints,
    getArrows,
    addPoint,
    removePoint,
    movePoint,
    updatePointLabel,
    addArrow,
    removeArrow,
    undoLast,
    clearMap,
  };
}
